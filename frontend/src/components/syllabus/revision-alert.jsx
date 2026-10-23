// "Needs revision": scheme amendments made since the last version that may affect this syllabus (README §5).
import { CheckCheck, TriangleAlert } from "lucide-react";
import { resolveRevision } from "@/lib/actions";
import { formatDate } from "@/lib/download";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * @param {object} props
 * @param {string} props.path       "/syllabi/:schemeId/:courseId"
 * @param {object[]} props.flags    open flags: { id, summary, at, by, errorCount, warningCount }
 * @param {boolean} props.canReview the BoS Coordinator may record that no change is needed
 */
export function RevisionAlert({ path, flags, canReview }) {
  if (!flags?.length) return null;
  return (
    <Alert className="mb-6 border-warning/60 bg-warning/10">
      <TriangleAlert />
      <AlertTitle>Needs revision: the scheme was amended</AlertTitle>
      <AlertDescription>
        <ul className="my-1 list-disc space-y-0.5 pl-5">
          {flags.map((f) => (
            <li key={f.id}>
              {f.summary} <span className="text-muted-foreground">({formatDate(f.at)})</span>
              {f.errorCount != null && (
                <span className="text-muted-foreground">
                  {" "}
                  · checks after the change:{" "}
                  {f.errorCount === 0 ? "no errors" : `${f.errorCount} ${f.errorCount === 1 ? "error" : "errors"}`}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p>
          Review the syllabus against the new rules (see the checks below). Saving the next version clears this flag.
        </p>
        {canReview && (
          <EntityFormDialog
            schema="resolveRevision"
            title="No change needed?"
            description="Record why the amendment does not affect this syllabus. The note is kept in the audit log."
            fields={[{ name: "reason", label: "Note", type: "textarea", rows: 3 }]}
            defaultValues={{ reason: "" }}
            action={(values) => resolveRevision(path, values)}
            submitLabel="Clear the flag"
            trigger={
              <Button size="sm" variant="outline" className="mt-2">
                <CheckCheck />
                No change needed
              </Button>
            }
          />
        )}
      </AlertDescription>
    </Alert>
  );
}
