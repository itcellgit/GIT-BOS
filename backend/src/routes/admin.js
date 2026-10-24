// Administration: users, roles, departments and programmes.
import { Router } from "express";
import { hashPassword } from "better-auth/crypto";
import { can } from "@acp/shared/domain/auth/permissions";
import { initialPasswordSchema, passwordProblem } from "@acp/shared/schemas/account";
import {
  departmentSchema,
  institutionSchema,
  programmeSchema,
  roleAssignmentSchema,
  userSchema,
} from "@acp/shared/schemas/config";
import multer from "multer";
import { assertPermission } from "../auth/session.js";
import { NotFoundError, UserError } from "../errors.js";
import { handle, sendError } from "../http/handler.js";
import { db } from "../infra/db.js";
import { writeAudit } from "../services/audit.js";
import { logoPath, logoTypeOf, MAX_LOGO_BYTES } from "../services/institution.js";

export const adminRouter = Router();

// --- Institution (branding printed on every document; README §5) -----------------------

async function institutionView() {
  const row = await db.institutionSettings.findUnique({ where: { id: 1 } });
  const { logo, logoType: _t, logoPath: _p, ...fields } = row ?? { name: "" };
  return { ...fields, logoUrl: logo ? logoPath(row.updatedAt.getTime()) : null };
}

adminRouter.get(
  "/institution",
  handle(null, async (_data, req) => {
    assertPermission(req, "institution.manage");
    return institutionView();
  }),
);

adminRouter.put(
  "/institution",
  handle(
    institutionSchema,
    async (data, req) => {
      const actor = assertPermission(req, "institution.manage");
      await db.$transaction(async (tx) => {
        await tx.institutionSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
        await writeAudit(
          { actorId: actor.id, action: "institution.update", entityType: "Institution", details: data },
          tx,
        );
      });
    },
    "Institution details saved",
  ),
);

const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_LOGO_BYTES } });

adminRouter.post(
  "/institution/logo",
  (req, res, next) =>
    logoUpload.single("logo")(req, res, (err) =>
      err
        ? sendError(
            res,
            new UserError(err.code === "LIMIT_FILE_SIZE" ? "The logo must be 200 KB or smaller." : err.message),
          )
        : next(),
    ),
  handle(
    null,
    async (_data, req) => {
      const actor = assertPermission(req, "institution.manage");
      if (!req.file?.size) throw new UserError("Choose a PNG or JPEG image.");
      const type = logoTypeOf(req.file.buffer);
      if (!type) throw new UserError("The logo must be a PNG or JPEG image.");
      await db.$transaction(async (tx) => {
        await tx.institutionSettings.update({ where: { id: 1 }, data: { logo: req.file.buffer, logoType: type } });
        await writeAudit(
          {
            actorId: actor.id,
            action: "institution.logo",
            entityType: "Institution",
            details: { type, bytes: req.file.size },
          },
          tx,
        );
      });
      return institutionView();
    },
    "Logo saved. It prints on documents made from now on; approved PDFs keep theirs.",
  ),
);

adminRouter.delete(
  "/institution/logo",
  handle(
    null,
    async (_data, req) => {
      const actor = assertPermission(req, "institution.manage");
      await db.$transaction(async (tx) => {
        await tx.institutionSettings.update({ where: { id: 1 }, data: { logo: null, logoType: null } });
        await writeAudit({ actorId: actor.id, action: "institution.logoRemove", entityType: "Institution" }, tx);
      });
    },
    "Logo removed",
  ),
);

// --- Departments and programmes -------------------------------------------------

adminRouter.get(
  "/departments",
  handle(null, async (_data, req) => {
    assertPermission(req, "departments.manage");
    return db.department.findMany({ orderBy: { code: "asc" }, include: { programmes: { orderBy: { code: "asc" } } } });
  }),
);

