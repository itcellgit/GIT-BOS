import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { passwordProblem } from "@acp/shared/schemas/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
const providerLabels = { google: "Google", microsoft: "Microsoft" };

/** Messages for the `error` that Better Auth adds to /login after a refused Google sign-in. */
function oauthErrorMessage(code, description, googleDomain) {
  if (!code) return null;
  if (code === "access_denied") return "Google sign-in was cancelled.";
  if (code === "signup_disabled")
    return "This Google account is not registered in the portal. Ask the portal administrator to add you.";
  if (code === "unable_to_get_user_info")
    return `Use your ${googleDomain ? `@${googleDomain} ` : "institutional "}Google account. Personal Gmail and other accounts cannot sign in.`;
  return description || "Google sign-in did not complete. Please try again.";
}

/**
 * Sign-in: Google (everyone, institutional domain only) or email + password (Super Admins).
 * "Forgot password" sends a reset code to Super Admins only. In development a one-time email code
 * also signs in the @example.edu demo accounts.
 */
export function LoginForm({ nextPath, options, oauthError }) {
  const socialProviders = options?.socialProviders ?? [];
  const googleDomain = options?.googleDomain ?? null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState("main");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() =>
    oauthErrorMessage(oauthError?.code, oauthError?.description, options?.googleDomain),
  );
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
  const signInWithGoogle = () =>
    run(async () => {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: nextPath,
        errorCallbackURL: "/login",
      });
      if (error) return error.message ?? "Could not start Google sign-in. Please try again.";
    });
  const titles = {
    main: "Sign in",
    "code-email": "Demo accounts",
    "code-enter": "Demo accounts",
    password: "Super Admin sign-in",
    "forgot-email": "Reset password",
    "forgot-reset": "Reset password",
  };
  const descriptions = {
    main: googleDomain
      ? `Use your @${googleDomain} Google account. Only people added by the portal administrator can sign in.`
      : "Google sign-in is not configured yet. Ask the portal administrator.",
    "code-email": "Development only: the one-time code is printed in the server console and .local/mail.log.",
    "code-enter": `Enter the 6-digit code sent to ${normalizedEmail}.`,
    password: "For Super Admins only. Everyone else signs in with Google.",
    "forgot-email": "Enter your Super Admin email address. We will send a code to reset your password.",
    "forgot-reset": `If ${normalizedEmail} is a Super Admin account, a reset code has been sent. Enter it and choose a new password.`,
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titles[view]}</CardTitle>
        <CardDescription>{descriptions[view]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice && (
          <p className="text-sm text-success" role="status">
            {notice}
          </p>
        )}

        {view === "main" && (
          <>
            {socialProviders.includes("google") && (
              <Button type="button" size="lg" className="w-full" disabled={busy} onClick={signInWithGoogle}>
                <GoogleIcon />
                {busy ? "Redirecting to Google…" : "Sign in with Google"}
              </Button>
            )}
            {socialProviders
              .filter((p) => p !== "google")
              .map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    authClient.signIn.social({ provider: p, callbackURL: nextPath, errorCallbackURL: "/login" })
                  }
                >
                  Continue with {providerLabels[p]}
                </Button>
              ))}
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={() => go("password")}>
              <KeyRound />
              Super Admin password sign-in
            </Button>
            {options?.emailCodeSignIn && (
              <Button
                type="button"
                variant="link"
                className="w-full text-muted-foreground"
                onClick={() => go("code-email")}
              >
                Demo accounts (development only)
              </Button>
            )}
          </>
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

        {view !== "main" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground"
            onClick={() => {
              setNotice(null);
              go("main");
            }}
          >
            <ArrowLeft />
            All sign-in options
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Google's "G" mark, as Google's sign-in branding guidelines ask for. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5 rounded-full bg-white p-0.5">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
