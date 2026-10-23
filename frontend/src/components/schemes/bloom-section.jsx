import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { saveBloomLevel } from "@/lib/actions";
import { Pencil } from "lucide-react";
const fields = [
  { name: "name", label: "Name", type: "text", width: "half" },
  {
    name: "shortCode",
    label: "Short code",
    type: "text",
    width: "third",
    description: "Shown in the CO table, e.g. Re, Un, Ap",
  },
  {
    name: "verbs",
    label: "Action verbs",
    type: "textarea",
    rows: 4,
    description: "Separate with commas or new lines.",
  },
];
export function BloomSection({ scheme, editable }) {
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Bloom&apos;s taxonomy levels used for Course Outcomes. From Phase 1, each CO&apos;s action verb is checked
        against these lists.
      </p>
      <ul className="divide-y rounded-lg border">
        {scheme.bloomLevels.map((b) => (
          <li key={b.id} className="flex items-start justify-between gap-3 px-3 py-3">
            <div className="space-y-1.5">
              <div className="text-sm font-medium">
                L{b.level} · {b.name} <span className="text-muted-foreground">({b.shortCode})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {b.verbs.map((v) => (
                  <Badge key={v} variant="secondary">
                    {v}
                  </Badge>
                ))}
              </div>
            </div>
            {editable && (
              <EntityFormDialog
                schema="bloomLevel"
                title={`Level ${b.level} — ${b.name}`}
                fields={fields}
                defaultValues={{ name: b.name, shortCode: b.shortCode, verbs: b.verbs.join(", ") }}
                action={saveBloomLevel.bind(null, scheme.id, b.id)}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil />
                    Edit
                  </Button>
                }
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
