import { fromNodeHeaders } from "better-auth/node";
import { can } from "@acp/shared/domain/auth/permissions";
import { auth } from "./auth.js";
import { PermissionError } from "../errors.js";
import { db } from "../infra/db.js";

/**
 * @typedef {object} CurrentUser
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string|null} designation
 * @property {boolean} isActive
 * @property {boolean} hasPassword            can sign in with a password
 * @property {boolean} passwordChangeRequired must choose a new password before doing anything else
 * @property {boolean} emailNotifications     receives workflow emails
 * @property {{role: string, departmentId: string|null, departmentCode: string|null}[]} roles
 */

/** Reads the session cookie and returns the signed-in, active user with roles, or null. */
export async function loadCurrentUser(req) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: { include: { department: { select: { code: true } } } },
      accounts: { where: { providerId: "credential" }, select: { id: true } },
    },
  });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    designation: user.designation,
    isActive: user.isActive,
    hasPassword: user.accounts.length > 0,
    passwordChangeRequired: user.passwordChangeRequired,
    emailNotifications: user.emailNotifications,
    roles: user.roles.map((r) => ({
      role: r.role,
      departmentId: r.departmentId,
      departmentCode: r.department?.code ?? null,
    })),
  };
}

/** Express middleware: sets req.user (or null) for every /api request. */
export async function attachUser(req, _res, next) {
  try {
    req.user = await loadCurrentUser(req);
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Throws PermissionError unless the signed-in user may perform `action` on `resource`.
 * Also blocks everything while a password change is pending. Returns the user.
 * @returns {CurrentUser}
 */
export function assertPermission(req, action, resource) {
  const user = assertSignedIn(req);
  if (!can(user, action, resource)) throw new PermissionError();
  return user;
}

/** Throws unless someone is signed in and has no pending password change. */
export function assertSignedIn(req, { allowPasswordChange = false } = {}) {
  const user = req.user;
  if (!user) throw new PermissionError("Your session has ended. Please sign in again.", 401);
  if (user.passwordChangeRequired && !allowPasswordChange) {
    throw new PermissionError("Change your password first (My account).", 403, "PASSWORD_CHANGE_REQUIRED");
  }
  return user;
}
