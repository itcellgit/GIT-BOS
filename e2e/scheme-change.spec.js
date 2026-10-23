import { expect, test } from "@playwright/test";
import { signIn, unique } from "./helpers.js";

// Phase 4 acceptance (README §12): a cloned test scheme is published and a 2025 syllabus is carried
// forward into it as V1.0. Then a scheme amendment flags it "Needs revision", and the BoS Coordinator
// records that no change is needed. The test scheme is retired at the end (schemes in use are never deleted).

const dialog = (page) => page.getByRole("dialog");

test("clone a scheme, copy the course list, carry a syllabus forward as V1.0, then amend the scheme", async ({
  browser,
}) => {
  test.slow();
  const dean = await (await browser.newContext()).newPage();
  const bos = await (await browser.newContext()).newPage();
  await signIn(dean, "dean@example.edu");
  await signIn(bos, "bos.cse@example.edu");

  // A 2025 CSE syllabus with a version to carry forward (the review-workflow test makes approved ones).
  const before = (await (await bos.request.get("/api/departments/CSE")).json()).data;
  const source =
    before.courses.find((c) => c.syllabus?.status === "APPROVED" && c.format === "THEORY") ??
    before.courses.find((c) => c.syllabus?.label && c.format === "THEORY");
  test.skip(!source, "needs a submitted 2025 Theory syllabus (run review-workflow.spec.js first)");

  // A run that stopped half-way may have left its test scheme published: retire it first.
  const { schemes } = (await (await dean.request.get("/api/schemes")).json()).data;
  for (const s of schemes.filter((s) => s.status === "PUBLISHED" && /^Test T\w+ Scheme$/.test(s.name))) {
    await dean.request.post(`/api/schemes/${s.id}/retire`);
  }

  // Dean Academics clones the 2025 scheme and publishes the copy.
  const code = unique("T");
  const name = `Test ${code} Scheme`;
  await dean.goto("/schemes");
  await dean.getByRole("button", { name: "New scheme" }).click();
  await dialog(dean).getByLabel("Start from").click();
  await dean.getByRole("option", { name: "Copy of 2025 Scheme" }).click();
  await dialog(dean).getByLabel("Code", { exact: true }).fill(code);
  await dialog(dean).getByLabel("Name").fill(name);
  await dialog(dean).getByRole("button", { name: "Create draft" }).click();
  await expect(dean.getByRole("heading", { name })).toBeVisible();
  await dean.getByRole("button", { name: "Publish" }).click();
  await dialog(dean).getByRole("button", { name: "Publish" }).click();
  await expect(dean.getByText("Published", { exact: true })).toBeVisible();
  const schemeId = dean.url().split("/").at(-1);
  try {
    // The BoS Coordinator copies the BE-CSE course list (with faculty) from 2025.
    const programme = before.programmes[0];
    await bos.goto(`/schemes/${schemeId}/programmes/${programme.id}`);
    await bos.getByRole("button", { name: "Copy from a scheme" }).click();
    // The scheme it was cloned from is offered first.
    await expect(dialog(bos).getByRole("combobox", { name: "Copy from" })).toContainText("2025 Scheme");
    await dialog(bos).getByRole("button", { name: "Copy courses" }).click();
    await expect(bos.getByText(/course\(s\) copied/).first()).toBeVisible();
    await expect(bos.getByRole("cell", { name: source.code })).toBeVisible();

    // …and carries the 2025 syllabus forward, then submits it: V1.0 in the new scheme.
    const path = `/syllabi/${schemeId}/${source.courseId}`;
    await bos.goto(path);
    await expect(bos.getByText("Start from an earlier syllabus?")).toBeVisible();
    await bos.getByRole("button", { name: "Carry forward" }).click();
    await expect(dialog(bos).getByRole("combobox", { name: "Start from" })).toContainText(`${source.code} `);
    await dialog(bos).getByRole("combobox", { name: "Start from" }).click();
    await bos.getByRole("option", { name: new RegExp(`^${source.code} .*— 2025 Scheme`) }).click();
    await dialog(bos).getByRole("button", { name: "Carry forward" }).click();
    await expect(bos.getByText(`Carried forward from ${source.code}, 2025 Scheme`)).toBeVisible();
    await bos.getByRole("button", { name: "Submit as V1.0" }).click();
    await dialog(bos).getByRole("button", { name: "Submit" }).click();
    await expect(bos.getByText("Submitted as V1.0")).toBeVisible();

    // Dean Academics amends the published scheme: the Theory format settings change.
    await dean.reload();
    await dean.getByRole("tab", { name: "Formats" }).click();
    await dean.getByRole("tabpanel").getByRole("button", { name: "Edit", exact: true }).first().click();
    const heading = dialog(dean).getByLabel("Heading printed on the syllabus");
    await heading.fill(`${await heading.inputValue()} (amended)`);
    await dialog(dean).getByRole("button", { name: "Save" }).click();
    await expect(dialog(dean)).toBeHidden();
    await dean.getByRole("tab", { name: /Amendments/ }).click();
    await expect(dean.getByRole("cell", { name: "Theory format settings changed" })).toBeVisible();

    // The syllabus is flagged; its checks were re-run, and the coordinator records that nothing changes.
    await bos.goto(path);
    await expect(bos.getByText("Needs revision: the scheme was amended")).toBeVisible();
    await expect(bos.getByText(/checks after the change: no errors/)).toBeVisible();
    await bos.getByRole("button", { name: "No change needed" }).click();
    await dialog(bos).getByLabel("Note").fill("Only the printed heading changed.");
    await dialog(bos).getByRole("button", { name: "Clear the flag" }).click();
    await expect(bos.getByText("Needs revision: the scheme was amended")).toHaveCount(0);
  } finally {
    // Clean up: the test scheme becomes a read-only archive (schemes in use are never deleted).
    await dean.request.post(`/api/schemes/${schemeId}/retire`);
  }
});
