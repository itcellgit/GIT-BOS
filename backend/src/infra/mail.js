import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

/** Repository-root .local folder (development only). */
const localDir = fileURLToPath(new URL("../../../.local", import.meta.url));
/** Reserved test domains (RFC 2606/6761), used by the demo accounts: mail to them is never deliverable. */
const isTestAddress = (to) => /@([\w-]+\.)*(example\.(com|edu|org|net)|[\w-]+\.(test|invalid|localhost))$/i.test(to);

/**
 * Sends an email through SMTP. Development keeps a copy of every message in .local/mail.log (end-to-end
 * tests read sign-in codes from it) and prints, instead of sending, mail to reserved test domains or
 * any mail when SMTP_HOST is empty. Production refuses to run without SMTP.
 */
export async function sendMail(message) {
  const host = process.env.SMTP_HOST;
  const production = process.env.NODE_ENV === "production";
  if (!host && production) throw new Error("SMTP_HOST is not configured; cannot send email in production.");
  if (!production) {
    await mkdir(localDir, { recursive: true });
    await appendFile(join(localDir, "mail.log"), JSON.stringify({ ...message, at: new Date().toISOString() }) + "\n");
    if (!host || isTestAddress(message.to)) {
      console.log(`\n[mail] To: ${message.to}\n[mail] Subject: ${message.subject}\n[mail] ${message.text}\n`);
      return;
    }
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transporter.sendMail({ from: process.env.MAIL_FROM, ...message });
}
