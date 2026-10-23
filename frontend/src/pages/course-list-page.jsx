import { useState } from "react";
import { useParams } from "react-router";
import { formatCredits, formatLabels, totalCredits } from "@acp/shared/domain/schemes/rules";
import { schemeStatusLabels } from "@acp/shared/labels";
import { formats } from "@acp/shared/schemas/config";
import { useApiQuery } from "@/hooks/use-api";
import {
  copyCourseList,
  deleteElectiveGroup,
  deletePso,
  deleteSchemeCourse,
  importCourses,
  saveElectiveGroup,
  savePso,
  saveSchemeCourse,
  workbookUrl,
} from "@/lib/actions";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { CourseImportDialog } from "@/components/forms/course-import-dialog";
import { SyllabusBookMenu } from "@/components/forms/syllabus-book-menu";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { CalendarRange, Copy, FileSpreadsheet, Pencil, Plus, Shuffle, Target, Trash2 } from "lucide-react";
const groupFields = [
  { name: "semester", label: "Semester", type: "number", width: "third" },
  { name: "code", label: "Group code", type: "text", width: "third", placeholder: "1BCSL308x" },
  { name: "title", label: "Title", type: "text", placeholder: "Ability Enhancement Course Laboratory" },
];

const psoFields = [
  { name: "code", label: "Code", type: "text", width: "third", placeholder: "PSO1" },
  { name: "sortOrder", label: "Order", type: "number", width: "third" },
  { name: "title", label: "Statement", type: "textarea", rows: 3 },
];

/** BoS Coordinator: a programme's course list under a scheme (Layer 2). Others with access see it read-only. */
export function CourseListPage() {
  const { schemeId, programmeId } = useParams();
  const query = useApiQuery(`/schemes/${schemeId}/programmes/${programmeId}`);
  return <QueryState query={query}>{(data) => <CourseList {...data} />}</QueryState>;
}

