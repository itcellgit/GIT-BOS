import { Link, Outlet, useOutletContext } from "react-router";
import { GraduationCap } from "lucide-react";
import { can, roleLabels } from "@acp/shared/domain/auth/permissions";
import { NavLink } from "@/components/layout/nav-link";
import { SignOutButton } from "@/components/layout/sign-out-button";

/** Signed-in area: sidebar (links depend on roles) and header. */
export function PortalLayout() {
  const { me } = useOutletContext();
  const departmentCodes = [
    ...new Set(
      me.roles
        .filter((r) => ["BOS_COORDINATOR", "HOD"].includes(r.role) && r.departmentCode)
        .map((r) => r.departmentCode),
    ),
  ].sort();
  const roleSummary = [
    ...new Set(me.roles.map((r) => roleLabels[r.role] + (r.departmentCode ? ` (${r.departmentCode})` : ""))),
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
        <div className="px-4 py-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-sidebar-foreground/60">KLS GIT</span>
              <span className="block font-semibold leading-tight text-sidebar-accent-foreground">
                Academic Curriculum Portal
              </span>
            </span>
          </Link>
        </div>
        <nav className="flex flex-wrap gap-1 px-2 pb-3 md:flex-col md:flex-nowrap" aria-label="Main">
          <NavLink href="/" exact>
            Home
          </NavLink>
          {can(me, "scheme.view") && <NavLink href="/schemes">Schemes</NavLink>}
          {departmentCodes.map((code) => (
            <NavLink key={code} href={`/departments/${code}`}>
              Department · {code}
            </NavLink>
          ))}
          {can(me, "users.manage") && (
            <>
              <p className="hidden px-3 pt-4 pb-1 text-xs font-medium tracking-wider text-sidebar-foreground/50 uppercase md:block">
                Administration
              </p>
              <NavLink href="/admin/users">Users</NavLink>
              <NavLink href="/admin/departments">Departments</NavLink>
            </>
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-card/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials(me.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{me.name}</p>
              <p className="truncate text-xs text-muted-foreground">{roleSummary.join(" · ") || "No role assigned"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/account"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              My account
            </Link>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet context={{ me }} />
        </main>
      </div>
    </div>
  );
}

function initials(name) {
  // Words that start with a letter: "Faculty CSE (demo)" → "FC".
  const parts = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase();
}