const saveDepartment = handle(
  departmentSchema,
  async (data, req) => {
    const departmentId = req.params.id ?? null;
    const actor = assertPermission(req, "departments.manage");
    await db.$transaction(async (tx) => {
      const row = departmentId
        ? await tx.department.update({ where: { id: departmentId }, data })
        : await tx.department.create({ data });
      await writeAudit(
        {
          actorId: actor.id,
          action: departmentId ? "department.update" : "department.create",
          entityType: "Department",
          entityId: row.id,
          details: data,
        },
        tx,
      );
    });
  },
  "Department saved",
);
adminRouter.post("/departments", saveDepartment);
adminRouter.put("/departments/:id", saveDepartment);

const saveProgramme = handle(
  programmeSchema,
  async (data, req) => {
    const programmeId = req.params.id ?? null;
    const actor = assertPermission(req, "departments.manage");
    await db.$transaction(async (tx) => {
      const row = programmeId
        ? await tx.programme.update({ where: { id: programmeId }, data })
        : await tx.programme.create({ data });
      await writeAudit(
        {
          actorId: actor.id,
          action: programmeId ? "programme.update" : "programme.create",
          entityType: "Programme",
          entityId: row.id,
          departmentId: data.departmentId,
          details: data,
        },
        tx,
      );
    });
  },
  "Programme saved",
);
adminRouter.post("/programmes", saveProgramme);
adminRouter.put("/programmes/:id", saveProgramme);

// --- Users and roles ------------------------------------------------------------------

/** Active Super Admins other than the given user. */
async function otherActiveSuperAdmins(userId) {
  return db.roleAssignment.count({ where: { role: "SUPER_ADMIN", userId: { not: userId }, user: { isActive: true } } });
}

/**
 * The password a Super Admin can reset any user to (DEFAULT_RESET_PASSWORD; "Password@123" if unset).
 * The user may keep it; they can change it under My account.
 */
// Production needs its own secret default: a default known outside the IT cell (as "Password@123" is, from
// the docs) would let anyone sign in to a reset account before its owner does. Development keeps a fallback.
const defaultResetPassword =
  process.env.DEFAULT_RESET_PASSWORD || (process.env.NODE_ENV === "production" ? null : "Password@123");

async function isSuperAdminUser(userId) {
  return (await db.roleAssignment.count({ where: { userId, role: "SUPER_ADMIN" } })) > 0;
}

adminRouter.get(
  "/users",
  handle(null, async (_data, req) => {
    const actor = assertPermission(req, "users.manage");
    const [users, departments] = await Promise.all([
      db.user.findMany({
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        include: {
          roles: { include: { department: true }, orderBy: { role: "asc" } },
          accounts: { where: { providerId: "credential" }, select: { id: true } },
        },
      }),
      db.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    ]);
    const actorIsSuperAdmin = can(actor, "superAdmins.manage");
    return {
      actorIsSuperAdmin,
      // Shown to Super Admins only, so they can tell the user what to sign in with.
      defaultPassword: actorIsSuperAdmin ? (defaultResetPassword ?? "") : null,
      departments,
      users: users.map(({ accounts, ...u }) => ({ ...u, hasPassword: accounts.length > 0 })),
    };
  }),
);

const saveUser = handle(
  userSchema,
  async (data, req) => {
    const userId = req.params.id ?? null;
    const actor = assertPermission(req, "users.manage");
    if (userId === actor.id && !data.isActive) {
      throw new UserError("You cannot deactivate your own account.");
    }
    if (userId && (await isSuperAdminUser(userId))) {
      if (!can(actor, "superAdmins.manage"))
        throw new UserError("Only a Super Admin can change a Super Admin account.");
      if (!data.isActive && (await otherActiveSuperAdmins(userId)) === 0) {
        throw new UserError("This is the only active Super Admin and cannot be deactivated.");
      }
    }
    await db.$transaction(async (tx) => {
      const row = userId
        ? await tx.user.update({ where: { id: userId }, data })
        : await tx.user.create({ data: { ...data, emailVerified: false } });
      if (userId && !data.isActive) {
        await tx.session.deleteMany({ where: { userId } }); // sign the user out everywhere
      }
      await writeAudit(
        {
          actorId: actor.id,
          action: userId ? "user.update" : "user.create",
          entityType: "User",
          entityId: row.id,
          details: data,
        },
        tx,
      );
    });
  },
  "User saved",
);
adminRouter.post("/users", saveUser);
adminRouter.put("/users/:id", saveUser);

