// Dashboards (Phase 4, README §12): syllabus progress for a scheme by department, programme and semester,
// and the courses behind each number. Progress is an ordinal scale (Not started → … → Approved), drawn as
// one-hue stacked bars with a legend, a hover tooltip and a table view of the same counts.
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { BadgeCheck, BookOpen, ChartBar, Hourglass, ListFilter, Table2, TriangleAlert, X } from "lucide-react";
import { progressByGroup, progressLabels, progressSteps } from "@acp/shared/domain/reviews/progress";
import { formatLabels } from "@acp/shared/domain/schemes/rules";
import { useApiQuery } from "@/hooks/use-api";
import { useDataTable } from "@/hooks/use-data-table";
import { distinctOptions } from "@/lib/data-table";
import {
  DataTablePagination,
  DataTableToolbar,
  NoResultsRow,
  SerialCell,
  SerialHead,
  SortableHead,
} from "@/components/data-table/data-table";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Colour of each step: the ordinal ramp defined in index.css (--progress-0 … --progress-7). */
const stepColor = Object.fromEntries(progressSteps.map((s, i) => [s, `var(--progress-${i})`]));
const inReview = ["INTERNAL_BOS", "EXPERT", "EXTERNAL_BOS", "ACADEMIC_COUNCIL", "REVISING"];

const groupings = {
  department: { label: "Department", keysOf: (r) => [r.department], name: (k) => k },
  programme: { label: "Programme", keysOf: (r) => r.programmes, name: (k) => k },
  semester: { label: "Semester", keysOf: (r) => [String(r.semester)], name: (k) => `Semester ${k}` },
};

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const schemeId = params.get("scheme");
  const query = useApiQuery(`/dashboard${schemeId ? `?schemeId=${encodeURIComponent(schemeId)}` : ""}`);
  return (
    <QueryState query={query}>
      {(data) => <Dashboard data={data} onScheme={(id) => setParams(id ? { scheme: id } : {})} />}
    </QueryState>
  );
}

