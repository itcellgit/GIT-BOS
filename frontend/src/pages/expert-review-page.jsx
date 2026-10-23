// The page an industry expert or alumnus opens from their review link (README §7, rule 6). No sign-in:
// the token in the address is the credential. The syllabus version is shown read-only; comments are
// written against a unit or section and reach the course team as review inputs.
import { useEffect, useState, useTransition } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { sectionRefLabel } from "@acp/shared/domain/reviews/workflow";
import { useApiQuery, useRefreshAll } from "@/hooks/use-api";
import { addExpertComment, deleteExpertComment } from "@/lib/actions";
import { formatDate, formatDateTime } from "@/lib/download";
import { LoadingScreen } from "@/components/layout/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ExpertReviewPage() {
  const { token } = useParams();
  const query = useApiQuery(`/expert/${token}`);
  // The token is in this page's address: never send it to other sites (e.g. an e-resource link).
  useEffect(() => {
    const meta = Object.assign(document.createElement("meta"), { name: "referrer", content: "no-referrer" });
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  return (
    <div className="min-h-svh bg-muted/40">
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        {query.isPending ? (
          <LoadingScreen />
        ) : query.isError ? (
          <div className="mx-auto max-w-lg py-16">
            <Alert>
              <AlertTitle>
                {query.error.status === 410 ? "This link can no longer be used" : "The link did not open"}
              </AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          </div>
        ) : (
          <Review token={token} data={query.data} />
        )}
      </div>
    </div>
  );
}

function Review({ token, data }) {
  return (
    <>
      <header className="mb-4 space-y-1">
        <p className="text-sm text-muted-foreground">{data.institution.name} · Syllabus review</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {data.course.code} — {data.course.title}
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{data.version.statusLabel}</Badge>
          <span>
            {data.course.department} · {data.scheme.name}
          </span>
          <span>
            · Review link for {data.reviewer.name}, valid until {formatDate(data.expiresAt)}
          </span>
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <iframe
          title={`${data.course.code} ${data.version.label}`}
          srcDoc={data.html}
          sandbox="allow-same-origin"
          className="h-[calc(100svh-10rem)] min-h-[600px] w-full rounded-lg border bg-muted"
        />
        <aside className="space-y-4">
          {data.open ? (
            <CommentForm token={token} sectionRefs={data.sectionRefs} />
          ) : (
            <Alert>
              <AlertTitle>The expert review has closed</AlertTitle>
              <AlertDescription>You can still read the syllabus and your comments.</AlertDescription>
            </Alert>
          )}
          <Comments token={token} comments={data.comments} open={data.open} />
        </aside>
      </div>
    </>
  );
}

function CommentForm({ token, sectionRefs }) {
  const refresh = useRefreshAll();
  const [sectionRef, setSectionRef] = useState("general");
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const submit = (e) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addExpertComment(token, { sectionRef, inputText: text });
      if (result.ok) {
        toast.success(result.message);
        setText("");
        refresh();
      } else {
        setError(result.fieldErrors?.inputText ?? result.error);
      }
    });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add a comment</CardTitle>
        <CardDescription>
          Choose the unit or section it is about. You can add as many comments as you like.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="comment-section">Section</Label>
            <Select value={sectionRef} onValueChange={setSectionRef}>
              <SelectTrigger id="comment-section" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sectionRefs.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comment-text">Comment</Label>
            <Textarea
              id="comment-text"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-invalid={!!error}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <Button type="submit" disabled={pending || !text.trim()}>
            {pending ? "Saving…" : "Save comment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Comments({ token, comments, open }) {
  const refresh = useRefreshAll();
  const [pending, startTransition] = useTransition();
  if (comments.length === 0) return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  const remove = (id) =>
    startTransition(async () => {
      const result = await deleteExpertComment(token, id);
      if (result.ok) {
        toast.success(result.message);
        refresh();
      } else toast.error(result.error);
    });
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Your comments ({comments.length})</h2>
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg border bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{sectionRefLabel(c.sectionRef)}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-line">{c.inputText}</p>
            {c.actionTaken ? (
              <p className="mt-2 rounded-md bg-muted/60 px-2 py-1 text-xs">
                <span className="font-medium">Course team&apos;s response:</span> {c.actionTaken}
              </p>
            ) : (
              open && (
                <Button size="xs" variant="ghost" className="mt-1" disabled={pending} onClick={() => remove(c.id)}>
                  Remove
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
