import { Link, useNavigate } from "react-router";
import { schemeStatusLabels } from "@acp/shared/labels";
import { useApiQuery } from "@/hooks/use-api";
import { createScheme } from "@/lib/actions";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Plus } from "lucide-react";
export function SchemesPage() {
  const navigate = useNavigate();
  const query = useApiQuery("/schemes");

  return (
    <QueryState query={query}>
      {({ schemes, canConfigure }) => {
        const latest = schemes.find((s) => s.status === "PUBLISHED");
        const fields = [
          {
            name: "cloneFromId",
            label: "Start from",
            type: "select",
            emptyLabel: "A blank scheme",
            options: schemes.map((s) => ({ value: s.id, label: `Copy of ${s.name}` })),
            description:
              "Copying brings over categories, credit patterns, formats, outcome lists, Bloom levels and text blocks.",
          },
          { name: "code", label: "Code", type: "text", width: "third", placeholder: "2028" },
          { name: "name", label: "Name", type: "text", width: "half", placeholder: "2028 Scheme" },
          { name: "effectiveFrom", label: "Effective from", type: "text", width: "third", placeholder: "2028-29" },
          {
            name: "framework",
            label: "Framework",
            type: "text",
            placeholder: "Outcome-Based Education (OBE) and Choice-Based Credit System (CBCS)",
          },
          { name: "teachingWeeks", label: "Teaching weeks per semester", type: "number", width: "half" },
          {
            name: "hoursPerCredit",
            label: "Hours per credit",
            type: "number",
            width: "half",
            description: "Total student hours = credits × this value.",
          },
        ];
        return (
          <>
            <PageHeader
              title="Schemes"
              description="A scheme holds the rules for syllabus framing: course categories, credit patterns, formats and outcome lists. Dean Academics configures it; departments then add their course lists."
              actions={
                canConfigure && (
                  <EntityFormDialog
                    schema="scheme"
                    title="New scheme"
                    description="The new scheme starts as a draft. Publish it when the configuration is complete."
                    fields={fields}
                    defaultValues={{
                      cloneFromId: latest?.id ?? "",
                      code: "",
                      name: "",
                      effectiveFrom: "",
                      framework: latest?.framework ?? "",
                      teachingWeeks: latest?.teachingWeeks ?? 14,
                      hoursPerCredit: latest?.hoursPerCredit ?? 30,
                    }}
                    action={createScheme}
                    onSuccess={(result) => navigate(`/schemes/${result.data.id}`)}
                    submitLabel="Create draft"
                    trigger={
                      <Button>
                        <Plus />
                        New scheme
                      </Button>
                    }
                  />
                )
              }
            />
            {schemes.length === 0 ? (
              <EmptyState>No schemes yet.</EmptyState>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scheme</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Effective from</TableHead>
                      <TableHead className="text-right">Categories</TableHead>
                      <TableHead className="text-right">Courses (all departments)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schemes.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link to={`/schemes/${s.id}`} className="font-medium underline-offset-4 hover:underline">
                            {s.name}
                          </Link>
                          {s.clonedFrom && (
                            <div className="text-xs text-muted-foreground">Copied from {s.clonedFrom.name}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              s.status === "PUBLISHED" ? "success" : s.status === "DRAFT" ? "warning" : "outline"
                            }
                          >
                            {schemeStatusLabels[s.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{s.effectiveFrom ?? "—"}</TableCell>
                        <TableCell className="text-right">{s._count.categories}</TableCell>
                        <TableCell className="text-right">{s._count.schemeCourses}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        );
      }}
    </QueryState>
  );
}
