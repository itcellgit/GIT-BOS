import { describe, expect, it } from "vitest";
import { changePasswordSchema, passwordProblem } from "./account.js";
describe("password policy", () => {
  it("accepts 12+ characters with letters and digits", () => {
    expect(passwordProblem("curriculum2026")).toBeNull();
  });
  it.each([
    ["short1", "Use at least 12 characters"],
    ["onlylettersherenodigits", "Include at least one digit"],
    ["123456789012345", "Include at least one letter"],
  ])("rejects %s", (password, message) => {
    expect(passwordProblem(password)).toBe(message);
  });
  it("requires the confirmation to match and the new password to differ", () => {
    const mismatch = changePasswordSchema.safeParse({
      currentPassword: "old-password-1",
      newPassword: "new-password-12",
      confirmPassword: "new-password-13",
    });
    expect(mismatch.success).toBe(false);
    const same = changePasswordSchema.safeParse({
      currentPassword: "same-password-12",
      newPassword: "same-password-12",
      confirmPassword: "same-password-12",
    });
    expect(same.success).toBe(false);
  });
});
