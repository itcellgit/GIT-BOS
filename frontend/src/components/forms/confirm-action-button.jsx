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
/**
 * A button that asks for confirmation, then runs an API action and shows the result.
 * `icon` (a lucide icon) shows before the label; with `iconOnly` the label becomes the accessible name.
 */
export function ConfirmActionButton({
  action,
  label,
  icon: Icon,
  iconOnly = false,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "outline",
  size = "sm",
  onSuccess,
}) {
  const [open, setOpen] = useState(false);
  const refreshAll = useRefreshAll();
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={iconOnly ? `icon-${size}` : size}
          aria-label={iconOnly ? label : undefined}
          title={iconOnly ? label : undefined}
        >
          {Icon && <Icon />}
          {!iconOnly && label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await action();
                if (result.ok) {
                  toast.success(result.message ?? "Done");
                  setOpen(false);
                  refreshAll();
                  onSuccess?.(result);
                } else {
                  toast.error(result.error);
                }
              })
            }
          >
            {Icon && !pending && <Icon />}
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
