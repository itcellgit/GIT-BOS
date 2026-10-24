import { expect, test } from "@playwright/test";
import { searchTable, signIn, unique } from "./helpers.js";
test("Dean Academics creates a draft scheme by copying 2025, then deletes it", async ({ page }) => {
  await signIn(page, "dean@example.edu");
  await page.goto("/schemes");
  await page.getByRole("button", { name: "New scheme" }).click();
  const dialog = page.getByRole("dialog");
  const code = unique("T");
  await dialog.getByLabel("Code", { exact: true }).fill(code);
  await dialog.getByLabel("Name").fill(`Test Scheme ${code}`);
  await dialog.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { name: `Test Scheme ${code}` })).toBeVisible();
  await expect(page.getByText("Copied from 2025 Scheme")).toBeVisible();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  // Layer 1 configuration came across with the copy.
  await expect(page.getByRole("cell", { name: /^IPCC/ })).toBeVisible();
  await page.getByRole("tab", { name: "Outcome lists" }).click();
  await expect(page.getByText("Life-Long Learning")).toBeVisible();
  await page.getByRole("button", { name: "Delete draft" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/schemes$/);
  await expect(page.getByText(`Test Scheme ${code}`)).toHaveCount(0);
});
test("Administrator adds a user and gives them a department role", async ({ page }) => {
  await signIn(page, "it.admin@example.edu");
  await page.goto("/admin/users");
  const email = `${unique("e2e").toLowerCase()}@example.edu`;
  await page.getByRole("button", { name: "Add user" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("E2E Test Faculty");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await searchTable(page, email);
  const row = page.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: "Add role" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Department").click();
  await page.getByRole("option", { name: /^CSE — / }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("Faculty · CSE")).toBeVisible();
  // A department role needs a department.
  await row.getByRole("button", { name: "Add role" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Role").click();
  await page.getByRole("option", { name: "Head of Department" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Choose the department for this role")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  // Deactivate so the test user cannot sign in.
  await row.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog").getByLabel("Active (can sign in)").click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("inactive")).toBeVisible();
});
test("BoS Coordinator assigns faculty to a course and removes the assignment", async ({ page }) => {
  // Works whatever else is assigned to the course: the test adds and removes only its own co-author.
  const person = "BoS Coordinator CSE (demo)";
  await signIn(page, "bos.cse@example.edu");
  await page.goto("/departments/CSE?courses.q=1BCS303");
  const row = page.getByRole("row").filter({ hasText: "1BCS303" });
  const mine = row.getByRole("listitem").filter({ hasText: person });
  await expect(mine).toHaveCount(0);
  await row.getByRole("button", { name: "Assign" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Faculty member").click();
  await page.getByRole("option", { name: person }).click();
  await dialog.getByLabel("Role").click();
  await page.getByRole("option", { name: "Co-author" }).click();
  await dialog.getByRole("button", { name: "Assign" }).click();
  await expect(mine).toContainText("(Co-author)");
  // Remove it again so the test leaves the data as it found it.
  await mine.getByRole("button", { name: "Remove assignment" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(mine).toHaveCount(0);
});
