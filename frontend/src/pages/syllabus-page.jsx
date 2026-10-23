import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AlertTriangle, Check, CloudOff, Eye, FileText, History, Loader2, RotateCw } from "lucide-react";
import { formatLabels } from "@acp/shared/domain/schemes/rules";
import { syllabusTotals } from "@acp/shared/domain/syllabi/content";
import {
  issuesBySection,
  summarizeIssues,
  validateSyllabus,
  validationContext,
} from "@acp/shared/domain/syllabi/validate";
import { assignmentRoleLabels, textBlockKindLabels } from "@acp/shared/labels";
import { useApiQuery } from "@/hooks/use-api";
import { useAutosave } from "@/hooks/use-autosave";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { ChecksPanel, SectionIssueCount } from "@/components/syllabus/checks-panel";
import { WorkflowBar } from "@/components/syllabus/workflow-bar";
import {
  BooksSection,
  ExperimentsSection,
  FlippedSection,
  HeaderSection,
  MappingSection,
  ObjectivesSection,
  OutcomesSection,
  PrerequisitesSection,
  StandardTextSection,
  TwSlSection,
  UnitsSection,
} from "@/components/syllabus/syllabus-sections";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { SyllabusStatusBadge } from "@/components/syllabus/status-badge";
/** The editor's sections for a format, in template order (README Appendix B). */
function sectionsFor(format) {
  const hasUnits = format?.unitCount > 0;
  const hasExperiments = (format?.experimentCount ?? 0) + (format?.openEndedCount ?? 0) > 0;
  return [
    ["checks", "Checks"],
    ["header", "Course details"],
    ["objectives", "Learning objectives"],
    ["prerequisites", format?.prerequisiteLabel ?? "Pre-requisites"],
    ...(hasUnits
      ? [
          ["units", "Units"],
          ["flipped", "Flipped classroom"],
        ]
      : []),
    ...(hasExperiments ? [["experiments", hasUnits ? "Practical component" : "Experiments"]] : []),
    ["books", "Books"],
    ["twsl", "TW and SL"],
    ["outcomes", "Course outcomes"],
    ["mapping", "Mapping"],
    ["standard", "Standard sections"],
  ];
}

export function SyllabusPage() {
  const { schemeId, courseId } = useParams();
  // Loaded once: afterwards the editor owns the content (refetching would overwrite typing).
  const query = useApiQuery(`/syllabi/${schemeId}/${courseId}`, { staleTime: Infinity, gcTime: 0 });
  return (
    <QueryState query={query}>
      {(data) => <Editor key={`${schemeId}/${courseId}`} path={`/syllabi/${schemeId}/${courseId}`} data={data} />}
    </QueryState>
  );
}

