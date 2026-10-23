import {
  DataTablePagination,
  DataTableToolbar,
  NoResultsRow,
  SerialCell,
  SerialHead,
  SortableHead,
} from "@/components/data-table/data-table";
import { EmptyState } from "@/components/layout/page-header";
import { useDataTable } from "@/hooks/use-data-table";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/download";
import { History } from "lucide-react";

/** Changes to Layer 1 made after publishing, and how many syllabi each one still flags (README §5). */
export function AmendmentsSection({ scheme, amendments }) {
  const table = useDataTable({
    id: "amendments",
    rows: amendments,
    columns: {
      when: { sortValue: (a) => new Date(a.at), firstDir: "desc" },
      by: { sortValue: (a) => a.by },
      affected: { sortValue: (a) => a.affectedCount, firstDir: "desc" },
      open: { sortValue: (a) => a.openCount, firstDir: "desc" },
    },
    defaultSort: { key: "when", dir: "desc" },
    defaultPageSize: 10,
    searchText: (a) => [a.summary, a.by].join(" "),
    filterDefs: { open: (a, v) => (v === "open" ? a.openCount > 0 : a.openCount === 0) },
  });
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
        <div className="space-y-3">
          <DataTableToolbar
            table={table}
            noun="amendments"
            searchPlaceholder="Change or person"
            filters={[
              {
                key: "open",
                label: "Flags",
                allLabel: "All amendments",
                width: "w-48",
                options: [
                  { value: "open", label: "Some still open" },
                  { value: "closed", label: "All cleared" },
                ],
              },
            ]}
          />
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SerialHead />
                  <SortableHead table={table} column="when">
                    When
                  </SortableHead>
                  <TableHead>Change</TableHead>
                  <SortableHead table={table} column="by">
                    By
                  </SortableHead>
                  <SortableHead table={table} column="affected" className="text-right" align="right">
                    Syllabi flagged
                  </SortableHead>
                  <SortableHead table={table} column="open" className="text-right" align="right">
                    Still open
                  </SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.total === 0 && <NoResultsRow table={table} colSpan={6} />}
                {table.rows.map((a, i) => (
                  <TableRow key={a.id}>
                    <SerialCell n={table.from + i} />
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
            <DataTablePagination table={table} />
          </div>
        </div>
      )}
    </div>
  );
}
