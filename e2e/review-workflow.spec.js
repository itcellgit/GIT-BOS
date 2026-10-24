import { expect, test } from "@playwright/test";
import { signIn, unique, waitForMail } from "./helpers.js";

// The full review path (README §13, workflow tests): V1.0 → inputs → V2.0 → V3.0 → V4.0 approved →
// unlock → V4.1 → re-approved. Versions can never be deleted, so each run adds its own course to the
// CSE course list (a copy of 1BCS409's scheme row under a unique code) and frames a fresh syllabus.
const TEMPLATE = "1BCS409";
const TITLE = "E2E workflow test course";
const TEST_SEMESTER = 8;

/** Adds a Theory course like 1BCS409 to the CSE course list; returns its syllabus path. */
async function addTestCourse(page) {
  const department = (await (await page.request.get("/api/departments/CSE")).json()).data;
  const template = department.courses.find((c) => c.code === TEMPLATE);
  const programme = department.programmes[0];
  const listPath = `/api/schemes/${template.schemeId}/programmes/${programme.id}`;
  const list = (await (await page.request.get(listPath)).json()).data;
  const row = list.courses.find((r) => r.courseId === template.courseId);
  const code = unique("1BTST");
  const fields = [
    "semester",
    "categoryId",
    "format",
    "teachingDepartmentId",
    "lCredits",
    "tCredits",
    "pCredits",
    "lHours",
    "tHours",
    "pHours",
    "twSlHours",
    "cieMarks",
    "seeMarks",
    "examHours",
  ];
  const values = (r) => ({ ...Object.fromEntries(fields.map((k) => [k, r[k]])), electiveGroupId: null });
  const titleOf = (r) => r.course?.title ?? r.title;

  // Semester 8, so the semester totals that course-list.spec.js checks stay as seeded. Earlier runs
  // put their courses in semester 4: move those too.
  for (const old of list.courses.filter((r) => titleOf(r) === TITLE && r.semester !== TEST_SEMESTER)) {
    const moved = await page.request.put(`${listPath}/courses/${old.id}`, {
      data: { ...values(old), code: old.course?.code ?? old.code, title: TITLE, semester: TEST_SEMESTER },
    });
    expect(moved.ok(), (await moved.json()).error).toBe(true);
  }

  const res = await page.request.post(`${listPath}/courses`, {
    data: { ...values(row), semester: TEST_SEMESTER, code, title: TITLE },
  });
  expect(res.ok(), (await res.json()).error).toBe(true);
  const added = (await (await page.request.get("/api/departments/CSE")).json()).data.courses.find(
    (c) => c.code === code,
  );
  return { code, path: `/syllabi/${added.schemeId}/${added.courseId}` };
}

/** A complete Theory syllabus that passes every check, built from the editor data. */
function completeContent(data) {
  const { format, offerings, bloomLevels, lists } = data;
  const o = offerings[0];
  const base = Math.floor(o.lHours / format.unitCount);
  const extra = o.lHours - base * format.unitCount;
  const apply = bloomLevels.find((l) => l.level === 3) ?? bloomLevels[0];
  const verb = apply.verbs[0];
  const book = {
    authors: "A. Silberschatz",
    title: "Operating System Concepts",
    publisher: "Wiley",
    edition: "10th",
    year: "2018",
  };
  return {
    objectives: Array.from({ length: format.cloMin }, (_, i) => `Objective ${i + 1} of the course.`),
    prerequisites: "Programming in C.",
    units: Array.from({ length: format.unitCount }, (_, i) => ({
      title: `Unit topic ${i + 1}`,
      content: `Topics of unit ${i + 1}.`,
      hours: base + (i < extra ? 1 : 0),
    })),
    flippedSessions: Array.from({ length: format.unitCount }, () => 1),
    textBooks: [book],
    referenceBooks: format.hasReferenceBooks ? [book] : [],
    eResources: [{ title: "NPTEL course", url: "https://nptel.ac.in/courses/106105214" }],
    termWork: [{ activity: "Assignments", hours: Math.floor(o.twSlHours / 2) }],
    selfLearning: [{ activity: "Reading", hours: o.twSlHours - Math.floor(o.twSlHours / 2) }],
    outcomes: Array.from({ length: format.coMin }, (_, i) => ({
      statement: `${verb} the concepts of topic ${i + 1}.`,
      verb,
      level: apply.level,
      pos: [lists.pos[0].code],
      psos: {},
      wks: [],
      sdgs: [],
    })),
  };
}

async function pickSelect(page, label, option) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: typeof option === "string" }).click();
}

const dialog = (page) => page.getByRole("dialog");

