import { Link, useParams } from "react-router";
import { formatLabels } from "@acp/shared/domain/schemes/rules";
import { stageLabels, stages, syllabusStatusLabels } from "@acp/shared/domain/reviews/workflow";
import { assignmentRoleLabels, reviewerCategoryLabels, toOptions } from "@acp/shared/labels";
import { useApiQuery } from "@/hooks/use-api";
import { useDataTable } from "@/hooks/use-data-table";
import { distinctOptions } from "@/lib/data-table";
import { addAssignment, removeAssignment, saveMeeting, saveReviewer } from "@/lib/actions";
import { formatDateTime, toLocalInput } from "@/lib/download";
import {
  DataTablePagination,
  DataTableToolbar,
  NoResultsRow,
  SerialCell,
  SerialHead,
  SortableHead,
} from "@/components/data-table/data-table";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CircleDashed,
  ListChecks,
  Pencil,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { SyllabusStatusBadge } from "@/components/syllabus/status-badge";
const reviewerFields = [
  { name: "name", label: "Name", type: "text", width: "half" },
  { name: "category", label: "Category", type: "select", options: toOptions(reviewerCategoryLabels), width: "half" },
  { name: "designation", label: "Designation", type: "text", width: "half" },
  { name: "organisation", label: "Organisation", type: "text", width: "half" },
  { name: "email", label: "Email", type: "email", width: "half" },
  { name: "phone", label: "Phone", type: "text", width: "half" },
  { name: "isActive", label: "Active", type: "checkbox" },
];

/** BoS Coordinator / HoD: courses and faculty, programme course lists, reviewers, faculty. */
export function DepartmentPage() {
  const { code } = useParams();
  const query = useApiQuery(`/departments/${code}`);
  return <QueryState query={query}>{(data) => <Department {...data} />}</QueryState>;
}

/** "V2.1 · Industry Experts & Alumni" — where a course's syllabus stands. */
function SyllabusStatus({ syllabus }) {
  if (!syllabus)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CircleDashed className="size-3.5" aria-hidden="true" />
        Not started
      </span>
    );
  return (
    <div className="space-y-0.5">
      <SyllabusStatusBadge status={syllabus.status} />
      {syllabus.needsRevision && (
        <Badge variant="warning" title="A scheme amendment may affect this syllabus">
          Needs revision
        </Badge>
      )}
      {syllabus.label && (
        <div className="text-xs text-muted-foreground">
          {syllabus.label}
          {syllabus.status === "IN_REVIEW" && ` · ${stageLabels[syllabus.stage]}`}
        </div>
      )}
    </div>
  );
}

/** Order of syllabus progress, for sorting the Syllabus column. */
const statusOrder = { NOT_STARTED: 0, DRAFT: 1, IN_REVIEW: 2, REVISING: 3, APPROVED: 4 };
const syllabusStatusOf = (c) => c.syllabus?.status ?? "NOT_STARTED";