function Dashboard({ data, onScheme }) {
  const { schemes, scheme, rows } = data;
  const [by, setBy] = useState(data.departments.length > 1 ? "department" : "semester");
  const [filter, setFilter] = useState(null); // { by, key, step } chosen by clicking a bar segment
  const [asTable, setAsTable] = useState(false);
  const grouping = groupings[by];
  const groups = useMemo(() => progressByGroup(rows, grouping.keysOf), [rows, grouping]);
  const total = rows.length;
  const count = (steps) => rows.filter((r) => steps.includes(r.step)).length;
  const approved = count(["APPROVED"]);
  const flagged = rows.filter((r) => r.needsRevision).length;

  const shown = filter
    ? rows.filter(
        (r) => (!filter.step || r.step === filter.step) && groupings[filter.by].keysOf(r).includes(filter.key),
      )
    : rows;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Where every syllabus stands in the framing and review path. Click a bar to list its courses."
        actions={
          schemes.length > 0 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="dashboard-scheme" className="text-muted-foreground">
                Scheme
              </Label>
              <Select
                value={scheme?.id}
                onValueChange={(id) => {
                  setFilter(null);
                  onScheme(id);
                }}
              >
                <SelectTrigger id="dashboard-scheme" className="w-56">
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
          )
        }
      />

      {!scheme || total === 0 ? (
        <EmptyState icon={ChartBar}>
          {scheme ? `No courses that need a syllabus in ${scheme.name} yet.` : "No published scheme yet."}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile icon={BookOpen} label="Courses needing a syllabus" value={total} />
            <Tile
              icon={BadgeCheck}
              label="Approved"
              value={approved}
              detail={`${Math.round((approved / total) * 100)}% of ${total}`}
            />
            <Tile
              icon={Hourglass}
              label="In review"
              value={count(inReview)}
              detail={`${count(["DRAFT"])} draft · ${count(["NOT_STARTED"])} not started`}
            />
            <Tile
              icon={TriangleAlert}
              label="Needs revision"
              value={flagged}
              detail="scheme amended"
              onClick={flagged ? () => setFilter({ by: "flag" }) : undefined}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Progress by {grouping.label.toLowerCase()}</CardTitle>
              <CardDescription>
                {scheme.name} · {total} courses. A course listed by several programmes counts once in each.
              </CardDescription>
              <CardAction className="flex flex-wrap gap-2">
                <Tabs value={by} onValueChange={setBy}>
                  <TabsList>
                    {Object.entries(groupings).map(([key, g]) => (
                      <TabsTrigger key={key} value={key}>
                        {g.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Button variant="outline" size="sm" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
                  {asTable ? <ChartBar /> : <Table2 />}
                  {asTable ? "Show bars" : "Show table"}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <Legend />
              {asTable ? (
                <CountsTable groups={groups} grouping={grouping} />
              ) : (
                <ul className="space-y-2.5">
                  {groups.map((g) => (
                    <li key={g.key} className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-3">
                      <span className="truncate text-sm font-medium">{grouping.name(g.key)}</span>
                      <ProgressBar
                        group={g}
                        name={grouping.name(g.key)}
                        selected={filter?.by === by && filter.key === g.key ? filter.step : undefined}
                        onSelect={(step) => setFilter({ by, key: g.key, step })}
                      />
                      <span className="text-right text-sm text-muted-foreground tabular-nums">{g.total}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <CourseTable
            rows={filter?.by === "flag" ? rows.filter((r) => r.needsRevision) : shown}
            schemeId={scheme.id}
            filter={filter}
            onClear={() => setFilter(null)}
          />
        </div>
      )}
    </>
  );
}

function Tile({ icon: Icon, label, value, detail, onClick }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 rounded-lg border bg-card p-4 text-left shadow-xs",
        onClick &&
          "transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary ring-1 ring-primary/15">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="mt-0.5 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
          {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
        </span>
      </span>
    </Comp>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Legend">
      {progressSteps.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] ring-1 ring-foreground/10" style={{ background: stepColor[s] }} />
          {progressLabels[s]}
        </li>
      ))}
    </ul>
  );
}

/** One stacked bar: a segment per step, 2px surface gaps, rounded outer ends, a tooltip on hover/focus. */
function ProgressBar({ group, name, selected, onSelect }) {
  const [hover, setHover] = useState(null);
  const steps = progressSteps.filter((s) => group.counts[s] > 0);
  return (
    <div className="relative">
      <div className="flex h-6 gap-[2px]" role="group" aria-label={`${name}: progress`}>
        {steps.map((s, i) => {
          const n = group.counts[s];
          return (
            <button
              key={s}
              type="button"
              className={cn(
                "h-full min-w-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                i === 0 && "rounded-l-[4px]",
                i === steps.length - 1 && "rounded-r-[4px]",
                selected && selected !== s && "opacity-40",
              )}
              style={{ flexGrow: n, flexBasis: 0, background: stepColor[s] }}
              aria-label={`${progressLabels[s]}: ${n} of ${group.total}`}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(s)}
            />
          );
        })}
      </div>
      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs whitespace-nowrap text-popover-foreground shadow-md"
        >
          <div className="font-medium">{name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ background: stepColor[hover] }} />
            {progressLabels[hover]}:{" "}
            <span className="font-semibold tabular-nums">
              {group.counts[hover]} of {group.total}
            </span>{" "}
            <span className="text-muted-foreground">({Math.round((group.counts[hover] / group.total) * 100)}%)</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** The same counts as a table (the accessible view of the bars). */
function CountsTable({ groups, grouping }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <SerialHead />
            <TableHead>{grouping.label}</TableHead>
            {progressSteps.map((s) => (
              <TableHead key={s} className="text-right whitespace-normal">
                {progressLabels[s]}
              </TableHead>
            ))}
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g, i) => (
            <TableRow key={g.key}>
              <SerialCell n={i + 1} />
              <TableCell className="font-medium">{grouping.name(g.key)}</TableCell>
              {progressSteps.map((s) => (
                <TableCell key={s} className="text-right tabular-nums">
                  {g.counts[s] || <span className="text-muted-foreground">·</span>}
                </TableCell>
              ))}
              <TableCell className="text-right font-medium tabular-nums">{g.total}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CourseTable({ rows, schemeId, filter, onClear }) {
  const table = useDataTable({
    id: "courses",
    rows,
    columns: {
      code: { sortValue: (r) => r.code },
      department: { sortValue: (r) => r.department },
      semester: { sortValue: (r) => r.semester },
      status: { sortValue: (r) => progressSteps.indexOf(r.step) },
      coordinator: { sortValue: (r) => r.coordinators.join(", ") || null },
    },
    searchText: (r) => [r.code, r.title, r.department, r.programmes.join(" "), r.coordinators.join(" ")].join(" "),
    filterDefs: {
      format: (r, v) => r.format === v,
      inputs: (r, v) => (v === "pending" ? r.pendingInputs > 0 : r.pendingInputs === 0),
    },
  });
  const title = !filter
    ? "All courses"
    : filter.by === "flag"
      ? "Needs revision"
      : `${groupings[filter.by].name(filter.key)}${filter.step ? ` · ${progressLabels[filter.step]}` : ""}`;
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="border-b">
        <CardTitle>
          <ListFilter />
          {title}
          <span className="font-normal text-muted-foreground tabular-nums">({rows.length})</span>
        </CardTitle>
        {filter && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X />
              Show all
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <div className="border-b px-5 py-4">
        <DataTableToolbar
          table={table}
          noun="courses"
          searchPlaceholder="Code, title, department or coordinator"
          filters={[
            {
              key: "format",
              label: "Format",
              allLabel: "All formats",
              options: distinctOptions(
                rows,
                (r) => r.format,
                (v) => formatLabels[v],
              ),
            },
            {
              key: "inputs",
              label: "Review inputs",
              allLabel: "Any",
              width: "w-44",
              options: [
                { value: "pending", label: "Inputs pending" },
                { value: "none", label: "None pending" },
              ],
            },
          ]}
        />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SerialHead />
              <SortableHead table={table} column="code">
                Course
              </SortableHead>
              <SortableHead table={table} column="department">
                Department
              </SortableHead>
              <TableHead>Programmes</TableHead>
              <SortableHead table={table} column="semester" className="text-right" align="right">
                Sem
              </SortableHead>
              <SortableHead table={table} column="status">
                Status
              </SortableHead>
              <SortableHead table={table} column="coordinator">
                Course Coordinator
              </SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.total === 0 && <NoResultsRow table={table} colSpan={7} />}
            {table.rows.map((r, i) => (
              <TableRow key={r.courseId}>
                <SerialCell n={table.from + i} />
                <TableCell>
                  <Link to={`/syllabi/${schemeId}/${r.courseId}`} className="font-medium hover:underline">
                    <span className="tabular-nums">{r.code}</span> — {r.title}
                  </Link>
                  {r.format && <div className="text-xs text-muted-foreground">{formatLabels[r.format]}</div>}
                </TableCell>
                <TableCell>{r.department}</TableCell>
                <TableCell className="text-muted-foreground">{r.programmes.join(", ")}</TableCell>
                <TableCell className="text-right tabular-nums">{r.semester}</TableCell>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: stepColor[r.step] }} />
                    <span className="text-sm">{progressLabels[r.step]}</span>
                    {r.label && <span className="text-xs text-muted-foreground">{r.label}</span>}
                    {r.pendingInputs > 0 && <Badge variant="outline">{r.pendingInputs} input(s) pending</Badge>}
                    {r.needsRevision && <Badge variant="warning">Needs revision</Badge>}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.coordinators.join(", ") || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </Card>
  );
}
