import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
/** Emails sent to `email` since `after` (epoch ms), from the development mail log. */
export async function mailsTo(email, after) {
  const log = await readFile(".local/mail.log", "utf8").catch(() => "");
  return log
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((m) => m.to === email && Date.parse(m.at) >= after);
}
/** Waits for a 6-digit code in a mail to `email` whose text matches `pattern`. */
export async function waitForCode(email, after, pattern) {
  let code = null;
  await expect
    .poll(
      async () => {
        const mail = (await mailsTo(email, after)).filter((m) => pattern.test(m.text)).at(-1);
        return (code = mail?.text.match(/(\d{6})/)?.[1] ?? null);
      },
      { timeout: 10_000, message: `no code was sent to ${email}` },
    )
    .not.toBeNull();
  return code;
}
/**
 * Waits for a workflow email to `email` sent after `after` whose subject matches `subject`, and
 * returns it. The API sends due notifications every few seconds; digests wait NOTIFY_DIGEST_SECONDS.
 */
export async function waitForMail(email, after, subject, timeout = 40_000) {
  let mail = null;
  await expect
    .poll(async () => (mail = (await mailsTo(email, after)).find((m) => subject.test(m.subject)) ?? null), {
      timeout,
      message: `no email matching ${subject} was sent to ${email}`,
    })
    .not.toBeNull();
  return mail;
}
/** Signs in a demo account through the development-only email-code form (code from the dev mail log). */
export async function signIn(page, email) {
  const started = Date.now() - 1000;
  await page.goto("/login");
  await page.getByRole("button", { name: "Demo accounts (development only)" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("Sign-in code")).toBeVisible();
  const code = await waitForCode(email, started, /sign-in code is/);
  await page.getByLabel("Sign-in code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  // Wait for the redirect to the home page, so a test's next navigation is not overtaken by it.
  await expect(page.getByRole("heading", { name: /^Welcome/ })).toBeVisible();
}
/** Fills in the password form on /login and submits it (does not wait for the result). */
export async function submitPassword(page, email, password) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with password" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
/**
 * Narrows the visible table to rows matching `text` (tables are paginated, so a row may not be on
 * the first page). Uses the toolbar's search box, like a person would.
 */
export async function searchTable(page, text) {
  await page.getByRole("searchbox").first().fill(text);
  await expect(page.getByRole("row").filter({ hasText: text }).first()).toBeVisible();
}
export const unique = (prefix) => `${prefix}${Date.now().toString(36).toUpperCase().slice(-5)}`;
