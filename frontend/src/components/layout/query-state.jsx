import { Link, Navigate } from "react-router";
import { FileQuestion, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2.5 py-20 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
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
      <StatusMessage
        icon={status === 404 ? FileQuestion : TriangleAlert}
        title={status === 404 ? "Not found" : "Something went wrong"}
      >
        {query.error?.message}
      </StatusMessage>
    );
  }
  return children(query.data);
}

/** Centred icon, title, explanation and a way back home: errors, "no access", "not found". */
export function StatusMessage({ icon: Icon, title, children }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {children && <p className="text-sm text-muted-foreground">{children}</p>}
      </div>
      <Button asChild variant="outline">
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  );
}
