import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { mailsTo, searchTable, signIn, submitPassword, unique, waitForCode } from "./helpers.js";
// A dedicated Super Admin for these tests. `npm run super-admin` resets it before the run,
// exactly as an operator would on the server, so the tests can be repeated.
const EMAIL = "superadmin.e2e@example.edu";
const INITIAL = "Initial-pass-2026";
const CHOSEN = "Chosen-pass-2026";
const RESET = "Reset-pass-2026x";
test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  execFileSync(
    process.execPath,
    [
      "--env-file-if-exists=.env",
      "backend/scripts/super-admin.js",
      "--email",
      EMAIL,
      "--password",
      INITIAL,
      "--name",
      "Super Admin (e2e test)",
    ],
    { stdio: "pipe" },
  );
});
async function changePassword(page, current, next, confirm = next) {
  await page.getByLabel(/Current (\(temporary\) )?password/).fill(current);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password").fill(confirm);
  await page.getByRole("button", { name: "Change password" }).click();
}
test("first sign-in with the initial password forces a password change", async ({ page }) => {
  await submitPassword(page, EMAIL, INITIAL);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Choose your own password to continue")).toBeVisible();
  // Every other page sends the user back here until the password is changed.
  await page.goto("/schemes");
  await expect(page).toHaveURL(/\/account$/);
  // The policy and the current password are checked.
  await changePassword(page, INITIAL, "short1");
  await expect(page.getByText("Use at least 12 characters")).toBeVisible();
  await changePassword(page, "Wrong-current-2026", CHOSEN);
  await expect(page.getByText("Incorrect password")).toBeVisible();
  await changePassword(page, INITIAL, CHOSEN);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
});
test("signs in with the chosen password; the old one no longer works", async ({ page }) => {
  await submitPassword(page, EMAIL, INITIAL);
  await expect(page.getByRole("alert")).toHaveText("The email or password is incorrect.");
  await submitPassword(page, EMAIL, CHOSEN);
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
});
test("has full access: administration, scheme configuration and every department", async ({ page }) => {
  await submitPassword(page, EMAIL, CHOSEN);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await page.goto("/schemes");
  await expect(page.getByRole("button", { name: "New scheme" })).toBeVisible();
  await page.goto("/departments/MATH");
  await page.getByRole("tab", { name: "Reviewers" }).click();
  await expect(page.getByRole("button", { name: "Add reviewer" })).toBeVisible();
});
test("forgot password: reset with an emailed code", async ({ page }) => {
  const started = Date.now() - 1000;
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with password" }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByRole("button", { name: "Send reset code" }).click();
  const code = await waitForCode(EMAIL, started, /password reset code/);
  await page.getByLabel("Reset code").fill(code);
  await page.getByLabel("New password", { exact: true }).fill(RESET);
  await page.getByLabel("Confirm new password").fill(RESET);
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("Password reset. Sign in with your new password.")).toBeVisible();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(RESET);
  await page.getByRole("button", { name: "Sign in" }).click();
  // A self-chosen password does not need changing again.
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
});
test("a Super Admin makes another Super Admin and sets their initial password", async ({ page, browser }) => {
  const email = `${unique("e2e-sa").toLowerCase()}@example.edu`;
  const initial = "Colleague-init-2026";
  const chosen = "Colleague-own-2026";
  await submitPassword(page, EMAIL, RESET);
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Add user" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("E2E Second Super Admin");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await searchTable(page, email);
  const row = page.getByRole("row").filter({ hasText: email });
  // Only Super Admin rows offer a password.
  await expect(row.getByRole("button", { name: "Set password" })).toHaveCount(0);
  await row.getByRole("button", { name: "Add role" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Role").click();
  await page.getByRole("option", { name: "Super Admin" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("No password set")).toBeVisible();
  // The password policy applies here too.
  await row.getByRole("button", { name: "Set password" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Initial password").fill("short1");
  await dialog.getByLabel("Confirm password").fill("short1");
  await dialog.getByRole("button", { name: "Set password" }).click();
  await expect(dialog.getByText("Use at least 12 characters")).toBeVisible();
  await dialog.getByLabel("Initial password").fill(initial);
  await dialog.getByLabel("Confirm password").fill(initial);
  await dialog.getByRole("button", { name: "Set password" }).click();
  await expect(dialog).toBeHidden();
  await expect(row.getByText("must change at next sign-in")).toBeVisible();
  await expect(row.getByRole("button", { name: "Reset password" })).toBeVisible();
  // Nobody offers to set their own password from this page.
  await searchTable(page, EMAIL);
  const ownRow = page.getByRole("row").filter({ hasText: EMAIL });
  await expect(ownRow.getByRole("button", { name: /(Set|Reset) password/ })).toHaveCount(0);

  // The new Super Admin signs in with the initial password and must replace it.
  const context = await browser.newContext();
  const other = await context.newPage();
  await submitPassword(other, email, initial);
  await expect(other).toHaveURL(/\/account$/);
  await expect(other.getByText("Choose your own password to continue")).toBeVisible();
  await changePassword(other, initial, chosen);
  await expect(other.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  await context.close();

  // Clean up: deactivate the test account (another active Super Admin remains).
  await page.reload();
  await searchTable(page, email);
  await row.getByRole("button", { name: "Edit" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Active (can sign in)").click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("inactive")).toBeVisible();
});
test("people who are not Super Admins cannot reset a password by email", async ({ page }) => {
  const started = Date.now() - 1000;
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with password" }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill("faculty.cse@example.edu");
  await page.getByRole("button", { name: "Send reset code" }).click();
  // Same screen as for a Super Admin (nothing is revealed)…
  await expect(page.getByLabel("Reset code")).toBeVisible();
  // …but no code is sent, and a guessed code is refused.
  await page.waitForTimeout(1500);
  expect((await mailsTo("faculty.cse@example.edu", started)).filter((m) => /reset/.test(m.text))).toHaveLength(0);
  await page.getByLabel("Reset code").fill("123456");
  await page.getByLabel("New password", { exact: true }).fill("Faculty-pass-2026");
  await page.getByLabel("Confirm new password").fill("Faculty-pass-2026");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("alert")).toHaveText("Incorrect or expired code");
  await submitPassword(page, "faculty.cse@example.edu", "Faculty-pass-2026");
  await expect(page.getByRole("alert")).toHaveText("The email or password is incorrect.");
});
test("a Super Admin resets a user's password to the default; the user must replace it", async ({ page, browser }) => {
  await submitPassword(page, EMAIL, RESET);
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  await page.goto("/admin/users?users.q=hod.cse@example.edu");
  const row = page.getByRole("row").filter({ hasText: "hod.cse@example.edu" });
  await row.getByRole("button", { name: "Reset to default" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset password" }).click();
  await expect(row.getByText("Password sign-in")).toBeVisible();
  // No reset button on your own row.
  await searchTable(page, EMAIL);
  const ownRow = page.getByRole("row").filter({ hasText: EMAIL });
  await expect(ownRow.getByRole("button", { name: "Reset to default" })).toHaveCount(0);
  // The user signs in with the default password and must replace it before doing anything else
  // (README D18, revised 24 Oct 2026: the default is shared knowledge).
  const other = await (await browser.newContext()).newPage();
  await submitPassword(other, "hod.cse@example.edu", "Password@123");
  await expect(other).toHaveURL(/\/account$/);
  await expect(other.getByText("Choose your own password to continue")).toBeVisible();
  await changePassword(other, "Password@123", "Hod-own-pass-2026");
  await expect(other.getByRole("heading", { name: /Welcome/ })).toBeVisible();
});
test("an ordinary Administrator cannot create or change Super Admins", async ({ page }) => {
  await signIn(page, "it.admin@example.edu");
  await page.goto(`/admin/users?users.q=${EMAIL}`);
  const superRow = page.getByRole("row").filter({ hasText: EMAIL });
  await expect(superRow.getByText("Managed by Super Admins")).toBeVisible();
  await expect(superRow.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await searchTable(page, "faculty.cse@example.edu");
  const facultyRow = page.getByRole("row").filter({ hasText: "faculty.cse@example.edu" });
  await facultyRow.getByRole("button", { name: "Add role" }).click();
  await page.getByRole("dialog").getByLabel("Role").click();
  await expect(page.getByRole("option", { name: "Administrator" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Super Admin" })).toHaveCount(0);
});
