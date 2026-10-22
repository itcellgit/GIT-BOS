import { Navigate, Outlet, useLocation } from "react-router";
import { useMe } from "@/hooks/use-api";
import { LoadingScreen } from "@/components/layout/query-state";

/**
 * Protects signed-in pages: sends signed-out visitors to /login, and users who must change their
 * password to /account (the API enforces both as well).
 */
export function RequireAuth({ allowPasswordChange = false }) {
  const location = useLocation();
  const { data: me, isPending, isError } = useMe();

  if (isPending) return <LoadingScreen />;
  if (isError || !me) {
    const next = location.pathname === "/" ? "" : `?next=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={`/login${next}`} replace />;
  }
  if (me.passwordChangeRequired && !allowPasswordChange) return <Navigate to="/account" replace />;
  return <Outlet context={{ me }} />;
}
