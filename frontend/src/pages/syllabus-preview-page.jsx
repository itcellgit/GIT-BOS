// Print preview of a syllabus and its PDF (README §8). The preview HTML is built by the same shared
// function the API uses for the PDF, so what is shown here is what prints.
import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { summarizeIssues } from "@acp/shared/domain/syllabi/validate";
import { syllabusHtml } from "@acp/shared/print/syllabus-document";
import { useApiQuery } from "@/hooks/use-api";
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
  return <QueryState query={query}>{(data) => <Preview path={path} data={data} />}</QueryState>;
}

function Preview({ path, data }) {
  const frame = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const html = useMemo(
    () => (data.format && data.syllabus.content ? syllabusHtml(data, data.syllabus.content) : null),
    [data],
  );
  const { errors, warnings } = summarizeIssues(data.validation ?? []);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api${path}/pdf?download=1`, { credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `The PDF could not be made (${res.status}).`);
      }
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `${data.course.code}_syllabus_draft.pdf`,
      });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: path, label: "Back to the editor" }}
        title={`${data.course.code} — print preview`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{data.course.title}</span>
            <Badge variant="warning">Draft</Badge>
            {data.syllabus.updatedAt && (
              <span>
                · Saved {new Date(data.syllabus.updatedAt).toLocaleString()}
                {data.syllabus.updatedBy ? ` by ${data.syllabus.updatedBy}` : ""}
              </span>
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
              <Button onClick={downloadPdf} disabled={downloading}>
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
