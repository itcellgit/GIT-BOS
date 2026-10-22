import { Link, Navigate } from "react-router";
import { Button } from "@/components/ui/button";

export function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground" role="status">
      Loading…
    </div>
  );
}

/**
 * Renders a page's data query: loading text, the right screen for errors (signed out, no access,
 * not found), or `children(data)` once loaded.
 */
export function QueryState({ query, children }) {
  if (query.isPending) return <LoadingScreen />;
  if (query.isError) {
    const status = query.error?.status;
    if (status === 401) return <Navigate to="/login" replace />;
    if (status === 403) {
      if (query.error?.code === "PASSWORD_CHANGE_REQUIRED") return <Navigate to="/account" replace />;
      return <Navigate to="/no-access" replace />;
    }
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-xl font-semibold">{status === 404 ? "Not found" : "Something went wrong"}</h1>
        <p className="text-sm text-muted-foreground">{query.error?.message}</p>
        <Button asChild variant="outline">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    );
  }
  return children(query.data);
}
