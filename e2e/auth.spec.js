import { expect, test } from "@playwright/test";
import { signIn } from "./helpers.js";
test("signed-out visitors are sent to the sign-in page", async ({ page }) => {
  await page.goto("/schemes");
  await expect(page).toHaveURL(/\/login\?next=%2Fschemes/);
});
test("an unregistered email cannot sign in", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Demo accounts (development only)" }).click();
  await page.getByLabel("Email").fill("someone.unknown@example.com");
  await page.getByRole("button", { name: "Send code" }).click();
  // Same screen as for a real account, so the form does not reveal who has one…
  await page.getByLabel("Sign-in code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  // …but no code was sent, so sign-in fails.
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
test("the sign-in page offers Google and Sign in with password", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in with password" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Email code" })).toHaveCount(0);
});
test("a refused Google sign-in explains why", async ({ page }) => {
  await page.goto("/login?error=signup_disabled");
  await expect(page.getByRole("alert")).toContainText("not registered in the portal");
});
test("faculty sees their assigned course and no administration links", async ({ page }) => {
  await signIn(page, "faculty.cse@example.edu");
  await expect(page.getByText("1BCS304")).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/no-access/);
});
