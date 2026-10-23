import { expect, test } from "@playwright/test";
import { signIn, unique } from "./helpers.js";

// Phase 3: the Integrated and Lab/AEC formats have their own editor sections and print layout
// (README Appendix B). The seed has 1BCSL307 (Lab, PCCL) and 1BCS403 (Integrated, IPCC) for CSE.
const saved = (page) => expect(page.getByText(/^(Saved at|All changes saved)/)).toBeVisible({ timeout: 10_000 });

async function openCourse(page, code) {
  await page.goto("/departments/CSE");
  await page.getByRole("link", { name: code, exact: true }).first().click();
  await expect(page.getByRole("heading", { name: new RegExp(code) })).toBeVisible();
}

test("a Lab syllabus lists experiments instead of units, and prints them", async ({ page }) => {
  await signIn(page, "bos.cse@example.edu");
  await openCourse(page, "1BCSL307");
  await expect(page.locator("#experiments")).toBeVisible();
  await expect(page.locator("#units")).toHaveCount(0);
  await expect(page.locator("#flipped")).toHaveCount(0);
  await expect(page.getByLabel("Open-ended experiment 2", { exact: true })).toBeVisible();

  const title = unique("Implement a singly linked list ");
  await page.getByLabel("Experiment 1", { exact: true }).fill(title);
  await page.getByLabel("Experiment 1 hours", { exact: true }).fill("2");
  await expect(page.locator("#experiments").getByText("2 / 28 hours")).toBeVisible();
  await saved(page);

  await page.getByRole("button", { name: "Preview & PDF" }).click();
  const sheet = page.frameLocator("iframe[title^='Print preview']");
  await expect(sheet.getByText("List of Experiments")).toBeVisible();
  await expect(sheet.getByText(title)).toBeVisible();
  await expect(sheet.getByText("Required Knowledge of")).toBeVisible();
});

test("an Integrated syllabus has both units and a practical component", async ({ page }) => {
  await signIn(page, "bos.cse@example.edu");
  await openCourse(page, "1BCS403");
  await expect(page.locator("#units")).toBeVisible();
  await expect(page.locator("#experiments").getByText("Practical component")).toBeVisible();
  await expect(page.getByLabel("Experiment 10", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Open-ended experiment 3", { exact: true })).toBeVisible();
});
