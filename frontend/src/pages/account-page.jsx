import { Link, useOutletContext } from "react-router";
import { ChevronLeft } from "lucide-react";
import { roleLabels } from "@acp/shared/domain/auth/permissions";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { BrandMark } from "@/components/layout/brand-mark";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeMenu } from "@/components/layout/theme-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initials } from "@/lib/utils";

// Outside the portal layout on purpose: reachable while a password change is required.
export function AccountPage() {
  const { me } = useOutletContext();
  const roles = me.roles.map((r) => roleLabels[r.role] + (r.departmentCode ? ` (${r.departmentCode})` : ""));

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center justify-between gap-4 border-b bg-sidebar px-4 text-sidebar-foreground md:px-8">
        <div className="flex items-center gap-3">
          <BrandMark className="size-8 rounded-md" />
          <div>
            <p className="text-[0.68rem] font-medium tracking-wider text-sidebar-foreground/60 uppercase">
              KLS GIT · Belagavi
            </p>
            <p className="text-sm font-semibold leading-tight text-sidebar-accent-foreground">Curriculum Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeMenu className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          <SignOutButton className="border-sidebar-border bg-transparent text-sidebar-foreground shadow-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:bg-transparent" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 md:py-10">
        {!me.passwordChangeRequired && (
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Back to the portal
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight md:text-[1.7rem]">My account</h1>

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
          <CardHeader className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary ring-1 ring-primary/20">
              {initials(me.name)}
            </span>
            <div className="min-w-0 space-y-0.5">
              <CardTitle className="text-lg">{me.name}</CardTitle>
              <CardDescription>{me.email}</CardDescription>
            </div>
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
