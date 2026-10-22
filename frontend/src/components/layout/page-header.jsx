import { Link } from "react-router";
export function PageHeader({ title, description, back, actions }) {
  return (
    <div className="mb-6 space-y-2 rounded-xl border border-primary/10 bg-gradient-to-r from-primary/10 via-chart-2/5 to-card px-5 py-5 shadow-sm">
      {back && (
        <Link to={back.href} className="text-sm text-muted-foreground hover:text-primary">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
export function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/40 p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
