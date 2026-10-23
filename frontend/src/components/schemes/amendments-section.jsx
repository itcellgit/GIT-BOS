import { EmptyState } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/download";
import { History } from "lucide-react";

/** Changes to Layer 1 made after publishing, and how many syllabi each one still flags (README §5). */
export function AmendmentsSection({ scheme, amendments }) {
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Every change to the rules of a published scheme is recorded here. Each syllabus a change can affect is flagged
        <span className="font-medium text-foreground"> Needs revision</span> and its checks are re-run with the new
        rules. A flag clears when the syllabus is saved as a new version, or when the BoS Coordinator records that no
        change is needed.
      </p>
      {amendments.length === 0 ? (
        <EmptyState icon={History}>
          {scheme.status === "DRAFT"
            ? "Changes made before publishing are not amendments."
            : "No amendments since this scheme was published."}
        </EmptyState>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="text-right">Syllabi flagged</TableHead>
                <TableHead className="text-right">Still open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {amendments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.at)}</TableCell>
                  <TableCell className="font-medium">{a.summary}</TableCell>
                  <TableCell>{a.by ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.affectedCount}</TableCell>
                  <TableCell className="text-right">
                    {a.openCount > 0 ? (
                      <Badge variant="warning">{a.openCount}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
