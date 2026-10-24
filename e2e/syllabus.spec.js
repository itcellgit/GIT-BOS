import { expect, test } from "@playwright/test";
import { signIn, unique } from "./helpers.js";

// The seed assigns faculty.cse@example.edu to 1BCS304 (Data Structures) in the 2025 scheme.
const COURSE = /1BCS304/;
const saved = (page) => expect(page.getByText(/^(Saved at|All changes saved)/)).toBeVisible({ timeout: 10_000 });

async function openFromHome(page) {
  await page.getByRole("link", { name: COURSE }).click();
  await expect(page.getByRole("heading", { name: COURSE })).toBeVisible();
}

test("faculty frame a Theory syllabus; changes are saved automatically", async ({ page }) => {
  await signIn(page, "faculty.cse@example.edu");
  await openFromHome(page);
  // The header comes from the scheme.
  await expect(page.getByRole("cell", { name: "PCC" })).toBeVisible();

  const title = unique("Arrays and lists ");
  await page.getByLabel("Unit – I", { exact: true }).fill(title);
  await page.locator("#unit-0-hours").fill("9");
  await page.getByLabel("Objective 1", { exact: true }).fill("Introduce linear data structures.");
  await page.getByLabel("CO1 statement").fill("Apply stacks and queues to solve problems.");
  await page.getByLabel("CO1 learning level").click();
  await page.getByRole("option", { name: /Apply/ }).click();
  await page.getByLabel("CO1 PO1", { exact: true }).check();
  await page.getByLabel("Term work (TW) activity 1").fill("Assignments");
  await page.getByLabel("Term work (TW) hours 1").fill("20");
  await saved(page);

  await page.reload();
  await expect(page.getByLabel("Unit – I", { exact: true })).toHaveValue(title);
  await expect(page.locator("#unit-0-hours")).toHaveValue("9");
  await expect(page.getByLabel("CO1 PO1", { exact: true })).toBeChecked();
  await expect(page.getByLabel("CO1 learning level")).toHaveText(/Apply/);
});

test("the HoD can read a syllabus but not change it", async ({ page }) => {
  await signIn(page, "hod.cse@example.edu");
  await page.goto("/departments/CSE?courses.q=1BCS304");
  await page.getByRole("link", { name: COURSE }).first().click();
  await expect(page.getByRole("heading", { name: COURSE })).toBeVisible();
  await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Unit – I", { exact: true })).toBeDisabled();
});

test("simultaneous edits never overwrite each other silently", async ({ page, browser }) => {
  // Two editors open the same syllabus: the Course Coordinator and the BoS Coordinator.
  await signIn(page, "faculty.cse@example.edu");
  await openFromHome(page);
  const context = await browser.newContext();
  const other = await context.newPage();
  await signIn(other, "bos.cse@example.edu");
  await other.goto("/departments/CSE?courses.q=1BCS304");
  await other.getByRole("link", { name: COURSE }).first().click();
  await expect(other.getByLabel("Unit – II", { exact: true })).toBeEditable();

  const first = unique("Saved first ");
  await page.getByLabel("Unit – II", { exact: true }).fill(first);
  await saved(page);

  // The second editor still has the older copy: their save is refused, not applied.
  await other.getByLabel("Unit – II", { exact: true }).fill(unique("Saved second "));
  await expect(other.getByText("Your latest changes were not saved")).toBeVisible({ timeout: 10_000 });
  await other.getByRole("button", { name: "Load the saved version" }).click();
  await expect(other.getByLabel("Unit – II", { exact: true })).toHaveValue(first);
  await context.close();
});

test("the editor checks the syllabus against the scheme rules as faculty type", async ({ page }) => {
  await signIn(page, "faculty.cse@example.edu");
  await openFromHome(page);
  const checks = page.locator("#checks");
  await expect(checks.getByText(/\d+ errors?/)).toBeVisible();
  // A new syllabus has many issues, so the list starts collapsed: open it.
  const showList = checks.getByText("Show the list");
  if (await showList.isVisible()) await showList.click();

  // A unit-hours total that does not match the scheme is reported, and the message follows the input.
  await page.locator("#unit-0-hours").fill("40");
  await expect(checks.getByText(/^Unit hours add up to \d+; the scheme has 42 lecture hours\.$/)).toBeVisible();

  // A verb that does not belong to the chosen learning level is an error.
  await page.locator("#co-0-verb").fill("design");
  await expect(checks.getByText("CO1: “design” is a Create verb, but the level is Apply.")).toBeVisible();
  await page.locator("#co-0-verb").fill("apply");
  await expect(checks.getByText(/CO1: “design”/)).toHaveCount(0);

  // Coverage (warning): ticking the units a CO is based on clears "not covered" for that unit.
  const unit2 = page.getByLabel("CO1 is based on unit 2");
  if (await unit2.isChecked()) await unit2.uncheck();
  const notCovered = checks.getByText(/not covered by any CO/);
  await expect(notCovered).toHaveText(/(^|[^I])II([^I]|$)/);
  await unit2.check();
  await expect(notCovered).not.toHaveText(/(^|[^I])II([^I]|$)/);
  await unit2.uncheck();
  await saved(page);
});

test("the print preview shows the saved syllabus, and the PDF downloads", async ({ page }) => {
  await signIn(page, "faculty.cse@example.edu");
  await openFromHome(page);
  const title = unique("Linked lists ");
  await page.getByLabel("Unit – III", { exact: true }).fill(title);

  // Opening the preview saves pending changes first.
  await page.getByRole("button", { name: "Preview & PDF" }).click();
  await expect(page.getByRole("heading", { name: /1BCS304 — print preview/ })).toBeVisible();
  const sheet = page.frameLocator("iframe[title^='Print preview']");
  await expect(sheet.getByText("DATA STRUCTURES AND APPLICATIONS", { exact: true })).toBeVisible();
  await expect(sheet.getByText(`Unit – III: ${title}`)).toBeVisible();
  await expect(sheet.getByText("Scheme of Semester End Examination (SEE)")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("1BCS304_syllabus_draft.pdf");
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(await file.path());
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
});

test("only people who may view a syllabus can download its PDF", async ({ page, request }) => {
  await signIn(page, "faculty.cse@example.edu");
  await openFromHome(page);
  const pdfUrl = new URL(page.url()).pathname.replace(/^\/syllabi/, "/api/syllabi") + "/pdf";
  // Signed out: refused.
  const anonymous = await request.get(pdfUrl);
  expect(anonymous.status()).toBe(401);
});
