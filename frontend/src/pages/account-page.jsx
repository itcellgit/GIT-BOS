import { Link, useOutletContext } from "react-router";
import { roleLabels } from "@acp/shared/domain/auth/permissions";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Outside the portal layout on purpose: reachable while a password change is required.
export function AccountPage() {
  const { me } = useOutletContext();
  const roles = me.roles.map((r) => roleLabels[r.role] + (r.departmentCode ? ` (${r.departmentCode})` : ""));

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3 md:px-8">
        <div>
          <p className="text-xs text-muted-foreground">KLS GIT</p>
          <p className="font-semibold leading-tight">Academic Curriculum Portal</p>
        </div>
        <SignOutButton />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        {!me.passwordChangeRequired && (
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to the portal
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">My account</h1>

        {me.passwordChangeRequired && (
          <Alert>
            <AlertTitle>Choose your own password to continue</AlertTitle>
            <AlertDescription>
              Your password was set by an administrator or from the server configuration. For security, replace it with
              a password only you know before using the portal.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{me.name}</CardTitle>
            <CardDescription>{me.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              {roles.length === 0 && <span className="text-muted-foreground">No role assigned</span>}
              {roles.map((r) => (
                <Badge key={r} variant="secondary">
                  {r}
                </Badge>
              ))}
            </div>
            <p className="text-muted-foreground">
              Sign-in: {me.hasPassword ? "email and password, or a one-time email code" : "one-time email code"}
            </p>
          </CardContent>
        </Card>

        {!me.hasPassword && me.roles.some((r) => r.role === "SUPER_ADMIN") && (
          <Alert>
            <AlertTitle>Password sign-in is not set up</AlertTitle>
            <AlertDescription>
              As a Super Admin you can also sign in with a password. Ask another Super Admin to set an initial password
              for you, or sign out and use “Forgot password?” on the Password tab of the sign-in page.
            </AlertDescription>
          </Alert>
        )}

        {me.hasPassword && (
          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>Changing your password signs you out on all other devices.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm required={me.passwordChangeRequired} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
