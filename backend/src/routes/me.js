// The signed-in user: who am I, my home page, and my account (password).
import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { APIError } from "better-auth/api";
import { departmentsWithRole } from "@acp/shared/domain/auth/permissions";
import { changePasswordSchema, notificationPreferenceSchema, resetPasswordSchema } from "@acp/shared/schemas/account";
import { auth, emailCodeSignIn, enabledSocialProviders, googleSignInDomain } from "../auth/auth.js";
import { assertSignedIn } from "../auth/session.js";
import { UserError } from "../errors.js";
import { handle } from "../http/handler.js";
import { db } from "../infra/db.js";
import { writeAudit } from "../services/audit.js";

export const meRouter = Router();

/** Public: which sign-in options to show on the login page. */
meRouter.get(
  "/auth-options",
  handle(null, async () => ({
    socialProviders: enabledSocialProviders,
    googleDomain: googleSignInDomain,
    emailCodeSignIn,
  })),
);

/** The signed-in user (roles, password state), or null when signed out. */
meRouter.get(
  "/me",
  handle(null, async (_data, req) => req.user ?? null),
);

/** Home page: my assigned courses, my departments, open schemes. */
meRouter.get(
  "/home",
  handle(null, async (_data, req) => {
    const user = assertSignedIn(req);
    const [assignments, schemes, departments] = await Promise.all([
      db.courseAssignment.findMany({
        where: {
          userId: user.id,
          scheme: { status: { not: "RETIRED" } },
          // Only courses of departments where the person is still Faculty (they lose access otherwise).
          course: { owningDepartmentId: { in: departmentsWithRole(user, ["FACULTY"]) } },
        },
        include: {
          scheme: true,
          course: { include: { schemeCourses: { include: { programme: { select: { code: true } } } } } },
        },
        orderBy: { course: { code: "asc" } },
      }),
      db.scheme.findMany({ where: { status: { not: "RETIRED" } }, orderBy: { code: "desc" } }),
      db.department.findMany({
        where: { id: { in: departmentsWithRole(user, ["BOS_COORDINATOR", "HOD"]) } },
        orderBy: { code: "asc" },
      }),
    ]);
    return {
      departments,
      schemes,
      assignments: assignments.map((a) => {
        // Where this course appears in the same scheme (one row per programme).
        const rows = a.course.schemeCourses.filter((r) => r.schemeId === a.schemeId);
        return {
          id: a.id,
          schemeId: a.schemeId,
          courseId: a.courseId,
          role: a.role,
          schemeName: a.scheme.name,
          code: a.course.code,
          title: a.course.title,
          programmes: rows.map((r) => r.programme.code),
          semester: rows[0]?.semester ?? null,
          format: rows[0]?.format ?? null,
        };
      }),
    };
  }),
);

/** Signed-in user changes their own password. Signs out their other sessions. */
meRouter.post(
  "/account/change-password",
  handle(
    changePasswordSchema,
    async ({ currentPassword, newPassword }, req, res) => {
      const user = assertSignedIn(req, { allowPasswordChange: true });
      if (!user.hasPassword) throw new UserError("Your account signs in with an email code and has no password.");
      let response;
      try {
        response = await auth.api.changePassword({
          headers: fromNodeHeaders(req.headers),
          body: { currentPassword, newPassword, revokeOtherSessions: true },
          asResponse: true,
        });
      } catch (e) {
        if (e instanceof APIError)
          throw new UserError("The current password is incorrect.", { currentPassword: "Incorrect password" });
        throw e;
      }
      if (!response.ok) {
        throw new UserError("The current password is incorrect.", { currentPassword: "Incorrect password" });
      }
      // Revoking other sessions issues a fresh session cookie for this browser: pass it on.
      const cookies = response.headers.getSetCookie?.() ?? [];
      if (cookies.length) res.setHeader("Set-Cookie", cookies);
      await db.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { passwordChangeRequired: false } });
        await writeAudit(
          { actorId: user.id, action: "account.passwordChange", entityType: "User", entityId: user.id },
          tx,
        );
      });
    },
    "Password changed. You have been signed out on other devices.",
  ),
);

/** Turns the signed-in user's workflow emails on or off (My account). */
meRouter.put(
  "/account/notifications",
  handle(notificationPreferenceSchema, async ({ emailNotifications }, req, res) => {
    const user = assertSignedIn(req);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { emailNotifications } });
      // Emails already queued for later are dropped too.
      if (!emailNotifications) {
        await tx.notification.updateMany({
          where: { userId: user.id, status: "PENDING" },
          data: { status: "SKIPPED" },
        });
      }
      await writeAudit(
        {
          actorId: user.id,
          action: "user.emailNotifications",
          entityType: "User",
          entityId: user.id,
          details: { emailNotifications },
        },
        tx,
      );
    });
    res.locals.message = emailNotifications ? "Email notifications turned on" : "Email notifications turned off";
  }),
);

/** "Forgot password": sets a new password using the code emailed to a Super Admin. */
meRouter.post(
  "/account/reset-password",
  handle(
    resetPasswordSchema,
    async ({ email, otp, newPassword }) => {
      const invalid = new UserError("The code is incorrect or has expired.", { otp: "Incorrect or expired code" });
      const user = await db.user.findUnique({
        where: { email },
        select: { id: true, isActive: true, roles: { where: { role: "SUPER_ADMIN" }, select: { id: true } } },
      });
      // Same message whether or not the account exists or is a Super Admin.
      if (!user?.isActive || user.roles.length === 0) throw invalid;
      try {
        await auth.api.resetPasswordEmailOTP({ body: { email, otp, password: newPassword } });
      } catch (e) {
        if (e instanceof APIError) throw invalid;
        throw e;
      }
      await db.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { passwordChangeRequired: false } });
        await writeAudit(
          { actorId: user.id, action: "account.passwordReset", entityType: "User", entityId: user.id },
          tx,
        );
      });
    },
    "Password reset. Sign in with your new password.",
  ),
);
