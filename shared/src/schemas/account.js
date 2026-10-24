// Password rules for Super Admin password sign-in. Used by the browser forms and the server.
import { z } from "zod";
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
/** At least 12 characters, with at least one letter and one digit. */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one digit");
/** Returns the first rule the password breaks, or null when it is acceptable. */
export function passwordProblem(password) {
  const r = newPasswordSchema.safeParse(password);
  return r.success ? null : r.error.issues[0].message;
}
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current one",
  });
export const resetPasswordSchema = z
  .object({
    email: z.email("Enter a valid email address").transform((v) => v.trim().toLowerCase()),
    otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
/** A Super Admin sets an initial password for another Super Admin (replaced at first sign-in). */
export const initialPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

/** My account: workflow emails on or off. */
export const notificationPreferenceSchema = z.object({ emailNotifications: z.boolean() });
