import { expectedHours, formatCredits, formatLabels } from "@acp/shared/domain/schemes/rules";
import { formats } from "@acp/shared/schemas/config";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { EmptyState } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addCreditPattern, deleteCategory, deleteCreditPattern, saveCategory } from "@/lib/actions";
const formatOptions = formats.map((f) => ({ value: f, label: formatLabels[f] }));
const categoryFields = [
  { name: "code", label: "Code", type: "text", width: "third", placeholder: "PCC" },
  { name: "name", label: "Full name", type: "text", width: "full", placeholder: "Professional Core Course" },
  { name: "cieMarks", label: "CIE marks", type: "number", width: "third" },
  { name: "hasSee", label: "Has SEE", type: "checkbox", width: "third" },
  { name: "seeMarks", label: "SEE marks", type: "number", width: "third" },
  { name: "allowedFormats", label: "Allowed syllabus formats", type: "multiselect", options: formatOptions },
  {
    name: "defaultFormat",
    label: "Default format",
    type: "select",
    emptyLabel: "— None —",
    options: formatOptions,
    width: "half",
  },
  { name: "syllabusRequired", label: "Syllabus required", type: "checkbox", width: "half" },
  { name: "passFail", label: "Pass/fail course (PP) — no credits, hour rule not applied", type: "checkbox" },
];
const patternFields = [
  { name: "lCredits", label: "L credits", type: "number", width: "third" },
  { name: "tCredits", label: "T credits", type: "number", width: "third" },
  { name: "pCredits", label: "P credits", type: "number", width: "third" },
  { name: "lHours", label: "L hours / week", type: "number", width: "third" },
  { name: "tHours", label: "T hours / week", type: "number", width: "third" },
  { name: "pHours", label: "P hours / week", type: "number", width: "third" },
];
export function CategoriesSection({ scheme, editable }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Each category lists the credit patterns it allows. Semester hours are worked out from the weekly hours ×{" "}
          {scheme.teachingWeeks} weeks, and TW &amp; SL from credits × {scheme.hoursPerCredit} h minus contact hours.
        </p>
        {editable && (
          <EntityFormDialog
            schema="category"
            title="Add course category"
            fields={categoryFields}
            defaultValues={{
              code: "",
              name: "",
              cieMarks: 100,
              hasSee: true,
              seeMarks: 100,
              allowedFormats: ["THEORY"],
              defaultFormat: "THEORY",
              syllabusRequired: true,
              passFail: false,
            }}
            action={saveCategory.bind(null, scheme.id, null)}
            trigger={<Button>Add category</Button>}
          />
        )}
      </div>
      {scheme.categories.length === 0 && <EmptyState>No categories yet.</EmptyState>}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Marks (CIE / SEE)</TableHead>
              <TableHead>Formats</TableHead>
              <TableHead>Credit patterns → semester hours (L / T / P / TW&amp;SL = total)</TableHead>
              {editable && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {scheme.categories.map((c) => (
              <TableRow key={c.id} className="align-top">
                <TableCell className="min-w-48 whitespace-normal">
                  <div className="font-medium">{c.code}</div>
                  <div className="text-xs text-muted-foreground">{c.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.passFail && <Badge variant="outline">Pass/fail</Badge>}
                    {!c.syllabusRequired && <Badge variant="outline">No syllabus</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  {c.cieMarks} / {c.hasSee ? c.seeMarks : "no SEE"}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {c.allowedFormats.length === 0 ? "—" : c.allowedFormats.map((f) => formatLabels[f]).join(", ")}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {c.passFail ? (
                    <span className="text-sm text-muted-foreground">Not applicable (pass/fail)</span>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {c.creditPatterns.length === 0 && <li className="text-destructive">No credit patterns</li>}
                      {c.creditPatterns.map((p) => {
                        const e = expectedHours(p, scheme);
                        return (
                          <li key={p.id} className="flex items-center gap-2">
                            <span className="font-mono">{formatCredits(p)}</span>
                            <span className="text-muted-foreground">
                              ({p.lHours}:{p.tHours}:{p.pHours} h/wk) → {e.lHours} / {e.tHours} / {e.pHours} /{" "}
                              {e.twSlHours} = {e.total} h
                            </span>
                            {editable && (
                              <ConfirmActionButton
                                action={deleteCreditPattern.bind(null, scheme.id, p.id)}
                                label="×"
                                variant="ghost"
                                size="xs"
                                title="Remove credit pattern?"
                                description={`Remove ${formatCredits(p)} from ${c.code}. Courses using it will be flagged.`}
                                confirmLabel="Remove"
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {editable && !c.passFail && (
                    <EntityFormDialog
                      schema="creditPattern"
                      title={`Add credit pattern — ${c.code}`}
                      description="Credits L:T:P and the weekly contact hours they require."
                      fields={patternFields}
                      defaultValues={{ lCredits: 3, tCredits: 0, pCredits: 0, lHours: 3, tHours: 0, pHours: 0 }}
                      action={addCreditPattern.bind(null, scheme.id, c.id)}
                      trigger={
                        <Button variant="link" size="xs" className="px-0">
                          + Add pattern
                        </Button>
                      }
                    />
                  )}
                </TableCell>
                {editable && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <EntityFormDialog
                        schema="category"
                        title={`Edit ${c.code}`}
                        fields={categoryFields}
                        defaultValues={{
                          code: c.code,
                          name: c.name,
                          cieMarks: c.cieMarks,
                          hasSee: c.hasSee,
                          seeMarks: c.seeMarks ?? "",
                          allowedFormats: c.allowedFormats,
                          defaultFormat: c.defaultFormat ?? "",
                          syllabusRequired: c.syllabusRequired,
                          passFail: c.passFail,
                        }}
                        action={saveCategory.bind(null, scheme.id, c.id)}
                        trigger={
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        }
                      />
                      <ConfirmActionButton
                        action={deleteCategory.bind(null, scheme.id, c.id)}
                        label="Delete"
                        variant="destructive"
                        title={`Delete ${c.code}?`}
                        description="Only categories that no course uses can be deleted."
                        confirmLabel="Delete"
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
