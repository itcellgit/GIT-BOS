import { Link, useOutletContext } from "react-router";
import { BookOpen, Building2, Layers } from "lucide-react";
import { can } from "@acp/shared/domain/auth/permissions";
import { formatLabels } from "@acp/shared/domain/schemes/rules";
import { useApiQuery } from "@/hooks/use-api";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function HomePage() {
  const { me } = useOutletContext();
  const query = useApiQuery("/home");

  return (
    <>
      <PageHeader
        title={`Welcome, ${me.name.split(" ")[0]}`}
        description="Your work in the Academic Curriculum Portal."
      />
      <QueryState query={query}>
        {({ assignments, departments, schemes }) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <BookOpen className="size-4" />
                  </span>
                  My courses
                </CardTitle>
                <CardDescription>Courses for which you are framing the syllabus. Open one to edit it.</CardDescription>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <EmptyState>No courses assigned yet. Your BoS Coordinator assigns courses.</EmptyState>
                ) : (
                  <ul className="divide-y">
                    {assignments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div>
                          <Link
                            className="font-medium text-primary underline-offset-4 hover:underline"
                            to={`/syllabi/${a.schemeId}/${a.courseId}`}
                          >
                            {a.code} — {a.title}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {a.schemeName}
                            {a.programmes.length > 0 && ` · ${a.programmes.join(", ")} · Semester ${a.semester}`}
                            {a.format && ` · ${formatLabels[a.format]}`}
                          </div>
                        </div>
                        <Badge variant="outline">{a.role === "COORDINATOR" ? "Coordinator" : "Co-author"}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {departments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-chart-2/15 text-chart-2">
                      <Building2 className="size-4" />
                    </span>
                    My departments
                  </CardTitle>
                  <CardDescription>Course lists, reviewers and faculty assignments.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {departments.map((d) => (
                      <li key={d.id}>
                        <Link className="font-medium underline-offset-4 hover:underline" to={`/departments/${d.code}`}>
                          {d.code} — {d.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {can(me, "scheme.view") && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-chart-3/20 text-warning-foreground dark:text-chart-3">
                      <Layers className="size-4" />
                    </span>
                    Schemes
                  </CardTitle>
                  <CardDescription>
                    {can(me, "scheme.configure")
                      ? "Configure schemes, course categories, formats and outcome lists."
                      : "Scheme rules that apply to syllabus framing."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {schemes.map((s) => (
                      <li key={s.id} className="flex items-center gap-2">
                        <Link className="font-medium underline-offset-4 hover:underline" to={`/schemes/${s.id}`}>
                          {s.name}
                        </Link>
                        <Badge
                          variant={s.status === "PUBLISHED" ? "success" : s.status === "DRAFT" ? "warning" : "outline"}
                        >
                          {s.status.toLowerCase()}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </QueryState>
    </>
  );
}