function CourseList({
  scheme,
  programme,
  courses: rows,
  electiveGroups,
  psos,
  departments,
  editable,
  courseRules,
  copySources,
}) {
  const [copyResult, setCopyResult] = useState(null);
  const rowsWithIssues = rows.filter((r) => r.issues.length > 0).length;
  const semesters = [...new Set([...rows.map((r) => r.semester), ...electiveGroups.map((g) => g.semester)])].sort(
    (a, b) => a - b,
  );

  const courseFields = [
    { name: "semester", label: "Semester", type: "number", width: "third" },
    { name: "code", label: "Course code", type: "text", width: "third", placeholder: "1BCS304" },
    { name: "examHours", label: "SEE duration (hours)", type: "number", width: "third" },
    { name: "title", label: "Course title", type: "text" },
    {
      name: "categoryId",
      label: "Category",
      type: "select",
      options: scheme.categories.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
      width: "half",
    },
    {
      name: "format",
      label: "Syllabus format",
      type: "select",
      emptyLabel: "— None (no syllabus) —",
      options: formats.map((f) => ({ value: f, label: formatLabels[f] })),
      width: "half",
    },
    {
      name: "teachingDepartmentId",
      label: "Teaching department",
      type: "select",
      options: departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` })),
      width: "half",
    },
    {
      name: "electiveGroupId",
      label: "Elective group",
      type: "select",
      emptyLabel: "— Not an elective option —",
      options: electiveGroups.map((g) => ({ value: g.id, label: `${g.code} (Sem ${g.semester})` })),
      width: "half",
    },
    { name: "lCredits", label: "L credits", type: "number", width: "third" },
    { name: "tCredits", label: "T credits", type: "number", width: "third" },
    { name: "pCredits", label: "P credits", type: "number", width: "third" },
    { name: "lHours", label: "L hours (semester)", type: "number", width: "third" },
    { name: "tHours", label: "T hours (semester)", type: "number", width: "third" },
    { name: "pHours", label: "P hours (semester)", type: "number", width: "third" },
    { name: "twSlHours", label: "TW & SL hours", type: "number", width: "third" },
    { name: "cieMarks", label: "CIE marks", type: "number", width: "third" },
    { name: "seeMarks", label: "SEE marks", type: "number", width: "third" },
  ];
  const workbook = workbookUrl(scheme.id, programme.id);

  return (
    <>
      <PageHeader
        back={{ href: `/schemes/${scheme.id}`, label: scheme.name }}
        title={`${programme.code} — course list`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {programme.name} · {scheme.name}
            <Badge
              variant={scheme.status === "PUBLISHED" ? "success" : scheme.status === "DRAFT" ? "warning" : "outline"}
            >
              {schemeStatusLabels[scheme.status]}
            </Badge>
          </span>
        }
        actions={
          <>
            {semesters.length > 0 && (
              <SyllabusBookMenu
                basePath={`/schemes/${scheme.id}/programmes/${programme.id}`}
                fileStem={`${programme.code}_${scheme.code}`}
                semesters={semesters}
              />
            )}
            <Button asChild variant="outline">
              <a href={workbook}>
                <FileSpreadsheet />
                Download Excel
              </a>
            </Button>
            {editable && copySources.length > 0 && (
              <EntityFormDialog
                schema="copyCourseList"
                title="Copy the course list from another scheme"
                description={`Courses are copied into ${scheme.name} with their categories matched by code and checked against this scheme's rules. Courses already in the list are left alone; elective groups come along, and PSOs when this programme has none yet.`}
                fields={[
                  {
                    name: "fromSchemeId",
                    label: "Copy from",
                    type: "select",
                    options: copySources.map((s) => ({ value: s.id, label: `${s.name} (${s.courseCount} courses)` })),
                  },
                  { name: "withAssignments", label: "Also copy the faculty assigned to each course", type: "checkbox" },
                ]}
                defaultValues={{
                  fromSchemeId:
                    (scheme.clonedFromId && copySources.find((s) => s.id === scheme.clonedFromId)?.id) ??
                    copySources[0].id,
                  withAssignments: true,
                }}
                action={copyCourseList.bind(null, scheme.id, programme.id)}
                onSuccess={(result) => setCopyResult(result.data)}
                submitLabel="Copy courses"
                trigger={
                  <Button variant="outline">
                    <Copy />
                    Copy from a scheme
                  </Button>
                }
              />
            )}
            {editable && (
              <>
                <CourseImportDialog
                  action={importCourses.bind(null, scheme.id, programme.id)}
                  templateHref={workbook}
                />
                <EntityFormDialog
                  schema="schemeCourse"
                  title="Add course"
                  description="Use the credit-pattern buttons to fill hours and marks from the scheme rules."
                  fields={courseFields}
                  courseRules={courseRules}
                  defaultValues={{
                    semester: semesters.at(-1) ?? 1,
                    code: "",
                    title: "",
                    categoryId: "",
                    format: "",
                    teachingDepartmentId: programme.departmentId,
                    electiveGroupId: "",
                    lCredits: "",
                    tCredits: "",
                    pCredits: "",
                    lHours: "",
                    tHours: "",
                    pHours: "",
                    twSlHours: "",
                    cieMarks: "",
                    seeMarks: "",
                    examHours: "",
                  }}
                  action={saveSchemeCourse.bind(null, scheme.id, programme.id, null)}
                  trigger={
                    <Button>
                      <Plus />
                      Add course
                    </Button>
                  }
                />
              </>
            )}
          </>
        }
      />

      {scheme.status === "DRAFT" && (
        <Alert className="mb-6">
          <AlertTitle>Scheme not published yet</AlertTitle>
          <AlertDescription>Course lists can be edited once Dean Academics publishes {scheme.name}.</AlertDescription>
        </Alert>
      )}
      {rowsWithIssues > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>{rowsWithIssues} course(s) do not match the current scheme rules</AlertTitle>
          <AlertDescription>
            This can happen after Dean Academics changes a category or credit pattern. Open the course to see what to
            correct.
          </AlertDescription>
        </Alert>
      )}

      {copyResult && (
        <Alert className="mb-6">
          <Copy />
          <AlertTitle>
            {copyResult.copied.length} course(s) copied
            {copyResult.assignments > 0 && `, ${copyResult.assignments} faculty assignment(s)`}
            {copyResult.groups > 0 && `, ${copyResult.groups} elective group(s)`}
            {copyResult.psos > 0 && `, ${copyResult.psos} PSO(s)`}
          </AlertTitle>
          {copyResult.skipped.length > 0 && (
            <AlertDescription>
              <p>Not copied — add or correct these by hand:</p>
              <ul className="list-disc pl-5">
                {copyResult.skipped.map((s) => (
                  <li key={s.code}>
                    <span className="font-medium">{s.code}</span>: {s.reason}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}

      {rows.length === 0 && (
        <EmptyState>
          No courses yet. Add them one by one, import an Excel workbook
          {copySources.length > 0 && ", or copy the list from an earlier scheme"}.
        </EmptyState>
      )}

      <div className="space-y-8">
        {semesters.map((sem) => (
          <SemesterTable
            key={sem}
            semester={sem}
            rows={rows.filter((r) => r.semester === sem)}
            groups={electiveGroups.filter((g) => g.semester === sem)}
            editable={editable}
            renderEdit={(r) => (
              <EntityFormDialog
                schema="schemeCourse"
                title={`Edit ${r.course.code}`}
                fields={courseFields}
                courseRules={courseRules}
                defaultValues={{
                  semester: r.semester,
                  code: r.course.code,
                  title: r.course.title,
                  categoryId: r.categoryId,
                  format: r.format ?? "",
                  teachingDepartmentId: r.teachingDepartmentId,
                  electiveGroupId: r.electiveGroupId ?? "",
                  lCredits: r.lCredits,
                  tCredits: r.tCredits,
                  pCredits: r.pCredits,
                  lHours: r.lHours,
                  tHours: r.tHours,
                  pHours: r.pHours,
                  twSlHours: r.twSlHours,
                  cieMarks: r.cieMarks,
                  seeMarks: r.seeMarks ?? "",
                  examHours: r.examHours ?? "",
                }}
                action={saveSchemeCourse.bind(null, scheme.id, programme.id, r.id)}
                trigger={
                  <Button variant="outline" size="xs">
                    <Pencil />
                    Edit
                  </Button>
                }
              />
            )}
            renderDelete={(r) => (
              <ConfirmActionButton
                action={deleteSchemeCourse.bind(null, scheme.id, programme.id, r.id)}
                label="Remove"
                icon={Trash2}
                variant="ghost"
                size="xs"
                title={`Remove ${r.course.code} from the list?`}
                description="The course is removed from this programme's list. Faculty assignments stay with the course."
                confirmLabel="Remove"
              />
            )}
          />
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Shuffle className="size-4.5 text-muted-foreground" aria-hidden="true" />
              Elective groups
            </h2>
            {editable && (
              <EntityFormDialog
                schema="electiveGroup"
                title="Add elective group"
                fields={groupFields}
                defaultValues={{ semester: semesters.at(-1) ?? 1, code: "", title: "" }}
                action={saveElectiveGroup.bind(null, scheme.id, programme.id, null)}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus />
                    Add group
                  </Button>
                }
              />
            )}
          </div>
          <ul className="divide-y rounded-lg border text-sm">
            {electiveGroups.length === 0 && <li className="p-3 text-muted-foreground">None.</li>}
            {electiveGroups.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-medium">{g.code}</span> · Sem {g.semester} · {g.title}
                </span>
                {editable && (
                  <span className="flex gap-1">
                    <EntityFormDialog
                      schema="electiveGroup"
                      title={`Edit ${g.code}`}
                      fields={groupFields}
                      defaultValues={{ semester: g.semester, code: g.code, title: g.title }}
                      action={saveElectiveGroup.bind(null, scheme.id, programme.id, g.id)}
                      trigger={
                        <Button variant="ghost" size="xs">
                          <Pencil />
                          Edit
                        </Button>
                      }
                    />
                    <ConfirmActionButton
                      action={deleteElectiveGroup.bind(null, scheme.id, programme.id, g.id)}
                      label="Delete"
                      icon={Trash2}
                      variant="ghost"
                      size="xs"
                      title={`Delete ${g.code}?`}
                      description="Only an empty group can be deleted."
                      confirmLabel="Delete"
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Target className="size-4.5 text-muted-foreground" aria-hidden="true" />
              Programme Specific Outcomes (PSOs)
            </h2>
            {editable && (
              <EntityFormDialog
                schema="pso"
                title="Add PSO"
                fields={psoFields}
                defaultValues={{ code: `PSO${psos.length + 1}`, title: "", sortOrder: psos.length }}
                action={savePso.bind(null, scheme.id, programme.id, null)}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus />
                    Add PSO
                  </Button>
                }
              />
            )}
          </div>
          <ul className="divide-y rounded-lg border text-sm">
            {psos.length === 0 && (
              <li className="p-3 text-muted-foreground">No PSOs yet. They appear as columns in the mapping matrix.</li>
            )}
            {psos.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-medium">{p.code}</span> — {p.title}
                </span>
                {editable && (
                  <span className="flex shrink-0 gap-1">
                    <EntityFormDialog
                      schema="pso"
                      title={`Edit ${p.code}`}
                      fields={psoFields}
                      defaultValues={{ code: p.code, title: p.title, sortOrder: p.sortOrder }}
                      action={savePso.bind(null, scheme.id, programme.id, p.id)}
                      trigger={
                        <Button variant="ghost" size="xs">
                          <Pencil />
                          Edit
                        </Button>
                      }
                    />
                    <ConfirmActionButton
                      action={deletePso.bind(null, scheme.id, programme.id, p.id)}
                      label="Delete"
                      icon={Trash2}
                      variant="ghost"
                      size="xs"
                      title={`Delete ${p.code}?`}
                      description="It will no longer appear in the mapping matrix."
                      confirmLabel="Delete"
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function SemesterTable({ semester, rows, groups, editable, renderEdit, renderDelete }) {
  // Semester credits: every non-elective course, plus one option per elective group.
  const credits =
    rows.filter((r) => !r.electiveGroupId).reduce((s, r) => s + totalCredits(r), 0) +
    groups.reduce((s, g) => {
      const first = rows.find((r) => r.electiveGroupId === g.id);
      return s + (first ? totalCredits(first) : 0);
    }, 0);

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarRange className="size-4.5 text-muted-foreground" aria-hidden="true" />
          Semester {semester}
        </h2>
        <p className="text-sm text-muted-foreground">
          {rows.length} course rows · {credits} credits (one option counted per elective group)
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Category / format</TableHead>
              <TableHead>Teaching dept.</TableHead>
              <TableHead className="text-center">Credits</TableHead>
              <TableHead className="text-center">L / T / P / TW&amp;SL (h)</TableHead>
              <TableHead className="text-center">CIE / SEE</TableHead>
              <TableHead>Faculty</TableHead>
              <TableHead>Check</TableHead>
              {editable && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="align-top">
                <TableCell className="min-w-56 whitespace-normal">
                  <div className="font-medium">{r.course.code}</div>
                  <div className="text-sm">{r.course.title}</div>
                  {r.electiveGroup && (
                    <div className="text-xs text-muted-foreground">Option in {r.electiveGroup.code}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div>{r.category.code}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.format ? formatLabels[r.format] : "No syllabus"}
                  </div>
                </TableCell>
                <TableCell>{r.teachingDepartment.code}</TableCell>
                <TableCell className="text-center font-mono">
                  {r.category.passFail ? "PP" : `${formatCredits(r)} (${totalCredits(r)})`}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {r.lHours} / {r.tHours} / {r.pHours} / {r.twSlHours}
                </TableCell>
                <TableCell className="text-center">
                  {r.cieMarks} / {r.seeMarks ?? "—"}
                </TableCell>
                <TableCell className="text-sm whitespace-normal">
                  {r.faculty.length === 0 ? <span className="text-muted-foreground">—</span> : r.faculty.join(", ")}
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">
                  {r.issues.length === 0 ? (
                    <Badge variant="success">OK</Badge>
                  ) : (
                    <div className="space-y-1">
                      <Badge variant="destructive">{r.issues.length} issue(s)</Badge>
                      <ul className="text-xs text-destructive">
                        {r.issues.map((i, n) => (
                          <li key={n}>{i.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TableCell>
                {editable && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {renderEdit(r)}
                      {renderDelete(r)}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
