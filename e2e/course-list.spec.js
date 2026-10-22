import ExcelJS from "exceljs";
import { expect, test } from "@playwright/test";
import { signIn, unique } from "./helpers.js";
async function openCseCourseList(page) {
  await page.goto("/departments/CSE");
  await page.getByRole("tab", { name: "Programme course lists" }).click();
  await page.getByRole("link", { name: "2025 Scheme course list" }).click();
  await expect(page.getByRole("heading", { name: "BE-CSE — course list" })).toBeVisible();
}
async function chooseOption(page, label, option) {
  await page.getByRole("dialog").getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option }).click();
}
async function removeCourse(page, code) {
  const row = page.getByRole("row").filter({ hasText: code });
  await row.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("row").filter({ hasText: code })).toHaveCount(0);
}
const HEADERS = [
  "Semester",
  "Course Code",
  "Course Title",
  "Category",
  "Format",
  "Teaching Department",
  "L Credits",
  "T Credits",
  "P Credits",
  "L Hours",
  "T Hours",
  "P Hours",
  "TW&SL Hours",
  "CIE Marks",
  "SEE Marks",
  "Exam Hours",
  "Elective Group",
];
async function workbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Courses");
  ws.addRow(HEADERS);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
test.describe("BoS Coordinator course list", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "bos.cse@example.edu");
    await openCseCourseList(page);
  });
  test("shows the seeded 2025 courses, all matching the scheme rules", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Semester 3" })).toBeVisible();
    await expect(page.getByText("20 credits (one option counted per elective group)")).toBeVisible();
    await expect(page.getByText("23 credits (one option counted per elective group)")).toBeVisible();
    await expect(page.getByText(/do not match the current scheme rules/)).toHaveCount(0);
  });
  test("adds a course using the credit-pattern helper, and rejects wrong hours", async ({ page }) => {
    const code = unique("1BTST");
    await page.getByRole("button", { name: "Add course" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Semester", { exact: true }).fill("4");
    await dialog.getByLabel("Course code").fill(code);
    await dialog.getByLabel("Course title").fill("Test Course for E2E");
    await chooseOption(page, "Category", /^PCC — /);
    await dialog.getByRole("button", { name: "3:0:0 · 3:0:0 h/wk" }).click();
    await expect(dialog.getByLabel("L hours (semester)")).toHaveValue("42");
    await expect(dialog.getByLabel("TW & SL hours")).toHaveValue("48");
    await expect(dialog.getByText("✓ Matches the scheme rules.")).toBeVisible();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    const row = page.getByRole("row").filter({ hasText: code });
    await expect(row.getByText("OK")).toBeVisible();
    // Wrong lecture hours: the live check warns and the server refuses to save.
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("dialog").getByLabel("L hours (semester)").fill("40");
    await expect(
      page
        .getByRole("dialog")
        .getByText(/Lecture hours should be 42/)
        .first(),
    ).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog").getByText("The course does not match the scheme rules.")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await removeCourse(page, code);
  });
  test("imports from Excel only when every row is valid", async ({ page }) => {
    const good = unique("1BIMP");
    const bad = unique("1BBAD");
    const goodRow = [4, good, "Imported Course", "PCC", "THEORY", "CSE", 3, 0, 0, 42, 0, 0, 48, 100, 100, 3, ""];
    const badRow = [4, bad, "Wrong Hours", "PCC", "THEORY", "CSE", 3, 0, 0, 40, 0, 0, 48, 100, 100, 3, ""];
    await page.getByRole("button", { name: "Import from Excel" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "courses.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await workbook([goodRow, badRow]),
    });
    await dialog.getByRole("button", { name: "Upload and import" }).click();
    await expect(dialog.getByText("Nothing was imported.")).toBeVisible();
    await expect(dialog.getByText(/Row 3/)).toBeVisible();
    await expect(dialog.getByText(/Lecture hours should be 42/)).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "courses.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await workbook([goodRow]),
    });
    await dialog.getByRole("button", { name: "Upload and import" }).click();
    await expect(dialog.getByText("1 course(s) imported successfully.")).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
    await expect(page.getByRole("row").filter({ hasText: good })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: bad })).toHaveCount(0);
    await removeCourse(page, good);
  });
});
test("HoD can view the course list but not change it", async ({ page }) => {
  await signIn(page, "hod.cse@example.edu");
  await openCseCourseList(page);
  await expect(page.getByRole("button", { name: "Add course" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Import from Excel" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Download Excel" })).toBeVisible();
});
