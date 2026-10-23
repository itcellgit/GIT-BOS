// Print preview of a syllabus and its PDF (README §8): the working copy, or one version (?version=id).
// The preview HTML is built by the same shared function the API uses for the PDF, so what is shown
// here is what prints.
import { useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { summarizeIssues } from "@acp/shared/domain/syllabi/validate";
import { syllabusHtml } from "@acp/shared/print/syllabus-document";
import { useApiQuery } from "@/hooks/use-api";
import { downloadPdf } from "@/lib/download";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SyllabusPreviewPage() {
  const { schemeId, courseId } = useParams();
  const path = `/syllabi/${schemeId}/${courseId}`;
  // Always the latest saved copy; not kept in the cache, so the editor reloads it too.
  const query = useApiQuery(path, { staleTime: 0, gcTime: 0 });
  const versionId = useSearchParams()[0].get("version");
  const version = useApiQuery(`${path}/versions/${versionId}`, { enabled: !!versionId, staleTime: Infinity });
  return (
    <QueryState query={query}>
      {(data) =>
        versionId ? (
          <QueryState query={version}>{(v) => <Preview path={path} data={data} version={v} />}</QueryState>
        ) : (
          <Preview path={path} data={data} />
        )
      }
    </QueryState>
  );
}

/** `version`: { version, content } of a frozen version, or undefined for the working copy. */
function Preview({ path, data, version }) {
  const frame = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const html = useMemo(() => {
    if (version) {
      return syllabusHtml(data, version.content, { status: { label: version.version.statusLabel, draft: false } });
    }
    return data.format && data.syllabus.content ? syllabusHtml(data, data.syllabus.content) : null;
  }, [data, version]);
  const { errors, warnings } = version ? { errors: 0, warnings: 0 } : summarizeIssues(data.validation ?? []);

  const download = async () => {
    setDownloading(true);
    try {
      if (version) {
        await downloadPdf(
          `${path}/versions/${version.version.id}/pdf`,
          `${data.course.code}_syllabus_${version.version.label}.pdf`,
        );
      } else {
        await downloadPdf(`${path}/pdf`, `${data.course.code}_syllabus_draft.pdf`);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader
        back={
          version
            ? { href: `${path}/review`, label: "Back to the review" }
            : { href: path, label: "Back to the editor" }
        }
        title={`${data.course.code} — ${version ? version.version.label : "print preview"}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{data.course.title}</span>
            {version ? (
              <>
                <Badge variant={version.version.official ? "success" : "secondary"}>
                  {version.version.statusLabel}
                </Badge>
                <span>
                  · Frozen {new Date(version.version.createdAt).toLocaleString()}
                  {version.version.createdBy ? ` by ${version.version.createdBy}` : ""}
                </span>
              </>
            ) : (
              <>
                <Badge variant="warning">Working copy</Badge>
                {data.syllabus.updatedAt && (
                  <span>
                    · Saved {new Date(data.syllabus.updatedAt).toLocaleString()}
                    {data.syllabus.updatedBy ? ` by ${data.syllabus.updatedBy}` : ""}
                  </span>
                )}
              </>
            )}
          </span>
        }
        actions={
          html && (
            <>
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
            </>
          )
        }
      />

      {!html ? (
        <Alert>
          <AlertTitle>Nothing to preview</AlertTitle>
          <AlertDescription>{data.lockedReason ?? "This course has no syllabus format yet."}</AlertDescription>
        </Alert>
      ) : (
        <>
          {errors + warnings > 0 && (
            <Alert className="mb-4">
              <AlertTitle>
                {errors > 0
                  ? `The syllabus is not complete: ${errors} ${errors === 1 ? "error" : "errors"}${warnings ? ` and ${warnings} ${warnings === 1 ? "warning" : "warnings"}` : ""}.`
                  : `${warnings} ${warnings === 1 ? "warning" : "warnings"} to review.`}
              </AlertTitle>
              <AlertDescription>
                You can still print the draft. <Link to={`${path}#checks`}>See the checks in the editor</Link>.
              </AlertDescription>
            </Alert>
          )}
          <iframe
            ref={frame}
            title={`Print preview of ${data.course.code}`}
            srcDoc={html}
            // No scripts run in the preview; same origin so the Print button can reach it.
            sandbox="allow-same-origin allow-modals"
            className="h-[calc(100vh-16rem)] min-h-[600px] w-full rounded-lg border bg-muted"
          />
        </>
      )}
    </>
  );
}
