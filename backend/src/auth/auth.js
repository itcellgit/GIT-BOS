import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { db } from "../infra/db.js";
import { sendMail } from "../infra/mail.js";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@acp/shared/schemas/account";
// Accounts are created by the Administrator only; nobody can sign themselves up.
// Sign-in methods (README §3 Q6, D15):
//   - everyone: Google, restricted to the institution's Google Workspace domain (GOOGLE_HOSTED_DOMAIN)
//   - email + password: Super Admins, and anyone whose password a Super Admin has set or reset to the
//     default (routes/admin.js). Better Auth itself never creates a password for a non-Super Admin.
//   - development only: one-time code by email, for the @example.edu demo accounts and end-to-end tests
const googleDomain = process.env.GOOGLE_HOSTED_DOMAIN || "git.edu";
const socialProviders = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Better Auth checks Google's signed `hd` claim, so personal Gmail and other domains are refused.
    hd: googleDomain,
    prompt: "select_account",
    disableSignUp: true,
  };
}
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  socialProviders.microsoft = {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    tenantId: process.env.MICROSOFT_TENANT_ID || "common",
    disableSignUp: true,
  };
}
export const enabledSocialProviders = Object.keys(socialProviders);
/** The Google Workspace domain allowed to sign in, or null when Google sign-in is not configured. */
export const googleSignInDomain = socialProviders.google ? googleDomain : null;
/** Email-code sign-in exists only in development (demo accounts, end-to-end tests). */
export const emailCodeSignIn = process.env.NODE_ENV !== "production";
async function isSuperAdmin(where) {
  const user = await db.user.findUnique({
    where,
    select: { isActive: true, roles: { where: { role: "SUPER_ADMIN" }, select: { id: true } } },
  });
  return !!user?.isActive && user.roles.length > 0;
}
const minute = 60;
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  // Public address of the portal (the React app). The API is served under /api on the same origin.
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  trustedOrigins: async (request) => {
    const origins = [process.env.BETTER_AUTH_URL].filter(Boolean);
    if (process.env.NODE_ENV !== "production") {
      const origin = request?.headers.get("origin");
      const host = request?.headers.get("host");
      if (origin && host) {
        try {
          const parsedOrigin = new URL(origin);
          if (["http:", "https:"].includes(parsedOrigin.protocol) && parsedOrigin.host === host) {
            origins.push(parsedOrigin.origin);
          }
        } catch {
          // Ignore malformed Origin headers.
        }
      }
    }
    return origins;
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    revokeSessionsOnPasswordReset: true,
    autoSignIn: false,
  },
  socialProviders,
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (emailCodeSignIn) return;
      const sendsSignInCode = ctx.path === "/email-otp/send-verification-otp" && ctx.body?.type !== "forget-password";
      if (ctx.path === "/sign-in/email-otp" || sendsSignInCode) {
        throw new APIError("FORBIDDEN", { message: "Sign in with your institutional Google account." });
      }
    }),
  },
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google", "microsoft"] },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  // Limits repeated attempts per IP address. Active in production; off in development so tests can sign in freely.
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: minute,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 15 * minute, max: 10 },
      "/sign-in/email-otp": { window: 15 * minute, max: 10 },
      "/email-otp/send-verification-otp": { window: 15 * minute, max: 5 },
      "/forget-password/email-otp": { window: 15 * minute, max: 5 },
      "/email-otp/reset-password": { window: 15 * minute, max: 5 },
      "/change-password": { window: 15 * minute, max: 10 },
    },
  },
  databaseHooks: {
    user: {
      // Second line of defence: accounts come only from the Administrator.
      create: { before: async () => false },
    },
    account: {
      create: {
        // A password ("credential" account) may exist only for a Super Admin. This also blocks the
        // password-reset endpoint from creating a password for anyone else.
        before: async (account) => {
          if (account.providerId === "credential" && !(await isSuperAdmin({ id: account.userId }))) {
            throw new APIError("FORBIDDEN", { message: "Password sign-in is available only to Super Admins." });
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({ where: { id: session.userId }, select: { isActive: true } });
          if (!user?.isActive) {
            throw new APIError("FORBIDDEN", { message: "This account is disabled. Contact the portal administrator." });
          }
        },
      },
    },
  },
  plugins: [
    emailOTP({
      disableSignUp: true,
      storeOTP: "hashed",
      expiresIn: 600,
      async sendVerificationOTP({ email, otp, type }) {
        // Not awaited, so the response time does not reveal whether the account exists.
        void (async () => {
          if (type === "sign-in") {
            await sendMail({
              to: email,
              subject: "Your sign-in code — Academic Curriculum Portal",
              text: `Your sign-in code is ${otp}. It expires in 10 minutes. If you did not request it, ignore this email.`,
            });
          } else if (type === "forget-password" && (await isSuperAdmin({ email }))) {
            await sendMail({
              to: email,
              subject: "Password reset code — Academic Curriculum Portal",
              text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not ask to reset your password, ignore this email and tell the portal administrator.`,
            });
          }
        })().catch((e) => console.error("[auth] failed to send code", e));
      },
    }),
  ],
});
