// Live results of the syllabus validation rules (README §9), computed in the browser with the same
// shared rules the API uses. Errors will block submission (Phase 2); warnings are for review.
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { summarizeIssues } from "@acp/shared/domain/syllabi/validate";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/syllabus/syllabus-sections";

/** Small dot + count shown next to a section name. */
export function SectionIssueCount({ counts }) {
  if (!counts) return null;
  const isError = counts.errors > 0;
  return (
    <span
      className={cn(
        "ml-auto rounded-full px-1.5 text-[0.7rem] font-medium tabular-nums",
        isError ? "bg-destructive/10 text-destructive" : "bg-warning/20 text-warning-foreground dark:text-warning",
      )}
      title={`${counts.errors} errors, ${counts.warnings} warnings`}
    >
      {isError ? counts.errors : counts.warnings}
    </span>
  );
}

export function ChecksPanel({ issues, sectionLabels }) {
  const { errors, warnings } = summarizeIssues(issues);
  const status =
    errors === 0 && warnings === 0 ? (
      <Badge variant="success">All checks pass</Badge>
    ) : (
      <span className="flex gap-1.5">
        {errors > 0 && <Badge variant="destructive">{errors === 1 ? "1 error" : `${errors} errors`}</Badge>}
        {warnings > 0 && <Badge variant="warning">{warnings === 1 ? "1 warning" : `${warnings} warnings`}</Badge>}
      </span>
    );
  // Grouped in the order of the sections on the page.
  const groups = Object.keys(sectionLabels)
    .map((id) => ({ id, label: sectionLabels[id], items: issues.filter((i) => i.section === id) }))
    .filter((g) => g.items.length > 0);

  return (
    <SectionCard
      id="checks"
      title="Checks"
      description="Errors must be fixed before the syllabus can be submitted. Drafts can be saved with errors."
      status={status}
    >
      {groups.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> The syllabus meets every rule of the scheme and the format.
        </p>
      ) : (
        <details open={errors + warnings <= 8} className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground select-none">
            <span className="group-open:hidden">Show the list</span>
            <span className="hidden group-open:inline">Hide the list</span>
          </summary>
          <div className="mt-3 space-y-3">
            {groups.map((g) => (
              <div key={g.id}>
                <a href={`#${g.id}`} className="text-sm font-medium hover:text-primary hover:underline">
                  {g.label}
                </a>
                <ul className="mt-1 space-y-1">
                  {g.items.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {issue.severity === "error" ? (
                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Error" />
                      ) : (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Warning" />
                      )}
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </SectionCard>
  );
}
