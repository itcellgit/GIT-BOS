import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useOutletContext } from "react-router";
import { Building2, ChartBar, LayoutDashboard, Layers, Menu, Network, Users, X } from "lucide-react";
import { can, roleLabels } from "@acp/shared/domain/auth/permissions";
import { BrandMark } from "@/components/layout/brand-mark";
import { NavLink } from "@/components/layout/nav-link";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeMenu } from "@/components/layout/theme-menu";
import { Button } from "@/components/ui/button";
import { cn, initials } from "@/lib/utils";

/** Signed-in area: sidebar (links depend on roles; a drawer on small screens), top bar and page. */
export function PortalLayout() {
  const { me } = useOutletContext();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer after navigating.
  useEffect(() => setMenuOpen(false), [location.pathname]);

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
    <div className="flex min-h-screen flex-1">
      {/* Backdrop for the mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] transition-opacity md:hidden",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-68 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:translate-x-0",
          menuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <span className="min-w-0">
              <span className="block text-[0.7rem] font-medium tracking-wider text-sidebar-foreground/60 uppercase">
                KLS GIT · Belagavi
              </span>
              <span className="block truncate text-sm font-semibold text-sidebar-accent-foreground">
                Curriculum Portal
              </span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2" aria-label="Main">
          <NavGroup label="Workspace">
            <NavLink href="/" exact icon={LayoutDashboard}>
              Home
            </NavLink>
            {me.roles.length > 0 && (
              <NavLink href="/dashboard" icon={ChartBar}>
                Dashboard
              </NavLink>
            )}
            {can(me, "scheme.view") && (
              <NavLink href="/schemes" icon={Layers}>
                Schemes
              </NavLink>
            )}
          </NavGroup>

          {departmentCodes.length > 0 && (
            <NavGroup label="Departments">
              {departmentCodes.map((code) => (
                <NavLink key={code} href={`/departments/${code}`} icon={Building2}>
                  Department · {code}
                </NavLink>
              ))}
            </NavGroup>
          )}

          {can(me, "users.manage") && (
            <NavGroup label="Administration">
              <NavLink href="/admin/users" icon={Users}>
                Users
              </NavLink>
              <NavLink href="/admin/departments" icon={Network}>
                Departments
              </NavLink>
            </NavGroup>
          )}
        </nav>

        <Link
          to="/account"
          className="m-3 flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2.5 transition-colors hover:bg-sidebar-accent"
          title="My account"
          aria-label={`My account: ${me.name}`}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/15 text-xs font-semibold text-sidebar-primary ring-1 ring-sidebar-primary/30">
            {initials(me.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-sidebar-accent-foreground">{me.name}</span>
            <span className="block truncate text-xs text-sidebar-foreground/60">
              {roleSummary.join(" · ") || "No role assigned"}
            </span>
          </span>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 md:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <Menu />
            </Button>
            <Link to="/" className="flex items-center gap-2 md:hidden">
              <BrandMark className="size-7 rounded-md" />
              <span className="text-sm font-semibold">Curriculum Portal</span>
            </Link>
            <p className="hidden truncate text-sm text-muted-foreground md:block">
              KLS Gogte Institute of Technology <span className="px-1.5 text-border">/</span> Syllabus framing and Board
              of Studies approval
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeMenu />
            <SignOutButton />
          </div>
        </header>
        <main className="w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet context={{ me }} />
        </main>
      </div>
    </div>
  );
}

function NavGroup({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[0.68rem] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
