import { Link, useOutletContext } from "react-router";
import { BookOpen, Building2, ChevronRight, Layers } from "lucide-react";
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
  const showSchemes = can(me, "scheme.view");

  return (
    <>
      <PageHeader
        title={`Welcome, ${me.name.split(" ")[0]}`}
        description={`${today()} · Your work in the Academic Curriculum Portal.`}
      />
      <QueryState query={query}>
        {({ assignments, departments, schemes }) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile icon={BookOpen} label="Courses assigned to me" value={assignments.length} />
              {departments.length > 0 && (
                <StatTile icon={Building2} label="Departments I coordinate" value={departments.length} />
              )}
              {showSchemes && (
                <StatTile
                  icon={Layers}
                  label="Active schemes"
                  value={schemes.length}
                  detail={`${schemes.filter((s) => s.status === "PUBLISHED").length} published`}
                />
              )}
            </div>

            <Card className="gap-0 pb-0">
              <CardHeader className="border-b">
                <CardTitle>My courses</CardTitle>
                <CardDescription>Courses for which you are framing the syllabus. Open one to edit it.</CardDescription>
              </CardHeader>
              {assignments.length === 0 ? (
                <CardContent className="py-5">
                  <EmptyState icon={BookOpen}>
                    No courses assigned yet. Your BoS Coordinator assigns courses.
                  </EmptyState>
                </CardContent>
              ) : (
                <ul className="divide-y">
                  {assignments.map((a) => (
                    <li key={a.id} className="group relative flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40">
                      <span className="hidden size-10 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary ring-1 ring-primary/15 sm:flex">
                        <BookOpen className="size-4.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          className="font-medium after:absolute after:inset-0 group-hover:text-primary"
                          to={`/syllabi/${a.schemeId}/${a.courseId}`}
                        >
                          <span className="font-semibold tabular-nums">{a.code}</span> — {a.title}
                        </Link>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {a.schemeName}
                          {a.programmes.length > 0 && ` · ${a.programmes.join(", ")} · Semester ${a.semester}`}
                          {a.format && ` · ${formatLabels[a.format]}`}
                        </div>
                      </div>
                      <Badge variant={a.role === "COORDINATOR" ? "secondary" : "outline"}>
                        {a.role === "COORDINATOR" ? "Coordinator" : "Co-author"}
                      </Badge>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {(departments.length > 0 || showSchemes) && (
              <div className="grid gap-6 lg:grid-cols-2">
                {departments.length > 0 && (
                  <LinkListCard
                    title="My departments"
                    description="Course lists, reviewers, meetings and faculty assignments."
                    items={departments.map((d) => ({
                      key: d.id,
                      href: `/departments/${d.code}`,
                      primary: d.code,
                      secondary: d.name,
                    }))}
                  />
                )}
                {showSchemes && (
                  <LinkListCard
                    title="Schemes"
                    description={
                      can(me, "scheme.configure")
                        ? "Configure schemes, course categories, formats and outcome lists."
                        : "Scheme rules that apply to syllabus framing."
                    }
                    items={schemes.map((s) => ({
                      key: s.id,
                      href: `/schemes/${s.id}`,
                      primary: s.name,
                      badge: (
                        <Badge
                          variant={s.status === "PUBLISHED" ? "success" : s.status === "DRAFT" ? "warning" : "outline"}
                          className="capitalize"
                        >
                          {s.status.toLowerCase()}
                        </Badge>
                      ),
                    }))}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </QueryState>
    </>
  );
}

function StatTile({ icon: Icon, label, value, detail }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-xs sm:p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary ring-1 ring-primary/15 sm:size-11">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
          {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
        </p>
      </div>
    </div>
  );
}

function LinkListCard({ title, description, items }) {
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.key} className="group relative flex items-center gap-3 px-5 py-3 text-sm hover:bg-muted/40">
            <Link
              to={item.href}
              className="min-w-0 flex-1 font-medium after:absolute after:inset-0 group-hover:text-primary"
            >
              {item.primary}
              {item.secondary && <span className="font-normal text-muted-foreground"> — {item.secondary}</span>}
            </Link>
            {item.badge}
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground/60 group-hover:text-primary"
              aria-hidden="true"
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function today() {
  return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
