// Creates the Super Admin, or resets their password if it is lost.
//
//   npm run super-admin                         uses SUPER_ADMIN_EMAIL / _NAME / _PASSWORD from .env
//   npm run super-admin -- --email a@b.edu --password "..." [--name "Full Name"]
//
// On the server:  docker compose run --rm app npm run super-admin
// The account is (re)activated, gets the Super Admin role, all its sessions are signed out,
// and the user must choose a new password at the next sign-in.
import "../src/config/load-env.js";
import { parseArgs } from "node:util";
import { createDb } from "../src/infra/db.js";
import { ensureSuperAdmin } from "../prisma/super-admin.js";
const { values } = parseArgs({
  options: { email: { type: "string" }, password: { type: "string" }, name: { type: "string" } },
});
const email = values.email ?? process.env.SUPER_ADMIN_EMAIL;
const password = values.password ?? process.env.SUPER_ADMIN_PASSWORD;
const name = values.name ?? process.env.SUPER_ADMIN_NAME ?? "Super Admin";
if (!email || !password) {
  console.error("Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env, or pass --email and --password.");
  process.exit(1);
}
async function main() {
  const db = createDb();
  try {
    const result = await ensureSuperAdmin(db, { email: email, name, password, resetPassword: true });
    console.log(`Super Admin ready: ${result.user.email}`);
    console.log(
      result.hadPassword ? "Password reset; all sessions signed out." : "Password set.",
      "A new password must be chosen at the next sign-in.",
    );
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
void main();
