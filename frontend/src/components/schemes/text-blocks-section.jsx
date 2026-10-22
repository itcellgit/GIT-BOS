import { formatLabels } from "@acp/shared/domain/schemes/rules";
import { textBlockKindLabels, toOptions } from "@acp/shared/labels";
import { formats } from "@acp/shared/schemas/config";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { EmptyState } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteTextBlock, saveTextBlock } from "@/lib/actions";
const fields = [
  { name: "kind", label: "Type", type: "select", options: toOptions(textBlockKindLabels), width: "half" },
  {
    name: "format",
    label: "Applies to format",
    type: "select",
    emptyLabel: "All formats",
    options: formats.map((f) => ({ value: f, label: formatLabels[f] })),
    width: "half",
  },
  {
    name: "yearOfStudy",
    label: "Year of study (optional)",
    type: "number",
    width: "third",
    description: "e.g. 2 or 3; empty = all years",
  },
  { name: "sortOrder", label: "Order", type: "number", width: "third" },
  { name: "title", label: "Heading", type: "text" },
  { name: "body", label: "Text", type: "textarea", rows: 10, description: "One item per line for lists." },
];
export function TextBlocksSection({ scheme, editable }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Standard text printed in syllabi. Faculty can read it but not change it. The CIE/SEE schemes and rubrics from
          the 2025 templates are added with the print layouts in Phase 1.
        </p>
        {editable && (
          <EntityFormDialog
            schema="textBlock"
            title="Add standard text"
            fields={fields}
            defaultValues={{
              kind: "CIE_SCHEME",
              format: "",
              yearOfStudy: "",
              sortOrder: scheme.textBlocks.length,
              title: "",
              body: "",
            }}
            action={saveTextBlock.bind(null, scheme.id, null)}
            trigger={<Button>Add text</Button>}
          />
        )}
      </div>
      {scheme.textBlocks.length === 0 && <EmptyState>No standard text yet.</EmptyState>}
      <div className="grid gap-4 lg:grid-cols-2">
        {scheme.textBlocks.map((t) => (
          <div key={t.id} className="space-y-2 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{t.title}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="secondary">{textBlockKindLabels[t.kind]}</Badge>
                  <Badge variant="outline">{t.format ? formatLabels[t.format] : "All formats"}</Badge>
                  {t.yearOfStudy && <Badge variant="outline">Year {t.yearOfStudy}</Badge>}
                </div>
              </div>
              {editable && (
                <div className="flex shrink-0 gap-1">
                  <EntityFormDialog
                    schema="textBlock"
                    title="Edit standard text"
                    fields={fields}
                    defaultValues={{
                      kind: t.kind,
                      format: t.format ?? "",
                      yearOfStudy: t.yearOfStudy ?? "",
                      sortOrder: t.sortOrder,
                      title: t.title,
                      body: t.body,
                    }}
                    action={saveTextBlock.bind(null, scheme.id, t.id)}
                    trigger={
                      <Button variant="ghost" size="xs">
                        Edit
                      </Button>
                    }
                  />
                  <ConfirmActionButton
                    action={deleteTextBlock.bind(null, scheme.id, t.id)}
                    label="Delete"
                    variant="ghost"
                    size="xs"
                    title="Delete this text?"
                    description={t.title}
                    confirmLabel="Delete"
                  />
                </div>
              )}
            </div>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {t.body
                .split("\n")
                .filter(Boolean)
                .map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