function Editor({ path, data }) {
  const [content, setContent] = useState(data.syllabus.content);
  const latest = useRef(content);
  latest.current = content;

  /** Applies `fn` to a copy of the content (synchronously, so event values are read at once). */
  const update = useCallback((fn) => {
    const next = structuredClone(latest.current);
    fn(next);
    latest.current = next;
    setContent(next);
  }, []);

  const autosave = useAutosave({
    path,
    content,
    revision: data.syllabus.revision,
    enabled: data.canEdit,
    onLoadLatest: setContent,
  });
  const totals = useMemo(() => (content ? syllabusTotals(content) : null), [content]);
  // The same rules the API runs (README §9), re-checked on every change.
  const issues = useMemo(() => (content ? validateSyllabus(content, validationContext(data)) : []), [content, data]);
  const counts = useMemo(() => issuesBySection(issues), [issues]);
  const sections = useMemo(() => sectionsFor(data.format), [data.format]);
  const has = Object.fromEntries(sections.map(([id]) => [id, true]));
  // Section names for the checks list (sections that rules can report on).
  const checkedSections = Object.fromEntries(sections.filter(([id]) => id !== "checks" && id !== "standard"));
  // The server's workflow state, plus what changed on screen since it was loaded.
  const workflow = useMemo(() => {
    const edited = JSON.stringify(content) !== JSON.stringify(data.syllabus.content);
    return {
      ...data.workflow,
      saved: data.workflow.saved || edited,
      hasUncommittedChanges: data.workflow.hasUncommittedChanges || (edited && data.workflow.status !== "DRAFT"),
      errorCount: summarizeIssues(issues).errors,
    };
  }, [content, data, issues]);
  const navigate = useNavigate();
  const openPreview = async () => {
    if (data.canEdit) await autosave.saveNow(); // the preview and PDF show the saved copy
    navigate(`${path}/preview`);
  };
  const ctx = data;
  const first = data.offerings[0];

  return (
    <>
      <PageHeader
        back={{ href: "/", label: "Home" }}
        title={`${data.course.code} — ${data.course.title}`}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{data.scheme.name}</span>
            <span>· {data.offerings.map((o) => o.programme.code).join(", ")}</span>
            <span>· Semester {first.semester}</span>
            {data.format && <Badge variant="secondary">{formatLabels[data.format.format]}</Badge>}
            <SyllabusStatusBadge status={data.workflow.status} />
            {!data.canEdit && (
              <Badge variant="outline">
                <Eye />
                Read-only
              </Badge>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-start gap-4">
            {data.assignments.length > 0 && (
              <div className="text-right text-xs text-muted-foreground">
                {data.assignments.map((a) => (
                  <div key={a.id}>
                    {a.name} <span className="opacity-70">({assignmentRoleLabels[a.role]})</span>
                  </div>
                ))}
              </div>
            )}
            {content && (
              <Button variant="outline" onClick={openPreview}>
                <FileText data-icon="inline-start" />
                Preview &amp; PDF
              </Button>
            )}
          </div>
        }
      />

      {data.format && data.syllabus.content && (
        <WorkflowBar
          path={path}
          data={data}
          state={workflow}
          beforeAction={async () => {
            if (data.canEdit) await autosave.saveNow();
          }}
        />
      )}

      {data.lockedReason && data.workflow.status !== "APPROVED" && (
        <Alert className="mb-6">
          <AlertTitle>Read-only</AlertTitle>
          <AlertDescription>{data.lockedReason}</AlertDescription>
        </Alert>
      )}

      {autosave.conflict && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle />
          <AlertTitle>Your latest changes were not saved</AlertTitle>
          <AlertDescription>
            <p>{autosave.conflict.message}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={autosave.acceptLatest}>
              <History />
              Load the saved version
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!content ? null : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_12rem]">
          <fieldset disabled={!data.canEdit} className="min-w-0 space-y-6">
            <ChecksPanel issues={issues} sectionLabels={checkedSections} />
            <HeaderSection ctx={ctx} totals={totals} />
            <ObjectivesSection content={content} update={update} ctx={ctx} />
            <PrerequisitesSection content={content} update={update} ctx={ctx} />
            {has.units && <UnitsSection content={content} update={update} ctx={ctx} totals={totals} />}
            {has.flipped && <FlippedSection content={content} update={update} totals={totals} />}
            {has.experiments && <ExperimentsSection content={content} update={update} ctx={ctx} totals={totals} />}
            <BooksSection content={content} update={update} ctx={ctx} />
            <TwSlSection content={content} update={update} ctx={ctx} totals={totals} />
            <OutcomesSection content={content} update={update} ctx={ctx} />
            <MappingSection content={content} update={update} ctx={ctx} />
            <StandardTextSection ctx={ctx} kindLabels={textBlockKindLabels} />
          </fieldset>
          <nav aria-label="Sections" className="hidden xl:block">
            <ul className="sticky top-24 space-y-0.5 border-l text-sm">
              {sections.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="-ml-px flex items-center gap-2 border-l-2 border-transparent px-3 py-1 text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    {label}
                    {id !== "checks" && <SectionIssueCount counts={counts[id]} />}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}

      {data.canEdit && <SaveStatus autosave={autosave} />}
    </>
  );
}

/** Floating autosave indicator (bottom right). */
function SaveStatus({ autosave }) {
  const { status, error, savedAt, saveNow } = autosave;
  const time = savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  const views = {
    saved: { icon: Check, text: time ? `Saved at ${time}` : "All changes saved", tone: "text-success" },
    unsaved: { icon: null, text: "Unsaved changes", tone: "text-muted-foreground" },
    saving: { icon: Loader2, text: "Saving…", tone: "text-muted-foreground", spin: true },
    error: { icon: CloudOff, text: error ?? "Not saved", tone: "text-destructive" },
    conflict: { icon: AlertTriangle, text: "Not saved: conflict", tone: "text-destructive" },
  };
  const view = views[status];
  const Icon = view.icon;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-20 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm shadow-lg"
    >
      {Icon && <Icon className={cn("size-4 shrink-0", view.tone, view.spin && "animate-spin")} />}
      <span className={cn("truncate", view.tone)}>{view.text}</span>
      {status === "error" && (
        <Button size="xs" variant="outline" onClick={saveNow}>
          <RotateCw />
          Retry
        </Button>
      )}
    </div>
  );
}
