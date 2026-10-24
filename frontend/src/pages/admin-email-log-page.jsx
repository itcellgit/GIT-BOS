import { CircleAlert, CircleCheck, Clock, MailX, RotateCw } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import { useDataTable } from "@/hooks/use-data-table";
import { retryNotification } from "@/lib/actions";
import { formatDateTime } from "@/lib/download";
import { DataTablePagination, DataTableToolbar, NoResultsRow, SortableHead } from "@/components/data-table/data-table";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** What each notification is about (services/notification-messages.js). */
const kindLabels = {
  assignment: "Assigned to a course",
  submitted: "Syllabus submitted",
  inputs: "Review inputs to answer",
  expertComments: "Expert comments",
  inputsAnswered: "All inputs answered",
  stageClosed: "Stage closed",
  approved: "Syllabus approved",
  unlocked: "Unlocked for correction",
  needsRevision: "Needs revision",
};
const statusInfo = {
  PENDING: { label: "Waiting", variant: "outline", icon: Clock },
  SENDING: { label: "Sending", variant: "outline", icon: Clock },
  SENT: { label: "Sent", variant: "success", icon: CircleCheck },
  FAILED: { label: "Failed", variant: "destructive", icon: CircleAlert },
  SKIPPED: { label: "Not sent", variant: "secondary", icon: MailX },
};

export function AdminEmailLogPage() {
  const query = useApiQuery("/admin/notifications");
  return (
    <>
      <PageHeader
        title="Email log"
        description="Workflow emails of the last 1,000 notifications. Inputs and expert comments are collected for a few minutes and sent as one email. Failed emails are retried automatically up to five times."
      />
      <QueryState query={query}>{(data) => <EmailLog {...data} />}</QueryState>
    </>
  );
}

function EmailLog({ notifications, counts }) {
  const table = useDataTable({
    id: "emails",
    rows: notifications,
    columns: {
      when: { sortValue: (n) => new Date(n.createdAt), firstDir: "desc" },
      recipient: { sortValue: (n) => n.recipient.name },
      attempts: { sortValue: (n) => n.attempts, firstDir: "desc" },
    },
    defaultSort: { key: "when", dir: "desc" },
    searchText: (n) => [n.recipient.name, n.recipient.email, n.course, kindLabels[n.kind], n.lastError].join(" "),
    filterDefs: {
      status: (n, v) => n.status === v,
      kind: (n, v) => n.kind === v,
    },
  });

  if (notifications.length === 0) {
    return <EmptyState>No emails yet. They appear here as people use the review workflow.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["SENT", "PENDING", "FAILED", "SKIPPED"].map((s) => {
          const { label, variant, icon: Icon } = statusInfo[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => table.setFilter("status", table.filters.status === s ? "" : s)}
              className="rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              aria-pressed={table.filters.status === s}
              title={`Show only: ${label}`}
            >
              <Badge variant={variant} className="h-7 px-3 text-sm">
                <Icon />
                {label}: {counts[s] ?? 0}
              </Badge>
            </button>
          );
        })}
      </div>
      <DataTableToolbar
        table={table}
        noun="emails"
        searchPlaceholder="Recipient, course or error"
        filters={[
          {
            key: "status",
            label: "Status",
            allLabel: "Any status",
            options: Object.entries(statusInfo).map(([value, s]) => ({ value, label: s.label })),
          },
          {
            key: "kind",
            label: "Email",
            allLabel: "All emails",
            width: "w-52",
            options: Object.entries(kindLabels).map(([value, label]) => ({ value, label })),
          },
        ]}
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead table={table} column="when">
                Queued
              </SortableHead>
              <SortableHead table={table} column="recipient">
                Recipient
              </SortableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <SortableHead table={table} column="attempts" className="text-right" align="right">
                Attempts
              </SortableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.total === 0 && <NoResultsRow table={table} colSpan={6} />}
            {table.rows.map((n) => {
              const { label, variant, icon: Icon } = statusInfo[n.status];
              return (
                <TableRow key={n.id} className="align-top">
                  <TableCell className="text-muted-foreground">{formatDateTime(n.createdAt)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{n.recipient.name}</div>
                    <div className="text-xs text-muted-foreground">{n.recipient.email}</div>
                  </TableCell>
                  <TableCell>
                    {kindLabels[n.kind] ?? n.kind}
                    {n.course && (
                      <div className="text-xs text-muted-foreground">
                        {n.course}
                        {n.version && ` · ${n.version}`}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-80 whitespace-normal">
                    <Badge variant={variant}>
                      <Icon />
                      {label}
                    </Badge>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {n.status === "SENT" && n.sentAt && formatDateTime(n.sentAt)}
                      {n.status === "PENDING" && `Due ${formatDateTime(n.sendAfter)}`}
                      {n.status === "SKIPPED" && "Inactive, or emails turned off"}
                    </div>
                    {n.lastError && n.status !== "SENT" && (
                      <div className="mt-0.5 text-xs break-words text-destructive">{n.lastError}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{n.attempts}</TableCell>
                  <TableCell>
                    {n.status === "FAILED" && (
                      <ConfirmActionButton
                        action={retryNotification.bind(null, n.id)}
                        label="Send again"
                        icon={RotateCw}
                        title="Send this email again?"
                        description={`The email to ${n.recipient.email} is queued again and retried up to five times.`}
                        confirmLabel="Send again"
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <DataTablePagination table={table} />
      </div>
    </div>
  );
}
