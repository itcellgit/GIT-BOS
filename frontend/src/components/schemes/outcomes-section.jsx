import { outcomeKindLabels } from "@acp/shared/labels";
import { outcomeKinds } from "@acp/shared/schemas/config";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { Button } from "@/components/ui/button";
import { deleteOutcomeItem, saveOutcomeItem } from "@/lib/actions";
const fields = [
  {
    name: "kind",
    label: "List",
    type: "select",
    options: outcomeKinds.map((k) => ({ value: k, label: outcomeKindLabels[k] })),
    width: "half",
  },
  { name: "code", label: "Code", type: "text", width: "third", placeholder: "PO1" },
  { name: "title", label: "Title", type: "text" },
  { name: "description", label: "Description (optional)", type: "textarea", rows: 3 },
  { name: "sortOrder", label: "Order", type: "number", width: "third" },
];
export function OutcomesSection({ scheme, editable }) {
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        These lists form the columns of the CO–PO–PSO–WK–SDG tick matrix in every syllabus. PSOs are set per programme
        by the department&apos;s BoS Coordinator.
      </p>
      {outcomeKinds.map((kind) => {
        const items = scheme.outcomes.filter((o) => o.kind === kind);
        return (
          <section key={kind} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium">{outcomeKindLabels[kind]}</h2>
              {editable && (
                <EntityFormDialog
                  schema="outcomeItem"
                  title={`Add to ${outcomeKindLabels[kind]}`}
                  fields={fields}
                  defaultValues={{
                    kind,
                    code: `${kind}${items.length + 1}`,
                    title: "",
                    description: "",
                    sortOrder: items.length,
                  }}
                  action={saveOutcomeItem.bind(null, scheme.id, null)}
                  trigger={
                    <Button variant="outline" size="sm">
                      Add
                    </Button>
                  }
                />
              )}
            </div>
            <ul className="divide-y rounded-lg border">
              {items.length === 0 && <li className="p-3 text-sm text-muted-foreground">None yet.</li>}
              {items.map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                  <div>
                    <span className="inline-block w-16 font-mono font-medium">{o.code}</span>
                    {o.title}
                    {o.description && <p className="ml-16 text-xs text-muted-foreground">{o.description}</p>}
                  </div>
                  {editable && (
                    <div className="flex shrink-0 gap-1">
                      <EntityFormDialog
                        schema="outcomeItem"
                        title={`Edit ${o.code}`}
                        fields={fields}
                        defaultValues={{
                          kind: o.kind,
                          code: o.code,
                          title: o.title,
                          description: o.description ?? "",
                          sortOrder: o.sortOrder,
                        }}
                        action={saveOutcomeItem.bind(null, scheme.id, o.id)}
                        trigger={
                          <Button variant="ghost" size="xs">
                            Edit
                          </Button>
                        }
                      />
                      <ConfirmActionButton
                        action={deleteOutcomeItem.bind(null, scheme.id, o.id)}
                        label="Delete"
                        variant="ghost"
                        size="xs"
                        title={`Delete ${o.code}?`}
                        description="It will no longer appear as a column in the mapping matrix."
                        confirmLabel="Delete"
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
