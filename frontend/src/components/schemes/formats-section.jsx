import { formatLabels } from "@acp/shared/domain/schemes/rules";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveFormatConfig } from "@/lib/actions";
import { SectionLayoutDialog } from "@/components/schemes/section-layout-dialog";
import { Pencil } from "lucide-react";
const fields = [
  { name: "title", label: "Heading printed on the syllabus", type: "text" },
  { name: "unitCount", label: "Number of units", type: "number", width: "third" },
  { name: "experimentCount", label: "Regular experiments", type: "number", width: "third" },
  { name: "openEndedCount", label: "Open-ended experiments", type: "number", width: "third" },
  { name: "cloMin", label: "Course objectives — min", type: "number", width: "third" },
  { name: "cloMax", label: "Course objectives — max", type: "number", width: "third" },
  { name: "coMin", label: "COs — min", type: "number", width: "third" },
  { name: "coMax", label: "COs — max", type: "number", width: "third" },
  { name: "prerequisiteLabel", label: "Pre-requisites heading", type: "text", width: "half" },
  { name: "hasReferenceBooks", label: "Include a Reference Books section", type: "checkbox" },
];
export function FormatsSection({ scheme, editable }) {
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Settings for each syllabus format. The printed layout follows the institution&apos;s 2025 templates; use
        Sections to change the order of the sections, turn optional ones off, or rename headings.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {scheme.formats.map((f) => (
          <Card key={f.id}>
            <CardHeader>
              <CardTitle>{formatLabels[f.format]}</CardTitle>
              <CardDescription>{f.title}</CardDescription>
              <CardAction className="flex gap-2">
                <SectionLayoutDialog schemeId={scheme.id} format={f} editable={editable} />
                {editable && (
                  <EntityFormDialog
                    schema="formatConfig"
                    title={`${formatLabels[f.format]} format`}
                    fields={fields}
                    defaultValues={{
                      title: f.title,
                      unitCount: f.unitCount,
                      experimentCount: f.experimentCount,
                      openEndedCount: f.openEndedCount,
                      cloMin: f.cloMin,
                      cloMax: f.cloMax,
                      coMin: f.coMin,
                      coMax: f.coMax,
                      prerequisiteLabel: f.prerequisiteLabel,
                      hasReferenceBooks: f.hasReferenceBooks,
                    }}
                    action={saveFormatConfig.bind(null, scheme.id, f.id)}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil />
                        Edit
                      </Button>
                    }
                  />
                )}
              </CardAction>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Units</dt>
                <dd>{f.unitCount || "—"}</dd>
                <dt className="text-muted-foreground">Experiments</dt>
                <dd>
                  {f.experimentCount + f.openEndedCount ? `${f.experimentCount} + ${f.openEndedCount} open-ended` : "—"}
                </dd>
                <dt className="text-muted-foreground">Course objectives</dt>
                <dd>
                  {f.cloMin}–{f.cloMax}
                </dd>
                <dt className="text-muted-foreground">Course outcomes</dt>
                <dd>
                  {f.coMin}–{f.coMax}
                </dd>
                <dt className="text-muted-foreground">Pre-requisites heading</dt>
                <dd>{f.prerequisiteLabel}</dd>
                <dt className="text-muted-foreground">Reference books</dt>
                <dd>{f.hasReferenceBooks ? "Yes" : "No"}</dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
