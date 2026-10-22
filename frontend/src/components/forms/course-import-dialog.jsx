import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRefreshAll } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
export function CourseImportDialog({ action, templateHref }) {
  const [open, setOpen] = useState(false);
  const refreshAll = useRefreshAll();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setResult(null);
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Import from Excel</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import course list from Excel</DialogTitle>
          <DialogDescription>
            Download the workbook, edit or add rows, and upload it here. Rows with a course code already in the list
            update that course; new codes are added. Every row is checked first — if any row has a problem, nothing is
            saved.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setError(null);
            setResult(null);
            startTransition(async () => {
              const r = await action(fd);
              if (!r.ok) return setError(r.error);
              setResult(r.data);
              if (r.data.imported > 0) {
                toast.success(`${r.data.imported} course(s) imported`);
                refreshAll();
              }
            });
          }}
        >
          <Button asChild variant="link" className="px-0">
            <a href={templateHref}>Download the workbook (current list + valid values)</a>
          </Button>
          <Input
            type="file"
            name="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {result && result.errors.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-destructive/40 p-3 text-sm" role="alert">
              <p className="mb-2 font-medium text-destructive">
                Nothing was imported. Fix these rows and upload again:
              </p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium">Row {e.row}</span>
                    {e.code && ` (${e.code})`}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result && result.imported > 0 && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {result.imported} course(s) imported successfully.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Checking…" : "Upload and import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
