import { NavLink as RouterNavLink } from "react-router";
import { cn } from "@/lib/utils";

export function NavLink({ href, exact, icon: Icon, children }) {
  return (
    <RouterNavLink
      to={href}
      end={exact}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )
      }
    >
      {Icon && <Icon className="size-4 shrink-0 opacity-80 group-[.active]:opacity-100" aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </RouterNavLink>
  );
}
