// Public verification of an approved syllabus PDF (README §8), opened from the QR code printed on it. No
// sign-in. Shows what was approved and checks a copy: its SHA-256 (computed here, the file is not uploaded)
// must equal the checksum stored when the PDF was frozen.
import { useState } from "react";
import { useParams } from "react-router";
import { BadgeCheck, FileWarning, ShieldCheck } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import { formatDate } from "@/lib/download";
import { LoadingScreen } from "@/components/layout/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VerifyPage() {
  const { documentId } = useParams();
  const query = useApiQuery(`/verify/${documentId}`, { retry: false });
  return (
    <div className="min-h-svh bg-muted/40">
      <div className="mx-auto max-w-xl px-4 py-10">
        {query.isPending ? (
          <LoadingScreen />
        ) : query.isError ? (
          <Alert variant="destructive">
            <FileWarning />
            <AlertTitle>Not verified</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : (
          <Verified doc={query.data} />
        )}
      </div>
    </div>
  );
}

function Verified({ doc }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{doc.institution} · Document verification</CardDescription>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ShieldCheck className="size-6 text-success" />
          Approved syllabus
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Course</dt>
          <dd className="font-medium">
            {doc.course.code} — {doc.course.title}
          </dd>
          <dt className="text-muted-foreground">Scheme</dt>
          <dd>{doc.scheme}</dd>
          <dt className="text-muted-foreground">Version</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {doc.version}
            {doc.current ? (
              <Badge variant="success">Current official syllabus</Badge>
            ) : (
              <Badge variant="outline">Replaced by a later approved version</Badge>
            )}
          </dd>
          <dt className="text-muted-foreground">Approved</dt>
          <dd>{doc.approvedAt ? formatDate(doc.approvedAt) : "—"}</dd>
          <dt className="text-muted-foreground">SHA-256</dt>
          <dd className="font-mono text-xs break-all">{doc.sha256}</dd>
        </dl>
        <CheckCopy sha256={doc.sha256} />
      </CardContent>
    </Card>
  );
}

/** Compares a chosen PDF with the stored checksum, in the browser. */
function CheckCopy({ sha256 }) {
  const [result, setResult] = useState(null);
  const check = async (file) => {
    if (!file) return setResult(null);
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    setResult({ name: file.name, match: hex === sha256 });
  };
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <Label htmlFor="copy">Check a copy of the PDF</Label>
      <p className="text-sm text-muted-foreground">
        Choose the PDF you received. It is checked on this device and not uploaded.
      </p>
      <Input id="copy" type="file" accept="application/pdf" onChange={(e) => check(e.target.files?.[0])} />
      {result &&
        (result.match ? (
          <Alert>
            <BadgeCheck className="text-success" />
            <AlertTitle>Genuine</AlertTitle>
            <AlertDescription>{result.name} is exactly the approved PDF.</AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <FileWarning />
            <AlertTitle>Does not match</AlertTitle>
            <AlertDescription>
              {result.name} is not the approved PDF: it was changed, or it is a different document. A printout cannot be
              checked this way; compare it with the details above.
            </AlertDescription>
          </Alert>
        ))}
    </div>
  );
}
