import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { passwordProblem } from "@acp/shared/schemas/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
const providerLabels = { google: "Google", microsoft: "Microsoft" };
/**
 * Sign-in: one-time email code (everyone) or email + password (Super Admins).
 * "Forgot password" sends a reset code to Super Admins only.
 */
export function LoginForm({ nextPath, socialProviders }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState("code-email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const normalizedEmail = email.trim().toLowerCase();
  function go(next) {
    setView(next);
    setError(null);
    setCode("");
    setPassword("");
    setConfirm("");
  }
  async function run(task) {
    setBusy(true);
    setError(null);
    try {
      const problem = await task();
      if (problem) setError(problem);
    } finally {
      setBusy(false);
    }
  }
  async function signedIn() {
    await queryClient.invalidateQueries();
    navigate(nextPath, { replace: true });
  }
  const sendCode = (e) => {
    e.preventDefault();
    run(async () => {
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email: normalizedEmail, type: "sign-in" });
      if (error) return error.message ?? "Could not send the code. Please try again.";
      setNotice(null);
      go("code-enter");
    });
  };
  const verifyCode = (e) => {
    e.preventDefault();
    run(async () => {
      const { error } = await authClient.signIn.emailOtp({ email: normalizedEmail, otp: code.trim() });
      if (error) return error.message ?? "The code is incorrect or has expired.";
      signedIn();
    });
  };
  const signInWithPassword = (e) => {
    e.preventDefault();
    run(async () => {
      const { error } = await authClient.signIn.email({ email: normalizedEmail, password });
      if (error) {
        if (error.status === 429) return "Too many attempts. Wait a few minutes and try again.";
        if (error.status === 403) return error.message ?? "This account cannot sign in.";
        return "The email or password is incorrect.";
      }
      signedIn();
    });
  };
  const sendResetCode = (e) => {
    e.preventDefault();
    run(async () => {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "forget-password",
      });
      if (error) return error.message ?? "Could not send the code. Please try again.";
      go("forgot-reset");
    });
  };
  const resetPassword = (e) => {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError("Passwords do not match.");
    run(async () => {
      const result = await api.post("/account/reset-password", {
        email: normalizedEmail,
        otp: code.trim(),
        newPassword: password,
        confirmPassword: confirm,
      });
      if (!result.ok) return Object.values(result.fieldErrors ?? {})[0] ?? result.error;
      go("password");
      setNotice("Password reset. Sign in with your new password.");
    });
  };
  const emailField = (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </div>
  );
  const descriptions = {
    "code-email": "Enter your institutional email address. We will send you a one-time code.",
    "code-enter": `Enter the 6-digit code sent to ${normalizedEmail}.`,
    password: "Password sign-in is for Super Admins. Everyone else signs in with an email code.",
    "forgot-email": "Enter your Super Admin email address. We will send a code to reset your password.",
    "forgot-reset": `If ${normalizedEmail} is a Super Admin account, a reset code has been sent. Enter it and choose a new password.`,
  };
  const method = view.startsWith("code") ? "code" : "password";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{view.startsWith("forgot") ? "Reset password" : "Sign in"}</CardTitle>
        <CardDescription>{descriptions[view]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!view.startsWith("forgot") && (
          <Tabs value={method} onValueChange={(v) => go(v === "code" ? "code-email" : "password")}>
            <TabsList className="w-full">
              <TabsTrigger value="code" className="flex-1">
                Email code
              </TabsTrigger>
              <TabsTrigger value="password" className="flex-1">
                Password
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {notice && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
            {notice}
          </p>
        )}

        {view === "code-email" && (
          <form onSubmit={sendCode} className="space-y-4">
            {emailField}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </Button>
          </form>
        )}

        {view === "code-enter" && (
          <form onSubmit={verifyCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Sign-in code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <Button type="button" variant="link" className="w-full" onClick={() => go("code-email")}>
              Use a different email
            </Button>
          </form>
        )}

        {view === "password" && (
          <form onSubmit={signInWithPassword} className="space-y-4">
            {emailField}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => {
                setNotice(null);
                go("forgot-email");
              }}
            >
              Forgot password?
            </Button>
          </form>
        )}

        {view === "forgot-email" && (
          <form onSubmit={sendResetCode} className="space-y-4">
            {emailField}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send reset code"}
            </Button>
            <Button type="button" variant="link" className="w-full" onClick={() => go("password")}>
              Back to sign in
            </Button>
          </form>
        )}

        {view === "forgot-reset" && (
          <form onSubmit={resetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-code">Reset code</Label>
              <Input
                id="reset-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">At least 12 characters, with letters and digits.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
              {busy ? "Saving…" : "Reset password"}
            </Button>
            <Button type="button" variant="link" className="w-full" onClick={() => go("password")}>
              Back to sign in
            </Button>
          </form>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {socialProviders.length > 0 && view === "code-email" && (
          <>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>
            {socialProviders.map((p) => (
              <Button
                key={p}
                variant="outline"
                className="w-full"
                onClick={() => authClient.signIn.social({ provider: p, callbackURL: nextPath })}
              >
                Continue with {providerLabels[p]}
              </Button>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
