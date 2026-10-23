import { useSearchParams } from "react-router";
import { Download, Eye, FileCheck2 } from "lucide-react";
import { formatLabels } from "@acp/shared/domain/schemes/rules";
import { useApiQuery } from "@/hooks/use-api";
import { useDataTable } from "@/hooks/use-data-table";
import { distinctOptions } from "@/lib/data-table";
import { DataTablePagination, DataTableToolbar, NoResultsRow, SortableHead } from "@/components/data-table/data-table";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * The approved (frozen) syllabus of every course in a scheme: anyone with a role can view or
 * download it. Working copies and review history stay with the department.
 */
export function ApprovedSyllabiPage() {
  const [params, setParams] = useSearchParams();
  const schemes = useApiQuery("/schemes");

  return (
    <>
      <PageHeader
        title="Approved syllabi"
        description="Official copies approved by the Academic Council. Each one is frozen at approval, so it always prints exactly as approved."
      />
      <QueryState query={schemes}>
        {({ schemes: list }) => {
          const usable = list.filter((s) => s.status !== "DRAFT");
          const fallback = usable.find((s) => s.status === "PUBLISHED") ?? usable[0];
          const schemeId = usable.some((s) => s.id === params.get("scheme")) ? params.get("scheme") : fallback?.id;
          if (!schemeId) return <EmptyState icon={FileCheck2}>No scheme has been published yet.</EmptyState>;
          return (
            <SchemeSyllabi
              key={schemeId}
              schemes={usable}
              schemeId={schemeId}
              onSchemeChange={(id) => setParams({ scheme: id }, { replace: true })}
            />
          );
        }}
      </QueryState>
    </>
  );
}

function SchemeSyllabi({ schemes, schemeId, onSchemeChange }) {
  const query = useApiQuery(`/schemes/${schemeId}/approved-syllabi`);
  const courses = query.data?.courses ?? [];
  const table = useDataTable({
    id: "approved",
    rows: courses,
    columns: {
      code: { sortValue: (c) => c.code },
      department: { sortValue: (c) => c.department.code },
      semester: { sortValue: (c) => c.semesters[0] ?? null },
      approvedOn: { sortValue: (c) => (c.approvedOn ? new Date(c.approvedOn) : null), firstDir: "desc" },
    },
    searchText: (c) => [c.code, c.title, c.department.code, c.department.name, c.programmes.join(" ")].join(" "),
    filterDefs: {
      semester: (c, v) => c.semesters.includes(Number(v)),
      department: (c, v) => c.department.code === v,
      programme: (c, v) => c.programmes.includes(v),
      format: (c, v) => c.format === v,
    },
  });

  return (
    <div className="space-y-4">
      <DataTableToolbar
        table={table}
        noun={courses.length === 1 ? "approved syllabus" : "approved syllabi"}
        searchLabel="Find a course"
        searchPlaceholder="Course code, title or department"
        start={
          <div>
            <Label htmlFor="scheme" className="mb-1.5 text-xs text-muted-foreground">
              Scheme
            </Label>
            <Select value={schemeId} onValueChange={onSchemeChange}>
              <SelectTrigger id="scheme" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {schemes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.status === "RETIRED" && " (retired)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        filters={[
          {
            key: "semester",
            label: "Semester",
            allLabel: "All semesters",
            width: "w-36",
            options: distinctOptions(
              courses,
              (c) => c.semesters,
              (v) => `Semester ${v}`,
            ),
          },
          {
            key: "department",
            label: "Department",
            allLabel: "All departments",
            options: distinctOptions(courses, (c) => c.department.code),
          },
          {
            key: "programme",
            label: "Programme",
            allLabel: "All programmes",
            options: distinctOptions(courses, (c) => c.programmes),
          },
          {
            key: "format",
            label: "Format",
            allLabel: "All formats",
            options: distinctOptions(
              courses,
              (c) => c.format,
              (v) => formatLabels[v],
            ),
          },
        ]}
      />

      <QueryState query={query}>
        {() =>
          courses.length === 0 ? (
            <EmptyState icon={FileCheck2}>
              No syllabus of this scheme has been approved yet. Approved syllabi appear here after the Academic Council
              approval is recorded.
            </EmptyState>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead table={table} column="code">
                      Course
                    </SortableHead>
                    <SortableHead table={table} column="department" className="hidden md:table-cell">
                      Department
                    </SortableHead>
                    <SortableHead table={table} column="semester" className="hidden md:table-cell">
                      Programmes · Sem
                    </SortableHead>
                    <SortableHead table={table} column="approvedOn" className="hidden sm:table-cell">
                      Approved version
                    </SortableHead>
                    <TableHead className="text-right">Syllabus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.total === 0 && <NoResultsRow table={table} colSpan={5} />}
                  {table.rows.map((c) => {
                    const pdf = `/api/schemes/${schemeId}/approved-syllabi/${c.courseId}/pdf`;
                    return (
                      <TableRow key={c.courseId}>
                        <TableCell className="whitespace-normal">
                          <div className="font-medium">{c.code}</div>
                          <div>{c.title}</div>
                          <div className="text-xs text-muted-foreground">{formatLabels[c.format]}</div>
                          <div className="text-xs text-muted-foreground md:hidden">
                            {c.department.code} · {c.programmes.join(", ") || "—"}
                            {c.semesters.length > 0 && ` · Sem ${c.semesters.join(", ")}`}
                          </div>
                          <div className="mt-1 sm:hidden">
                            <Badge variant="success">
                              <FileCheck2 />
                              {c.versionLabel}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell" title={c.department.name}>
                          {c.department.code}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {c.programmes.join(", ") || "—"}
                          {c.semesters.length > 0 && ` · ${c.semesters.join(", ")}`}
                        </TableCell>
                        <TableCell className="hidden whitespace-normal sm:table-cell">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="success">
                              <FileCheck2 />
                              {c.versionLabel}
                            </Badge>
                            {c.underCorrection && <Badge variant="outline">Correction in progress</Badge>}
                          </div>
                          {c.approvedOn && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Approved {formatDate(c.approvedOn)}
                              {c.reference && ` · ${c.reference}`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button asChild variant="outline" size="sm">
                              <a href={pdf} target="_blank" rel="noreferrer" aria-label={`View ${c.code} syllabus`}>
                                <Eye />
                                View
                              </a>
                            </Button>
                            <Button asChild size="sm">
                              <a href={`${pdf}?download=1`} aria-label={`Download ${c.code} syllabus`}>
                                <Download />
                                Download
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <DataTablePagination table={table} />
            </div>
          )
        }
      </QueryState>
    </div>
  );
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