adminRouter.post(
  "/users/:id/roles",
  handle(
    roleAssignmentSchema,
    async (data, req) => {
      const userId = req.params.id;
      const actor = assertPermission(req, "users.manage");
      if (data.role === "SUPER_ADMIN" && !can(actor, "superAdmins.manage")) {
        throw new UserError("Only a Super Admin can make someone a Super Admin.");
      }
      // Separation of duties: an Administrator cannot give themself a role (e.g. BoS Coordinator, then approve
      // syllabi). Another Administrator or a Super Admin does it, and it is audit-logged.
      if (userId === actor.id && !can(actor, "superAdmins.manage")) {
        throw new UserError("You cannot add a role to your own account. Ask another Administrator or a Super Admin.");
      }
      const existing = await db.roleAssignment.findFirst({
        where: { userId, role: data.role, departmentId: data.departmentId },
      });
      if (existing) throw new UserError("The user already has this role.");
      await db.$transaction(async (tx) => {
        const row = await tx.roleAssignment.create({ data: { userId, ...data } });
        await writeAudit(
          {
            actorId: actor.id,
            action: "role.grant",
            entityType: "RoleAssignment",
            entityId: row.id,
            departmentId: data.departmentId,
            details: { userId, ...data },
          },
          tx,
        );
      });
    },
    "Role added",
  ),
);

adminRouter.delete(
  "/roles/:id",
  handle(
    null,
    async (_data, req) => {
      const actor = assertPermission(req, "users.manage");
      const role = await db.roleAssignment.findUnique({ where: { id: req.params.id } });
      if (!role) throw new NotFoundError("Role not found.");

      if (role.role === "SUPER_ADMIN") {
        if (!can(actor, "superAdmins.manage"))
          throw new UserError("Only a Super Admin can remove the Super Admin role.");
        if ((await otherActiveSuperAdmins(role.userId)) === 0) {
          throw new UserError("This is the only active Super Admin. Make someone else a Super Admin first.");
        }
      }
      if (role.userId === actor.id && role.role === "ADMIN") {
        const otherAdmins = await db.roleAssignment.count({
          where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, userId: { not: actor.id }, user: { isActive: true } },
        });
        if (otherAdmins === 0)
          throw new UserError("You are the only active administrator. Add another administrator first.");
      }

      await db.$transaction(async (tx) => {
        await tx.roleAssignment.delete({ where: { id: role.id } });
        if (role.role === "SUPER_ADMIN") {
          // Sign the user out so their sessions lose Super Admin access at once. Any password stays:
          // every user may sign in with a password set by a Super Admin.
          await tx.session.deleteMany({ where: { userId: role.userId } });
        }
        await writeAudit(
          {
            actorId: actor.id,
            action: "role.revoke",
            entityType: "RoleAssignment",
            entityId: role.id,
            departmentId: role.departmentId,
            details: { userId: role.userId, role: role.role },
          },
          tx,
        );
      });
    },
    "Role removed",
  ),
);

/**
 * A Super Admin sets an initial password for another Super Admin (D15): used after granting the
 * role, or when a colleague has lost their password. The user is signed out everywhere and must
 * choose their own password at the next sign-in. Your own password is changed under My account.
 */
adminRouter.post(
  "/users/:id/password",
  handle(
    initialPasswordSchema,
    async ({ password }, req) => {
      const userId = req.params.id;
      const actor = assertPermission(req, "superAdmins.manage");
      if (userId === actor.id) throw new UserError("Change your own password under My account.");
      const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
      if (!user) throw new NotFoundError("User not found.");
      if (!(await isSuperAdminUser(userId))) {
        throw new UserError(
          "A chosen password can be set only for Super Admins. For other users, use Reset to default password.",
        );
      }
      if (!user.isActive) throw new UserError("Activate the account before setting a password.");

      const hash = await hashPassword(password);
      await db.$transaction(async (tx) => {
        const credential = await tx.account.findFirst({ where: { userId, providerId: "credential" } });
        if (credential) await tx.account.update({ where: { id: credential.id }, data: { password: hash } });
        else await tx.account.create({ data: { userId, providerId: "credential", accountId: userId, password: hash } });
        await tx.user.update({ where: { id: userId }, data: { passwordChangeRequired: true } });
        await tx.session.deleteMany({ where: { userId } });
        await writeAudit(
          {
            actorId: actor.id,
            action: credential ? "superAdmin.passwordReset" : "superAdmin.passwordSet",
            entityType: "User",
            entityId: userId,
          },
          tx,
        );
      });
    },
    "Password set. Share it securely; it must be changed at the first sign-in.",
  ),
);

