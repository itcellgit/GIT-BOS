import { Link } from "react-router";
import { useApiQuery } from "@/hooks/use-api";
import { saveDepartment, saveProgramme } from "@/lib/actions";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { InstitutionCard } from "@/components/forms/institution-card";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Building2, Pencil, Plus } from "lucide-react";
const departmentFields = [
  { name: "code", label: "Code", type: "text", width: "third", placeholder: "CSE" },
  { name: "name", label: "Name", type: "text", width: "full", placeholder: "Computer Science and Engineering" },
  { name: "isActive", label: "Active", type: "checkbox" },
];

export function AdminDepartmentsPage() {
  const query = useApiQuery("/admin/departments");
  return <QueryState query={query}>{(departments) => <Departments departments={departments} />}</QueryState>;
}

function Departments({ departments }) {
  const programmeFields = [
    {
      name: "departmentId",
      label: "Department",
      type: "select",
      options: departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` })),
      width: "half",
    },
    {
      name: "level",
      label: "Level",
      type: "select",
      options: [
        { value: "UG", label: "UG" },
        { value: "PG", label: "PG" },
      ],
      width: "half",
    },
    { name: "code", label: "Code", type: "text", width: "third", placeholder: "BE-CSE" },
    {
      name: "name",
      label: "Name",
      type: "text",
      width: "full",
      placeholder: "B.E. in Computer Science and Engineering",
    },
  ];

  return (
    <>
      <PageHeader
        title="Departments and programmes"
        description="Departments own courses and syllabi. Each programme belongs to one department."
        actions={
          <EntityFormDialog
            schema="department"
            title="Add department"
            fields={departmentFields}
            defaultValues={{ code: "", name: "", isActive: true }}
            action={saveDepartment.bind(null, null)}
            trigger={
              <Button>
                <Plus />
                Add department
              </Button>
            }
          />
        }
      />
      <InstitutionCard />
      <div className="grid gap-4 lg:grid-cols-2">
        {departments.map((d) => (
          <Card key={d.id} className={d.isActive ? undefined : "opacity-60"}>
            <CardHeader>
              <CardTitle>
                <Building2 />
                {d.code} {!d.isActive && <Badge variant="outline">inactive</Badge>}
              </CardTitle>
              <CardDescription>
                {d.name} ·{" "}
                <Link to={`/departments/${d.code}`} className="underline-offset-4 hover:underline">
                  Open department page
                </Link>
              </CardDescription>
              <CardAction>
                <EntityFormDialog
                  schema="department"
                  title="Edit department"
                  fields={departmentFields}
                  defaultValues={{ code: d.code, name: d.name, isActive: d.isActive }}
                  action={saveDepartment.bind(null, d.id)}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Pencil />
                      Edit
                    </Button>
                  }
                />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Programmes</p>
              {d.programmes.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
              <ul className="space-y-1">
                {d.programmes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      <span className="font-medium">{p.code}</span> — {p.name}
                    </span>
                    <EntityFormDialog
                      schema="programme"
                      title="Edit programme"
                      fields={programmeFields}
                      defaultValues={{ departmentId: p.departmentId, code: p.code, name: p.name, level: p.level }}
                      action={saveProgramme.bind(null, p.id)}
                      trigger={
                        <Button variant="ghost" size="xs">
                          <Pencil />
                          Edit
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
              <EntityFormDialog
                schema="programme"
                title={`Add programme — ${d.code}`}
                fields={programmeFields}
                defaultValues={{ departmentId: d.id, code: "", name: "", level: "UG" }}
                action={saveProgramme.bind(null, null)}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus />
                    Add programme
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
