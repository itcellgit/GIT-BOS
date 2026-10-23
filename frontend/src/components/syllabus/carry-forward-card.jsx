// Phase 4 (README §5): a syllabus not started yet can begin from a version of an earlier scheme's syllabus.
import { CopyPlus } from "lucide-react";
import { carryForward } from "@/lib/actions";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * @param {object} props
 * @param {string} props.path      "/syllabi/:schemeId/:courseId"
 * @param {object[]} props.sources { versionId, label, sameCourse }[] from the editor data
 */
export function CarryForwardCard({ path, sources }) {
  if (!sources?.length) return null;
  const best = sources[0];
  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 text-sm">
          <p className="font-medium">Start from an earlier syllabus?</p>
          <p className="text-muted-foreground">
            {best.sameCourse
              ? `This course already has a syllabus in an earlier scheme (${best.label}).`
              : "Your department has syllabi in earlier schemes."}{" "}
            Carrying one forward copies its content here; the checks then use this scheme&apos;s rules, and submitting
            makes it V1.0.
          </p>
        </div>
        <EntityFormDialog
          schema="carryForward"
          title="Carry a syllabus forward"
          description="The content is copied into this syllabus's working copy. The earlier syllabus does not change."
          fields={[
            {
              name: "versionId",
              label: "Start from",
              type: "select",
              options: sources.map((s) => ({ value: s.versionId, label: s.label })),
            },
          ]}
          defaultValues={{ versionId: best.versionId }}
          action={(values) => carryForward(path, values)}
          submitLabel="Carry forward"
          trigger={
            <Button>
              <CopyPlus />
              Carry forward
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