/**
 * A Super Admin resets any other user's password to the default (DEFAULT_RESET_PASSWORD), e.g. for
 * someone who cannot use Google sign-in. The user is signed out everywhere and must choose their own
 * password at the next sign-in (README D18, revised 24 Oct 2026).
 */
adminRouter.post(
  "/users/:id/password/default",
  handle(
    null,
    async (_data, req) => {
      const userId = req.params.id;
      const actor = assertPermission(req, "superAdmins.manage");
      if (userId === actor.id) throw new UserError("Change your own password under My account.");
      const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
      if (!user) throw new NotFoundError("User not found.");
      if (!user.isActive) throw new UserError("Activate the account before resetting its password.");
      if (!defaultResetPassword) {
        throw new UserError(
          "DEFAULT_RESET_PASSWORD is not set on the server, so passwords cannot be reset to a default.",
        );
      }
      const problem = passwordProblem(defaultResetPassword);
      if (problem) throw new UserError(`DEFAULT_RESET_PASSWORD in the server settings is not allowed: ${problem}`);

      const hash = await hashPassword(defaultResetPassword);
      await db.$transaction(async (tx) => {
        const credential = await tx.account.findFirst({ where: { userId, providerId: "credential" } });
        if (credential) await tx.account.update({ where: { id: credential.id }, data: { password: hash } });
        else await tx.account.create({ data: { userId, providerId: "credential", accountId: userId, password: hash } });
        // The default is shared knowledge, so the owner must replace it straight after signing in.
        await tx.user.update({ where: { id: userId }, data: { passwordChangeRequired: true } });
        await tx.session.deleteMany({ where: { userId } });
        await writeAudit(
          { actorId: actor.id, action: "user.passwordResetToDefault", entityType: "User", entityId: userId },
          tx,
        );
      });
    },
    "Password reset to the default. The user must choose a new password when signing in with it.",
  ),
);

// --- Email log (notifications) -------------------------------------------------------------------

/** The latest workflow emails and their delivery status, for checking delivery during the pilot. */
adminRouter.get(
  "/notifications",
  handle(null, async (_data, req) => {
    assertPermission(req, "users.manage");
    const [rows, counts] = await Promise.all([
      db.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: 1000,
        include: { user: { select: { name: true, email: true } } },
      }),
      db.notification.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    return {
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      notifications: rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        status: n.status,
        recipient: n.user,
        course: n.payload?.course?.code ?? null,
        version: n.payload?.version ?? null,
        attempts: n.attempts,
        lastError: n.lastError,
        createdAt: n.createdAt,
        sendAfter: n.sendAfter,
        sentAt: n.sentAt,
      })),
    };
  }),
);

/** Sends a failed email again (after fixing SMTP settings, for example). */
adminRouter.post(
  "/notifications/:id/retry",
  handle(
    null,
    async (_data, req) => {
      const actor = assertPermission(req, "users.manage");
      const n = await db.notification.findUnique({ where: { id: req.params.id } });
      if (!n) throw new NotFoundError("Notification not found.");
      if (n.status !== "FAILED") throw new UserError("Only a failed email can be sent again.");
      await db.$transaction(async (tx) => {
        await tx.notification.update({
          where: { id: n.id },
          data: { status: "PENDING", attempts: 0, sendAfter: new Date(), lastError: null },
        });
        await writeAudit(
          { actorId: actor.id, action: "notification.retry", entityType: "Notification", entityId: n.id },
          tx,
        );
      });
    },
    "The email will be sent again in a moment.",
  ),
);
