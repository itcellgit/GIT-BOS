import { NavLink as RouterNavLink } from "react-router";
import { cn } from "@/lib/utils";

export function NavLink({ href, exact, children }) {
  return (
    <RouterNavLink
      to={href}
      end={exact}
      className={({ isActive }) =>
        cn(
          "rounded-md border-l-2 px-3 py-1.5 text-sm transition-colors",
          isActive
            ? "border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )
      }
    >
      {children}
    </RouterNavLink>
  );
}