function Department({ department, editable, programmes, schemes, courses, reviewers, faculty, meetings }) {
  const courseTable = useDataTable({
    id: "courses",
    rows: courses,
    columns: {
      code: { sortValue: (c) => c.code },
      semester: { sortValue: (c) => c.semester },
      faculty: { sortValue: (c) => c.assignments.map((a) => a.user.name).join(", ") || null },
      syllabus: { sortValue: (c) => statusOrder[syllabusStatusOf(c)] },
    },
    searchText: (c) => [c.code, c.title, c.programmes.join(" "), ...c.assignments.map((a) => a.user.name)].join(" "),
    filterDefs: {
      scheme: (c, v) => c.schemeName === v,
      semester: (c, v) => c.semester === Number(v),
      format: (c, v) => c.format === v,
      faculty: (c, v) => (v === "assigned" ? c.assignments.length > 0 : c.assignments.length === 0),
      syllabus: (c, v) => syllabusStatusOf(c) === v,
    },
  });
  const reviewerTable = useDataTable({
    id: "reviewers",
    rows: reviewers,
    columns: {
      name: { sortValue: (r) => r.name },
      category: { sortValue: (r) => reviewerCategoryLabels[r.category] },
    },
    defaultSort: { key: "name", dir: "asc" },
    searchText: (r) => [r.name, r.designation, r.organisation, r.email, r.phone].join(" "),
    filterDefs: {
      category: (r, v) => r.category === v,
      status: (r, v) => (v === "active" ? r.isActive : !r.isActive),
    },
  });
  const assignmentFields = [
    {
      name: "userId",
      label: "Faculty member",
      type: "select",
      options: faculty.map((f) => ({ value: f.id, label: f.name + (f.designation ? ` (${f.designation})` : "") })),
    },
    { name: "role", label: "Role", type: "select", options: toOptions(assignmentRoleLabels), width: "half" },
  ];

  return (
    <>
      <PageHeader
        title={`${department.code} — ${department.name}`}
        description="Course lists, faculty assignments and the reviewer directory for this department."
      />
      <Tabs defaultValue="courses">
        <TabsList className="flex-wrap">
          <TabsTrigger value="courses">
            <BookOpen />
            Courses &amp; faculty
          </TabsTrigger>
          <TabsTrigger value="lists">
            <ListChecks />
            Programme course lists
          </TabsTrigger>
          <TabsTrigger value="meetings">
            <CalendarDays />
            Meetings
          </TabsTrigger>
          <TabsTrigger value="reviewers">
            <UserCheck />
            Reviewers
          </TabsTrigger>
          <TabsTrigger value="faculty">
            <Users />
            Faculty
          </TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            Courses owned by {department.code} that need a syllabus. Each course has one Course Coordinator and optional
            co-authors; one syllabus serves every programme that lists the course.
          </p>
          {courses.length === 0 ? (
            <EmptyState>No courses owned by this department in a published scheme.</EmptyState>
          ) : (
            <div className="space-y-3">
              <DataTableToolbar
                table={courseTable}
                noun="courses"
                searchPlaceholder="Code, title, programme or faculty"
                filters={[
                  {
                    key: "scheme",
                    label: "Scheme",
                    allLabel: "All schemes",
                    options: distinctOptions(courses, (c) => c.schemeName),
                  },
                  {
                    key: "semester",
                    label: "Semester",
                    allLabel: "All",
                    width: "w-28",
                    options: distinctOptions(
                      courses,
                      (c) => c.semester,
                      (v) => `Sem ${v}`,
                    ),
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
                  {
                    key: "faculty",
                    label: "Faculty",
                    allLabel: "Any",
                    width: "w-36",
                    options: [
                      { value: "assigned", label: "Assigned" },
                      { value: "unassigned", label: "Not assigned" },
                    ],
                  },
                  {
                    key: "syllabus",
                    label: "Syllabus",
                    allLabel: "Any status",
                    options: [
                      { value: "NOT_STARTED", label: "Not started" },
                      ...Object.entries(syllabusStatusLabels).map(([value, label]) => ({ value, label })),
                    ],
                  },
                ]}
              />
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SerialHead />
                      <SortableHead table={courseTable} column="code">
                        Course
                      </SortableHead>
                      <SortableHead table={courseTable} column="semester">
                        Scheme · Sem
                      </SortableHead>
                      <TableHead>Programmes</TableHead>
                      <SortableHead table={courseTable} column="faculty">
                        Faculty
                      </SortableHead>
                      <SortableHead table={courseTable} column="syllabus">
                        Syllabus
                      </SortableHead>
                      {editable && <TableHead className="w-0" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseTable.total === 0 && <NoResultsRow table={courseTable} colSpan={editable ? 7 : 6} />}
                    {courseTable.rows.map((c, i) => (
                      <TableRow key={`${c.schemeId}:${c.courseId}`} className="align-top">
                        <SerialCell n={courseTable.from + i} />
                        <TableCell className="min-w-56 whitespace-normal">
                          <Link
                            className="font-medium text-primary underline-offset-4 hover:underline"
                            to={`/syllabi/${c.schemeId}/${c.courseId}`}
                          >
                            {c.code}
                          </Link>
                          <div className="text-sm">{c.title}</div>
                          {c.format && <div className="text-xs text-muted-foreground">{formatLabels[c.format]}</div>}
                        </TableCell>
                        <TableCell>
                          {c.schemeName} · {c.semester}
                        </TableCell>
                        <TableCell>{c.programmes.join(", ")}</TableCell>
                        <TableCell className="whitespace-normal">
                          {c.assignments.length === 0 && (
                            <Badge variant="warning">
                              <UserX />
                              Not assigned
                            </Badge>
                          )}
                          <ul className="space-y-1">
                            {c.assignments.map((a) => (
                              <li key={a.id} className="flex items-center gap-1 text-sm">
                                {a.user.name}
                                <span className="text-xs text-muted-foreground">({assignmentRoleLabels[a.role]})</span>
                                {editable && (
                                  <ConfirmActionButton
                                    action={removeAssignment.bind(null, department.code, a.id)}
                                    label="Remove assignment"
                                    icon={X}
                                    iconOnly
                                    variant="ghost"
                                    size="xs"
                                    title="Remove assignment?"
                                    description={`${a.user.name} will no longer be assigned to ${c.code}.`}
                                    confirmLabel="Remove"
                                  />
                                )}
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                        <TableCell>
                          <SyllabusStatus syllabus={c.syllabus} />
                        </TableCell>
                        {editable && (
                          <TableCell>
                            <EntityFormDialog
                              schema="courseAssignment"
                              title={`Assign faculty — ${c.code}`}
                              description={
                                faculty.length === 0
                                  ? "No faculty members yet: ask the administrator to give people the Faculty role in this department."
                                  : undefined
                              }
                              fields={assignmentFields}
                              defaultValues={{
                                userId: "",
                                role: c.assignments.some((a) => a.role === "COORDINATOR") ? "CO_AUTHOR" : "COORDINATOR",
                              }}
                              action={addAssignment.bind(null, department.code, c.schemeId, c.courseId)}
                              submitLabel="Assign"
                              trigger={
                                <Button variant="outline" size="sm">
                                  <UserPlus />
                                  Assign
                                </Button>
                              }
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <DataTablePagination table={courseTable} />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="lists" className="space-y-3 pt-4">
          {programmes.length === 0 ? (
            <EmptyState>This department has no programmes.</EmptyState>
          ) : (
            <ul className="divide-y rounded-lg border">
              {programmes.map((p) => (
                <li key={p.id} className="space-y-1 px-4 py-3">
                  <p className="font-medium">
                    {p.code} — {p.name}
                  </p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {schemes.map((s) => (
                      <Link
                        key={s.id}
                        to={`/schemes/${s.id}/programmes/${p.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {s.name} course list{s.status === "DRAFT" ? " (draft scheme)" : ""}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="meetings" className="space-y-3 pt-4">
          <Meetings
            department={department}
            editable={editable}
            meetings={meetings}
            schemes={schemes}
            reviewers={reviewers}
          />
        </TabsContent>

        <TabsContent value="reviewers" className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-3xl text-sm text-muted-foreground">
              People whose inputs are recorded in BOS meetings and expert reviews. Reviewers do not sign in; the BoS
              Coordinator records their inputs.
            </p>
            {editable && (
              <EntityFormDialog
                schema="reviewer"
                title="Add reviewer"
                fields={reviewerFields}
                defaultValues={{
                  name: "",
                  category: "INTERNAL_BOS",
                  designation: "",
                  organisation: "",
                  email: "",
                  phone: "",
                  isActive: true,
                }}
                action={saveReviewer.bind(null, department.code, null)}
                trigger={
                  <Button>
                    <UserPlus />
                    Add reviewer
                  </Button>
                }
              />
            )}
          </div>
          {reviewers.length === 0 ? (
            <EmptyState>No reviewers yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              <DataTableToolbar
                table={reviewerTable}
                noun="reviewers"
                searchPlaceholder="Name, organisation, email or phone"
                filters={[
                  {
                    key: "category",
                    label: "Category",
                    allLabel: "All categories",
                    width: "w-48",
                    options: distinctOptions(
                      reviewers,
                      (r) => r.category,
                      (v) => reviewerCategoryLabels[v],
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    allLabel: "Active and inactive",
                    width: "w-44",
                    options: [
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                    ],
                  },
                ]}
              />
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SerialHead />
                      <SortableHead table={reviewerTable} column="name">
                        Name
                      </SortableHead>
                      <SortableHead table={reviewerTable} column="category">
                        Category
                      </SortableHead>
                      <TableHead>Designation and organisation</TableHead>
                      <TableHead>Contact</TableHead>
                      {editable && <TableHead className="w-0" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewerTable.total === 0 && <NoResultsRow table={reviewerTable} colSpan={editable ? 6 : 5} />}
                    {reviewerTable.rows.map((r, i) => (
                      <TableRow key={r.id} className={r.isActive ? undefined : "opacity-60"}>
                        <SerialCell n={reviewerTable.from + i} />
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{reviewerCategoryLabels[r.category]}</TableCell>
                        <TableCell className="whitespace-normal">
                          {[r.designation, r.organisation].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {[r.email, r.phone].filter(Boolean).join(" · ") || "—"}
                        </TableCell>
                        {editable && (
                          <TableCell>
                            <EntityFormDialog
                              schema="reviewer"
                              title="Edit reviewer"
                              fields={reviewerFields}
                              defaultValues={{
                                name: r.name,
                                category: r.category,
                                designation: r.designation ?? "",
                                organisation: r.organisation ?? "",
                                email: r.email ?? "",
                                phone: r.phone ?? "",
                                isActive: r.isActive,
                              }}
                              action={saveReviewer.bind(null, department.code, r.id)}
                              trigger={
                                <Button variant="outline" size="sm">
                                  <Pencil />
                                  Edit
                                </Button>
                              }
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <DataTablePagination table={reviewerTable} />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="faculty" className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            People with the Faculty role in {department.code}. The portal administrator adds people and roles.
          </p>
          {faculty.length === 0 ? (
            <EmptyState>No faculty members yet.</EmptyState>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {faculty.map((f) => (
                <li key={f.id} className="flex items-center justify-between px-4 py-2">
                  <span>
                    <span className="font-medium">{f.name}</span>
                    {f.designation && <span className="text-muted-foreground"> · {f.designation}</span>}
                  </span>
                  <span className="text-muted-foreground">{f.courseCount} course(s)</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

/** BOS meetings and expert sessions. Inputs recorded on a syllabus refer to one of them. */
function Meetings({ department, editable, meetings, schemes, reviewers }) {
  const table = useDataTable({
    id: "meetings",
    rows: meetings,
    columns: {
      when: { sortValue: (m) => new Date(m.heldAt), firstDir: "desc" },
      stage: { sortValue: (m) => stages.indexOf(m.stage) },
      inputs: { sortValue: (m) => m.inputCount, firstDir: "desc" },
    },
    defaultSort: { key: "when", dir: "desc" },
    searchText: (m) => [m.venue, m.title, m.schemeName, ...m.attendees.map((a) => a.name)].join(" "),
    filterDefs: {
      scheme: (m, v) => m.schemeName === v,
      stage: (m, v) => m.stage === v,
    },
  });
  const published = schemes.filter((s) => s.status === "PUBLISHED");
  const fields = [
    {
      name: "schemeId",
      label: "Scheme",
      type: "select",
      options: published.map((s) => ({ value: s.id, label: s.name })),
      width: "half",
    },
    {
      name: "stage",
      label: "Stage",
      type: "select",
      options: Object.entries(stageLabels).map(([value, label]) => ({ value, label })),
      width: "half",
    },
    { name: "heldAt", label: "Date and time", type: "datetime-local", width: "half" },
    { name: "venue", label: "Venue", type: "text", width: "half" },
    {
      name: "title",
      label: "Title (optional)",
      type: "text",
      placeholder: "e.g. BOS meeting, semester III–IV syllabi",
    },
    {
      name: "attendeeIds",
      label: "Reviewers present",
      type: "multiselect",
      options: reviewers.filter((r) => r.isActive).map((r) => ({ value: r.id, label: r.name })),
      description: reviewers.length ? undefined : "Add reviewers in the Reviewers tab first.",
    },
  ];
  const blank = {
    schemeId: published[0]?.id ?? "",
    stage: "INTERNAL_BOS",
    heldAt: "",
    venue: "",
    title: "",
    attendeeIds: [],
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-sm text-muted-foreground">
          One meeting can review many syllabi. Inputs are then recorded course by course on each syllabus&apos;s review
          page, and the meeting&apos;s date, time and venue are printed in the Action Taken report.
        </p>
        {editable && (
          <EntityFormDialog
            schema="reviewMeeting"
            title="Add meeting"
            fields={fields}
            defaultValues={blank}
            action={saveMeeting.bind(null, department.code, null)}
            trigger={
              <Button>
                <CalendarPlus />
                Add meeting
              </Button>
            }
          />
        )}
      </div>
      {meetings.length === 0 ? (
        <EmptyState>No meetings yet.</EmptyState>
      ) : (
        <div className="space-y-3">
          <DataTableToolbar
            table={table}
            noun="meetings"
            searchPlaceholder="Venue, title or reviewer"
            filters={[
              {
                key: "scheme",
                label: "Scheme",
                allLabel: "All schemes",
                options: distinctOptions(meetings, (m) => m.schemeName),
              },
              {
                key: "stage",
                label: "Stage",
                allLabel: "All stages",
                width: "w-52",
                options: stages
                  .filter((st) => meetings.some((m) => m.stage === st))
                  .map((st) => ({ value: st, label: stageLabels[st] })),
              },
            ]}
          />
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SerialHead />
                  <SortableHead table={table} column="when">
                    When and where
                  </SortableHead>
                  <SortableHead table={table} column="stage">
                    Stage
                  </SortableHead>
                  <TableHead>Reviewers present</TableHead>
                  <SortableHead table={table} column="inputs">
                    Inputs
                  </SortableHead>
                  {editable && <TableHead className="w-0" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.total === 0 && <NoResultsRow table={table} colSpan={editable ? 6 : 5} />}
                {table.rows.map((m, i) => (
                  <TableRow key={m.id} className="align-top">
                    <SerialCell n={table.from + i} />
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{formatDateTime(m.heldAt)}</div>
                      <div className="text-sm">
                        {m.venue}
                        {m.title ? ` · ${m.title}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.schemeName}</div>
                    </TableCell>
                    <TableCell>{stageLabels[m.stage]}</TableCell>
                    <TableCell className="whitespace-normal text-sm">
                      {m.attendees.map((a) => a.name).join(", ") || "—"}
                    </TableCell>
                    <TableCell>{m.inputCount}</TableCell>
                    {editable && (
                      <TableCell>
                        <EntityFormDialog
                          schema="reviewMeeting"
                          title="Edit meeting"
                          fields={fields.map((f) =>
                            m.inputCount > 0 && (f.name === "schemeId" || f.name === "stage")
                              ? { ...f, disabled: true }
                              : f,
                          )}
                          defaultValues={{
                            schemeId: m.schemeId,
                            stage: m.stage,
                            heldAt: toLocalInput(m.heldAt),
                            venue: m.venue,
                            title: m.title ?? "",
                            attendeeIds: m.attendees.map((a) => a.id),
                          }}
                          action={saveMeeting.bind(null, department.code, m.id)}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Pencil />
                              Edit
                            </Button>
                          }
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataTablePagination table={table} />
          </div>
        </div>
      )}
    </>
  );
}
