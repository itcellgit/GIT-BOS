import { expect, test } from "@playwright/test";
import { mailsTo, signIn, waitForMail } from "./helpers.js";

// Workflow emails (README §7 "Notifications"). In development they land in .local/mail.log, which
// these tests read. The sender runs every few seconds (NOTIFY_INTERVAL_SECONDS).
const FACULTY = "faculty.cse@example.edu";
const COURSE = "1BCS305"; // seeded, not assigned to anyone

async function assignCoAuthor(page) {
  await page.goto(`/departments/CSE?courses.q=${COURSE}`);
  const row = page.getByRole("row").filter({ hasText: COURSE });
  await row.getByRole("button", { name: "Assign" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Faculty member").click();
  await page.getByRole("option", { name: /^Faculty CSE \(demo\)/ }).click();
  await dialog.getByLabel("Role").click();
  await page.getByRole("option", { name: "Co-author" }).click();
  await dialog.getByRole("button", { name: "Assign" }).click();
  await expect(dialog).toBeHidden();
  return row;
}

async function removeAssignment(page, row) {
  await row
    .getByRole("listitem")
    .filter({ hasText: "Faculty CSE (demo)" })
    .getByRole("button", { name: "Remove assignment" })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(row.getByRole("listitem").filter({ hasText: "Faculty CSE (demo)" })).toHaveCount(0);
}

async function setEmails(page, on) {
  await page.goto("/account");
  const box = page.getByLabel("Send me workflow emails");
  if ((await box.isChecked()) !== on) {
    await box.click();
    await expect(page.getByText(on ? "Email notifications turned on" : "Email notifications turned off")).toBeVisible();
  }
  await expect(box).toBeChecked({ checked: on });
}

test.describe.configure({ mode: "serial" });

test("faculty get an email when assigned to a course; the email log shows it", async ({ page, browser }) => {
  const started = Date.now() - 1000;
  await signIn(page, "bos.cse@example.edu");
  const row = await assignCoAuthor(page);
  const mail = await waitForMail(FACULTY, started, new RegExp(`^${COURSE}: you are a co-author`));
  expect(mail.text).toMatch(/^Dear Faculty CSE \(demo\),/);
  expect(mail.text).toContain("Assigned by BoS Coordinator CSE (demo).");
  expect(mail.text).toMatch(/\/syllabi\/[^/\s]+\/[^/\s]+/);
  // The person who made the change is not emailed about it.
  expect((await mailsTo("bos.cse@example.edu", started)).filter((m) => m.subject.includes(COURSE))).toHaveLength(0);
  await removeAssignment(page, row);

  // The administrator sees it in the email log.
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, "it.admin@example.edu");
  await admin.goto(`/admin/emails?emails.q=${FACULTY}`);
  const logRow = admin.getByRole("row").filter({ hasText: "Assigned to a course" }).filter({ hasText: COURSE }).first();
  await expect(logRow).toContainText("Sent");
});

test("turning emails off in My account stops them, and turning them on again restores them", async ({
  page,
  browser,
}) => {
  const faculty = await (await browser.newContext()).newPage();
  await signIn(faculty, FACULTY);
  await setEmails(faculty, false);
  try {
    const started = Date.now() - 1000;
    await signIn(page, "bos.cse@example.edu");
    const row = await assignCoAuthor(page);
    // Give the sender several rounds: nothing may arrive.
    await page.waitForTimeout(8_000);
    expect((await mailsTo(FACULTY, started)).filter((m) => m.subject.includes(COURSE))).toHaveLength(0);
    await removeAssignment(page, row);
  } finally {
    await setEmails(faculty, true);
  }
});
