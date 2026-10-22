// Creates or repairs a Super Admin account. Used by the seed (first install) and by
// `npm run super-admin` (recovery, e.g. when the password is lost). See README "Super Admin".
import { hashPassword } from "better-auth/crypto";
import { passwordProblem } from "@acp/shared/schemas/account";
export async function ensureSuperAdmin(db, input) {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error(`Invalid Super Admin email: "${input.email}"`);
  if (input.password) {
    const problem = passwordProblem(input.password);
    if (problem) throw new Error(`SUPER_ADMIN_PASSWORD is not strong enough: ${problem}.`);
  }
  const user = await db.user.upsert({
    where: { email },
    update: { isActive: true },
    create: { email, name: input.name, emailVerified: true },
  });
  const hasRole = await db.roleAssignment.findFirst({ where: { userId: user.id, role: "SUPER_ADMIN" } });
  if (!hasRole) await db.roleAssignment.create({ data: { userId: user.id, role: "SUPER_ADMIN", departmentId: null } });
  const credential = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
  let passwordSet = false;
  if (input.password && (!credential || input.resetPassword)) {
    const hash = await hashPassword(input.password);
    await db.$transaction(async (tx) => {
      if (credential) await tx.account.update({ where: { id: credential.id }, data: { password: hash } });
      else
        await tx.account.create({
          data: { userId: user.id, providerId: "credential", accountId: user.id, password: hash },
        });
      await tx.user.update({ where: { id: user.id }, data: { passwordChangeRequired: true } });
      if (input.resetPassword) await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: input.resetPassword ? "superAdmin.passwordReset" : "superAdmin.create",
          entityType: "User",
          entityId: user.id,
          details: { email, via: "command line" },
        },
      });
    });
    passwordSet = true;
  }
  return { user, passwordSet, hadPassword: !!credential };
}
