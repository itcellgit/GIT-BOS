import { expect, test } from "@playwright/test";
import { signIn } from "./helpers.js";

// Dashboards (Phase 4): progress by department / programme / semester, and the courses behind a bar.
// Set SCREENSHOT_DIR to save light and dark screenshots for a visual check.

test("Dean Academics sees syllabus progress and drills into a bar", async ({ page }) => {
  await signIn(page, "dean@example.edu");
  await expect(page.getByRole("heading", { name: /^Welcome/ })).toBeVisible(); // the redirect after sign-in
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Courses needing a syllabus")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Scheme" })).toContainText("2025 Scheme");

  // By department: CSE has a bar with one segment per step present.
  await page.getByRole("tab", { name: "Department" }).click();
  const cse = page.getByRole("group", { name: "CSE: progress" });
  await expect(cse).toBeVisible();
  const segment = cse.getByRole("button").first();
  await segment.hover();
  await expect(page.getByRole("tooltip")).toContainText(/of \d+/);

  // Clicking a segment lists those courses.
  const label = (await segment.getAttribute("aria-label")).split(":")[0];
  await segment.click();
  await expect(page.getByText(`CSE · ${label}`)).toBeVisible();
  await page.getByRole("button", { name: "Show all" }).click();
  await expect(page.getByText("All courses")).toBeVisible();

  // The same counts as a table.
  await page.getByRole("tab", { name: "Semester" }).click();
  await page.getByRole("button", { name: "Show table" }).click();
  await expect(page.getByRole("cell", { name: "Semester 3" })).toBeVisible();

  if (process.env.SCREENSHOT_DIR) {
    await page.getByRole("button", { name: "Show bars" }).click();
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/dashboard-light.png`, fullPage: false });
    await page.evaluate(() => localStorage.setItem("acp-theme", "dark"));
    await page.reload();
    await expect(page.getByRole("group", { name: "CSE: progress" })).toBeVisible();
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/dashboard-dark.png`, fullPage: false });
  }
});

test("Faculty see only the courses assigned to them", async ({ page }) => {
  await signIn(page, "faculty.cse@example.edu");
  await expect(page.getByRole("heading", { name: /^Welcome/ })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: /1BCS304/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /1BCS303/ })).toHaveCount(0);
});