test("a syllabus goes V1.0 → V4.0 with an expert's link review, is unlocked and re-approved as V4.1", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await signIn(page, "bos.cse@example.edu");

  const { path } = await addTestCourse(page);

  // A reviewer and an Internal BOS meeting, entered by the BoS Coordinator (D3).
  const reviewer = unique("Dr. Reviewer ");
  await page.goto("/departments/CSE");
  await page.getByRole("tab", { name: "Reviewers" }).click();
  await page.getByRole("button", { name: "Add reviewer" }).click();
  await dialog(page).getByLabel("Name").fill(reviewer);
  await dialog(page).getByLabel("Organisation").fill("KLS GIT");
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: reviewer })).toBeVisible();

  const venue = unique("Seminar Hall ");
  await page.getByRole("tab", { name: "Meetings" }).click();
  await page.getByRole("button", { name: "Add meeting" }).click();
  await dialog(page).getByLabel("Date and time").fill("2026-10-20T10:30");
  await dialog(page).getByLabel("Venue").fill(venue);
  await dialog(page).getByLabel(reviewer).check();
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(venue)).toBeVisible();

  // A complete working copy (the editor itself is covered by syllabus.spec.js).
  const editor = (await (await page.request.get(`/api${path}`)).json()).data;
  const saved = await page.request.put(`/api${path}`, { data: { revision: 0, content: completeContent(editor) } });
  expect(saved.ok()).toBe(true);

  // Submit → V1.0 for the Internal BOS.
  await page.goto(path);
  await page.getByRole("button", { name: "Submit as V1.0" }).click();
  await dialog(page).getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Internal BOS stage")).toBeVisible();
  await expect(page.getByText("V1.0", { exact: true })).toBeVisible();

  // The BoS Coordinator records an input from the meeting.
  await page.getByRole("link", { name: /Inputs, versions/ }).click();
  await page.getByRole("button", { name: "Record input" }).click();
  await pickSelect(page, "Section", "Unit 2");
  await pickSelect(page, "Given by", new RegExp(reviewer));
  await pickSelect(page, "Meeting", new RegExp(venue));
  await dialog(page).getByLabel("Input").fill("Add a topic on deadlock avoidance to unit 2.");
  await dialog(page).getByRole("button", { name: "Record input" }).click();
  await expect(page.getByText("Action pending")).toBeVisible();

  // A stage cannot close while an input is pending (rule 3).
  const refused = await page.request.post(`/api${path}/close`, { data: {} });
  expect(refused.status()).toBe(400);
  expect((await refused.json()).error).toMatch(/1 input still needs an action taken/);

  // The action taken is recorded, the input incorporated, and the stage closed → V2.0.
  await page.getByRole("button", { name: "Record action taken" }).click();
  await dialog(page).getByLabel("Action taken").fill("Deadlock avoidance (Banker's algorithm) added to unit 2.");
  await pickSelect(page, "Decision", "Accepted");
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Action pending")).toHaveCount(0);

  await page.goto(path);
  await page.getByLabel("Unit – II", { exact: true }).fill("Deadlocks and deadlock avoidance");
  await page.getByRole("button", { name: "Close Internal BOS" }).click();
  await dialog(page).getByRole("button", { name: "Close stage" }).click();
  await expect(page.getByText("Industry Experts & Alumni stage")).toBeVisible();
  await expect(page.getByText("V2.0", { exact: true })).toBeVisible();

  // An expert reviews V2.0 through a personal link, without signing in (rule 6).
  await page.getByRole("link", { name: /Inputs, versions/ }).click();
  await page.getByRole("tab", { name: "Expert links" }).click();
  await page.getByRole("button", { name: "Issue link" }).click();
  await pickSelect(page, "Expert", new RegExp(reviewer));
  await dialog(page).getByRole("button", { name: "Issue link" }).click();
  const linkUrl = await page.getByRole("textbox", { name: "Expert review link" }).inputValue();
  expect(linkUrl).toMatch(/\/expert\/[\w-]{43}$/);

  const expertContext = await browser.newContext(); // no session: the link is the credential
  const expert = await expertContext.newPage();
  await expert.goto(new URL(linkUrl).pathname);
  await expect(expert.getByRole("heading", { name: /E2E workflow test course/ })).toBeVisible();
  await expect(expert.frameLocator("iframe").getByText("Deadlocks and deadlock avoidance")).toBeVisible();
  await pickSelect(expert, "Section", "Unit 3");
  await expert.getByLabel("Comment").fill("Include a case study on Linux scheduling in unit 3.");
  const commentedAt = Date.now() - 1000;
  await expert.getByRole("button", { name: "Save comment" }).click();
  await expect(expert.getByText("Your comments (1)")).toBeVisible();

  // The BoS Coordinator is emailed about the comment (one digest for the expert's comments).
  await waitForMail("bos.cse@example.edu", commentedAt, /: 1 expert comment received/);

  // The comment arrives as an expert-stage input; the expert stage cannot close until it is answered.
  await page.getByRole("tab", { name: "Inputs" }).click();
  await page.reload();
  await expect(page.getByText(/through the review link/)).toBeVisible();
  expect((await page.request.post(`/api${path}/close`, { data: {} })).status()).toBe(400);
  await page.getByRole("button", { name: "Record action taken" }).click();
  await dialog(page).getByLabel("Action taken").fill("Case study on the Linux CFS scheduler added to unit 3.");
  await pickSelect(page, "Decision", "Accepted");
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Action pending")).toHaveCount(0);

  // Expert and External BOS stages close → V3.0, then the Academic Council approves → V4.0.
  expect((await page.request.post(`/api${path}/close`, { data: {} })).ok()).toBe(true);
  await expert.reload();
  await expect(expert.getByText("The expert review has closed")).toBeVisible();
  await expect(expert.getByRole("button", { name: "Save comment" })).toHaveCount(0);

  // A revoked link stops working at once.
  await page.getByRole("tab", { name: "Expert links" }).click();
  await page.getByRole("button", { name: "Revoke" }).click();
  await dialog(page).getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
  await expert.reload();
  await expect(expert.getByText("This link can no longer be used")).toBeVisible();
  await expertContext.close();

  expect((await page.request.post(`/api${path}/close`, { data: {} })).ok()).toBe(true);
  await page.goto(path);
  await page.reload();
  await expect(page.getByText("Academic Council stage")).toBeVisible();
  await page.getByRole("button", { name: "Close & approve" }).click();
  await dialog(page).getByLabel("Meeting reference").fill("AC/2026/14, item 5");
  const approvedAt = Date.now() - 1000;
  await dialog(page).getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Official: V4.0")).toBeVisible();
  // The HoD is told that the syllabus is now official.
  const approvedMail = await waitForMail("hod.cse@example.edu", approvedAt, /approved: V4\.0 is the official syllabus/);
  expect(approvedMail.text).toContain("AC/2026/14, item 5");
  await expect(page.getByLabel("Unit – I", { exact: true })).toBeDisabled();

  // Unlock for a correction → V4.1, approved again; V4.0 stays official until then.
  await page.getByRole("button", { name: "Unlock" }).click();
  await dialog(page).getByLabel("Reason for unlocking").fill("Correct a typing error in unit 1.");
  await dialog(page).getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Revising", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Unit – I", { exact: true }).fill("Introduction to operating systems");
  await page.getByRole("button", { name: "Save version" }).click();
  await dialog(page).getByLabel("What changed").fill("Typing error in unit 1 corrected.");
  await dialog(page).getByRole("button", { name: "Save version" }).click();
  await expect(page.getByText("V4.1", { exact: true })).toBeVisible();
  await expect(page.getByText("Official: V4.0")).toBeVisible();
  await page.getByRole("button", { name: "Record approval" }).click();
  await dialog(page).getByLabel("Meeting reference").fill("AC/2026/15, item 2");
  await dialog(page).getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Official: V4.1")).toBeVisible();

  // Approved versions print from a frozen PDF: the same bytes, with their checksum, every time.
  const review = (await (await page.request.get(`/api${path}/review`)).json()).data;
  const v40 = review.versions.find((v) => v.label === "V4.0");
  const first = await page.request.get(`/api${path}/versions/${v40.id}/pdf`);
  const again = await page.request.get(`/api${path}/versions/${v40.id}/pdf`);
  expect(first.headers()["x-document-sha256"]).toMatch(/^[0-9a-f]{64}$/);
  expect(again.headers()["x-document-sha256"]).toBe(first.headers()["x-document-sha256"]);
  const { createHash } = await import("node:crypto");
  expect(
    createHash("sha256")
      .update(await again.body())
      .digest("hex"),
  ).toBe(first.headers()["x-document-sha256"]);

  // The record: every version, the comparison, and the Action Taken reports.
  await page.getByRole("link", { name: /Inputs, versions/ }).click();
  await page.getByRole("tab", { name: "Versions" }).click();
  for (const label of ["V1.0", "V2.0", "V3.0", "V4.0", "V4.1"]) {
    await expect(page.getByRole("cell", { name: new RegExp(`^${label.replace(".", "\\.")}`) })).toBeVisible();
  }
  await expect(page.getByText(/1 section differs between V4.0 and V4.1/)).toBeVisible();

  await page.getByRole("tab", { name: "Action Taken report" }).click();
  await page.getByRole("tab", { name: /^Internal BOS/ }).click();
  const report = page.frameLocator("iframe");
  await expect(report.getByText("Action Taken Report – Post Internal BOS")).toBeVisible();
  await expect(report.getByText(reviewer)).toBeVisible();
  await expect(report.getByText(/Accepted · incorporated in V2.0/)).toBeVisible();
  await page.getByRole("tab", { name: /^Academic Council/ }).click();
  await expect(report.getByText("Correct a typing error in unit 1.")).toBeVisible();
});

test("only the BoS Coordinator can close a stage", async ({ page }) => {
  await signIn(page, "faculty.cse@example.edu");
  const home = (await (await page.request.get("/api/home")).json()).data;
  const own = home.assignments[0];
  test.skip(!own, "The faculty member has no assigned course.");
  const res = await page.request.post(`/api/syllabi/${own.schemeId}/${own.courseId}/close`, { data: {} });
  expect(res.status()).toBe(403);
});
