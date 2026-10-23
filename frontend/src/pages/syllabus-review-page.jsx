// Review of one syllabus (README §7): inputs by stage with the action taken on each, the versions
// (view, PDF, compare) and the Action Taken report per stage.
import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Download, Eye, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  decisionLabels,
  sectionRefLabel,
  stageLabels,
  stages,
  syllabusStatusLabels,
} from "@acp/shared/domain/reviews/workflow";
import { compareTheory } from "@acp/shared/domain/reviews/compare";
import { reviewerCategoryLabels, toOptions } from "@acp/shared/labels";
import { actionTakenHtml } from "@acp/shared/print/action-taken-document";
import { useApiQuery } from "@/hooks/use-api";
import { deleteReviewInput, saveActionTaken, saveReviewInput } from "@/lib/actions";
import { downloadPdf, formatDate, formatDateTime } from "@/lib/download";
import { cn } from "@/lib/utils";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SyllabusReviewPage() {
  const { schemeId, courseId } = useParams();
  const path = `/syllabi/${schemeId}/${courseId}`;
  const query = useApiQuery(`${path}/review`);
  return <QueryState query={query}>{(data) => <Review path={path} data={data} />}</QueryState>;
}

function Review({ path, data }) {
  const { workflow } = data;
  return (
    <>
      <PageHeader
        back={{ href: path, label: "Back to the editor" }}
        title={`${data.course.code} — review`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{data.course.title}</span>
            <Badge variant="outline">{syllabusStatusLabels[workflow.status]}</Badge>
            {workflow.label && <span className="font-medium">{workflow.label}</span>}
            {workflow.status === "IN_REVIEW" && <span>· {stageLabels[workflow.stage]} stage</span>}
          </span>
        }
      />
      <Tabs defaultValue="inputs">
        <TabsList className="flex-wrap">
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="report">Action Taken report</TabsTrigger>
        </TabsList>
        <TabsContent value="inputs" className="pt-4">
          <InputsTab path={path} data={data} />
        </TabsContent>
        <TabsContent value="versions" className="pt-4">
          <VersionsTab path={path} data={data} />
        </TabsContent>
        <TabsContent value="report" className="pt-4">
          <ReportTab path={path} data={data} />
        </TabsContent>
      </Tabs>
    </>
  );
}

// --- Inputs ---------------------------------------------------------------------------------------------

const decisionVariant = { ACCEPTED: "success", PARTLY: "warning", NOT_ACCEPTED: "outline" };

function StagePicker({ value, onChange, counts }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Stage">
      {stages.map((s) => (
        <Button
          key={s}
          size="sm"
          role="tab"
          aria-selected={value === s}
          variant={value === s ? "default" : "outline"}
          onClick={() => onChange(s)}
        >
          {stageLabels[s]}
          {counts?.[s] ? <span className="opacity-70">({counts[s]})</span> : null}
        </Button>
      ))}
    </div>
  );
}

