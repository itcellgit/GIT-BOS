import { Link } from "react-router";
import { EmptyState } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
/** Programmes the user may view, with their course counts under this scheme (loaded by the page). */
export function ProgrammesSection({ scheme, programmes: visible }) {
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Each programme&apos;s course list under {scheme.name} is maintained by its department&apos;s BoS Coordinator.
      </p>
      {visible.length === 0 ? (
        <EmptyState>No programmes you can view.</EmptyState>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Programme</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Courses in this scheme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      to={`/schemes/${scheme.id}/programmes/${p.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.code}
                    </Link>
                    <div className="text-xs text-muted-foreground">{p.name}</div>
                  </TableCell>
                  <TableCell>{p.department.code}</TableCell>
                  <TableCell className="text-right">{p._count.schemeCourses}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
