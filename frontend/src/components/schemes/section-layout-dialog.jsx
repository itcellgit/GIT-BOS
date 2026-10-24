// Section layout of a format (README §5, §8): order, the optional sections on or off, and printed headings.
// Dean Academics changes it without a developer; on a published scheme the change is a scheme amendment.
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ListOrdered, RotateCcw, Save } from "lucide-react";
import { resolveSections, sectionIds } from "@acp/shared/domain/syllabi/sections";
import { formatLabels } from "@acp/shared/domain/schemes/rules";
import { useRefreshAll } from "@/hooks/use-api";
import { saveFormatSections } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export function SectionLayoutDialog({ schemeId, format, editable }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => resolveSections(format));
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const refreshAll = useRefreshAll();

  const move = (i, by) =>
    setRows((list) => {
      const next = [...list];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
  const set = (i, patch) => setRows((list) => list.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveFormatSections(schemeId, format.id, {
        sections: rows.map((r) => ({
          id: r.id,
          enabled: r.enabled,
          // A heading left as the default is stored empty, so it follows future default wording.
          label: r.defaultLabel !== null && r.label !== r.defaultLabel ? (r.label ?? "") : "",
        })),
      });
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      setOpen(false);
      refreshAll();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setRows(resolveSections(format));
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListOrdered />
          Sections
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formatLabels[format.format]} format — section layout</DialogTitle>
          <DialogDescription>
            The order in which sections print between the course details and the signatures. Optional sections can be
            turned off; headings can be renamed. Approved PDFs keep the layout they were approved with.
          </DialogDescription>
        </DialogHeader>
        <ol className="divide-y rounded-lg border">
          {rows.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="w-6 text-right text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {r.canHide ? (
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={r.enabled}
                        disabled={!editable}
                        onCheckedChange={(c) => set(i, { enabled: c === true })}
                        aria-label={`Print ${r.name}`}
                      />
                      {r.name}
                    </label>
                  ) : (
                    <span className="pl-6">{r.name}</span>
                  )}
                  {!r.enabled && <span className="text-xs font-normal text-muted-foreground">(not printed)</span>}
                </div>
                {r.defaultLabel !== null && (
                  <div className="flex items-center gap-1 pl-6">
                    <Input
                      aria-label={`Heading for ${r.name}`}
                      className="h-8 text-sm"
                      value={r.label ?? ""}
                      placeholder={r.defaultLabel}
                      disabled={!editable || !r.enabled}
                      onChange={(e) => set(i, { label: e.target.value })}
                    />
                    {r.label !== r.defaultLabel && editable && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Default heading for ${r.name}`}
                        title="Default heading"
                        onClick={() => set(i, { label: r.defaultLabel })}
                      >
                        <RotateCcw />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {editable && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${r.name} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${r.name} down`}
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          {editable && (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => setRows(resolveSections({ sections: sectionIds.map((id) => ({ id })) }))}
            >
              <RotateCcw />
              Template order
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>
            {editable ? "Cancel" : "Close"}
          </Button>
          {editable && (
            <Button onClick={save} disabled={pending}>
              <Save />
              {pending ? "Saving…" : "Save layout"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