function InputsTab({ path, data }) {
  const { workflow } = data;
  const [stage, setStage] = useState(workflow.stage ?? (data.inputs.at(-1)?.stage || "INTERNAL_BOS"));
  const inputs = data.inputs.filter((i) => i.stage === stage);
  const counts = Object.fromEntries(stages.map((s) => [s, data.inputs.filter((i) => i.stage === s).length]));
  const canRecord = data.canReview && workflow.status === "IN_REVIEW" && stage === workflow.stage;

  const inputFields = [
    { name: "sectionRef", label: "Section", type: "select", options: data.sectionRefs, width: "half" },
    {
      name: "givenById",
      label: "Given by",
      type: "select",
      emptyLabel: "— not recorded —",
      options: data.reviewers.map((r) => ({
        value: r.id,
        label: `${r.name} (${reviewerCategoryLabels[r.category]}${r.organisation ? `, ${r.organisation}` : ""})`,
      })),
      width: "half",
      description: data.reviewers.length ? undefined : "Add reviewers on the department page first.",
    },
    {
      name: "meetingId",
      label: "Meeting",
      type: "select",
      emptyLabel: "— none (e.g. an expert's written comments) —",
      options: data.meetings
        .filter((m) => m.stage === workflow.stage)
        .map((m) => ({
          value: m.id,
          label: `${formatDateTime(m.heldAt)} · ${m.venue}${m.title ? ` · ${m.title}` : ""}`,
        })),
      description: "Meetings are added on the department page (Meetings tab).",
    },
    { name: "inputText", label: "Input", type: "textarea", rows: 5 },
  ];
  const actionFields = [
    { name: "actionTaken", label: "Action taken", type: "textarea", rows: 5 },
    { name: "decision", label: "Decision", type: "select", options: toOptions(decisionLabels), width: "half" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StagePicker value={stage} onChange={setStage} counts={counts} />
        {canRecord && (
          <EntityFormDialog
            schema="reviewInput"
            title={`Record an input — ${stageLabels[stage]}`}
            description={`Recorded against ${workflow.label}, the version under review.`}
            fields={inputFields}
            defaultValues={{ sectionRef: "general", givenById: "", meetingId: "", inputText: "" }}
            action={(values) => saveReviewInput(path, null, values)}
            submitLabel="Record input"
            trigger={<Button>Record input</Button>}
          />
        )}
      </div>

      {inputs.length === 0 ? (
        <EmptyState>
          {stage === workflow.stage && workflow.status === "IN_REVIEW"
            ? "No inputs recorded for this stage yet. The BoS Coordinator records the inputs given in the meeting."
            : "No inputs were recorded at this stage."}
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {inputs.map((i, n) => (
            <li key={i.id}>
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5 text-sm">
                      <div className="font-medium">
                        {n + 1}. {sectionRefLabel(i.sectionRef)}
                        <span className="font-normal text-muted-foreground"> · on {i.reviewedLabel}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {i.givenBy
                          ? `${i.givenBy.name} (${reviewerCategoryLabels[i.givenBy.category]}${i.givenBy.organisation ? `, ${i.givenBy.organisation}` : ""})`
                          : "Reviewer not recorded"}
                        {i.meeting && ` · meeting of ${formatDateTime(i.meeting.heldAt)}`}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {i.decision ? (
                        <Badge variant={decisionVariant[i.decision]}>{decisionLabels[i.decision]}</Badge>
                      ) : (
                        <Badge variant="warning">Action pending</Badge>
                      )}
                      {i.resultingLabel && <Badge variant="secondary">In {i.resultingLabel}</Badge>}
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-line">{i.inputText}</p>
                  {i.actionTaken && (
                    <div className="rounded-md border-l-4 border-primary/40 bg-muted/50 px-3 py-2 text-sm">
                      <div className="text-xs font-medium text-muted-foreground">
                        Action taken{i.respondedBy ? ` · ${i.respondedBy}` : ""}
                      </div>
                      <p className="whitespace-pre-line">{i.actionTaken}</p>
                    </div>
                  )}
                  {i.open && (data.canRespond || data.canReview) && (
                    <div className="flex flex-wrap gap-2">
                      {data.canRespond && (
                        <EntityFormDialog
                          schema="actionTaken"
                          title={`Action taken — input ${n + 1}`}
                          description={i.inputText}
                          fields={actionFields}
                          defaultValues={{ actionTaken: i.actionTaken ?? "", decision: i.decision ?? "" }}
                          action={(values) => saveActionTaken(path, i.id, values)}
                          trigger={
                            <Button size="sm" variant={i.actionTaken ? "outline" : "default"}>
                              {i.actionTaken ? "Edit action taken" : "Record action taken"}
                            </Button>
                          }
                        />
                      )}
                      {data.canReview && (
                        <>
                          <EntityFormDialog
                            schema="reviewInput"
                            title={`Edit input ${n + 1}`}
                            fields={inputFields}
                            defaultValues={{
                              sectionRef: i.sectionRef,
                              givenById: i.givenBy?.id ?? "",
                              meetingId: i.meeting?.id ?? "",
                              inputText: i.inputText,
                            }}
                            action={(values) => saveReviewInput(path, i.id, values)}
                            trigger={
                              <Button size="sm" variant="ghost">
                                Edit input
                              </Button>
                            }
                          />
                          {!i.resultingLabel && (
                            <ConfirmActionButton
                              action={() => deleteReviewInput(path, i.id)}
                              label="Remove"
                              variant="ghost"
                              title="Remove this input?"
                              description="It was recorded by mistake and will not appear in the Action Taken report."
                              confirmLabel="Remove"
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// --- Versions -------------------------------------------------------------------------------------------

const sourceLabels = {
  SUBMIT: "Submitted",
  COMMIT: "Saved version",
  CLOSE_STAGE: "Stage closed",
  APPROVE: "Approved correction",
};

function VersionsTab({ path, data }) {
  const { versions } = data;
  const [busy, setBusy] = useState(null);
  const [from, setFrom] = useState(versions[1]?.id ?? "");
  const [to, setTo] = useState(versions[0]?.id ?? "");
  if (versions.length === 0) return <EmptyState>No versions yet: the syllabus has not been submitted.</EmptyState>;

  const pdf = async (v) => {
    setBusy(v.id);
    try {
      await downloadPdf(`${path}/versions/${v.id}/pdf`, `${data.course.code}_syllabus_${v.label}.pdf`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Every version is a frozen copy of the syllabus; it never changes. Changes are made in the working copy and saved
        as the next version.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>By and when</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  {v.label} {v.official && <Badge variant="success">Official</Badge>}
                  <div className="text-xs font-normal text-muted-foreground">{v.statusLabel}</div>
                </TableCell>
                <TableCell>{sourceLabels[v.source]}</TableCell>
                <TableCell className="max-w-xs whitespace-normal">{v.reason ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {v.createdBy ?? "—"}
                  <div className="text-xs text-muted-foreground">{formatDateTime(v.createdAt)}</div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`${path}/preview?version=${v.id}`}>
                        <Eye data-icon="inline-start" />
                        View
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => pdf(v)} disabled={busy === v.id}>
                      {busy === v.id ? (
                        <Loader2 data-icon="inline-start" className="animate-spin" />
                      ) : (
                        <Download data-icon="inline-start" />
                      )}
                      PDF
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(data.approvals.length > 0 || data.unlocks.length > 0) && (
        <div className="space-y-2">
          <h2 className="font-semibold">Approvals and unlocks</h2>
          <ul className="divide-y rounded-lg border text-sm">
            {[
              ...data.approvals.map((a) => ({
                at: a.createdAt,
                key: a.id,
                text: `${a.versionLabel} approved by the Academic Council on ${formatDate(a.approvedOn)} (${a.reference})`,
                by: a.by,
              })),
              ...data.unlocks.map((u) => ({
                at: u.createdAt,
                key: u.id,
                text: `Unlocked after ${u.fromLabel}: ${u.reason}`,
                by: u.by,
              })),
            ]
              .sort((a, b) => new Date(a.at) - new Date(b.at))
              .map((e) => (
                <li key={e.key} className="px-4 py-2">
                  {e.text}
                  <span className="text-muted-foreground">
                    {" "}
                    · {e.by ?? "—"}, {formatDateTime(e.at)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {versions.length > 1 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Compare versions</h2>
          <div className="flex flex-wrap items-end gap-3">
            <VersionSelect label="From" value={from} onChange={setFrom} versions={versions} />
            <VersionSelect label="To" value={to} onChange={setTo} versions={versions} />
          </div>
          {from && to && from !== to && <Comparison path={path} fromId={from} toId={to} />}
        </div>
      )}
    </div>
  );
}

function VersionSelect({ label, value, onChange, versions }) {
  const id = `compare-${label.toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-48">
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Comparison({ path, fromId, toId }) {
  const a = useApiQuery(`${path}/versions/${fromId}`, { staleTime: Infinity });
  const b = useApiQuery(`${path}/versions/${toId}`, { staleTime: Infinity });
  const sections = useMemo(
    () => (a.data && b.data ? compareTheory(a.data.content, b.data.content) : null),
    [a.data, b.data],
  );
  if (a.isError || b.isError) return <p className="text-sm text-destructive">The versions could not be loaded.</p>;
  if (!sections) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const changed = sections.filter((s) => s.changed);
  if (changed.length === 0)
    return <EmptyState>{`${a.data.version.label} and ${b.data.version.label} have the same content.`}</EmptyState>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {changed.length} {changed.length === 1 ? "section differs" : "sections differ"} between {a.data.version.label}{" "}
        and {b.data.version.label}. <span className="text-destructive">Removed</span> and{" "}
        <span className="text-success">added</span> lines are marked.
      </p>
      {changed.map((s) => (
        <Card key={s.section}>
          <CardContent className="space-y-2">
            <h3 className="font-medium">{s.label}</h3>
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 font-sans text-sm whitespace-pre-wrap">
              {s.lines.map((l, i) => (
                <div
                  key={i}
                  className={cn(
                    "px-1",
                    l.type === "added" && "bg-success/15 text-success",
                    l.type === "removed" && "bg-destructive/10 text-destructive line-through",
                  )}
                >
                  <span aria-hidden className="mr-2 inline-block w-3 select-none">
                    {l.type === "added" ? "+" : l.type === "removed" ? "−" : ""}
                  </span>
                  <span className="sr-only">
                    {l.type === "added" ? "Added: " : l.type === "removed" ? "Removed: " : ""}
                  </span>
                  {l.text}
                </div>
              ))}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Action Taken report ----------------------------------------------------------------------------------

function ReportTab({ path, data }) {
  const frame = useRef(null);
  const [stage, setStage] = useState(data.workflow.stage ?? "INTERNAL_BOS");
  const [downloading, setDownloading] = useState(false);
  const html = useMemo(() => actionTakenHtml(data, stage), [data, stage]);
  const counts = Object.fromEntries(stages.map((s) => [s, data.inputs.filter((i) => i.stage === s).length]));

  const download = async () => {
    setDownloading(true);
    try {
      await downloadPdf(
        `${path}/action-taken/${stage}/pdf`,
        `${data.course.code}_action_taken_${stage.toLowerCase()}.pdf`,
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StagePicker value={stage} onChange={setStage} counts={counts} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => frame.current?.contentWindow?.print()}>
            <Printer data-icon="inline-start" />
            Print
          </Button>
          <Button onClick={download} disabled={downloading}>
            {downloading ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            Download PDF
          </Button>
        </div>
      </div>
      <iframe
        ref={frame}
        title={`Action Taken report — ${stageLabels[stage]}`}
        srcDoc={html}
        sandbox="allow-same-origin allow-modals"
        className="h-[calc(100vh-18rem)] min-h-[500px] w-full rounded-lg border bg-muted"
      />
    </div>
  );
}
