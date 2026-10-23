import { Fragment, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRefreshAll } from "@/hooks/use-api";
import { formSchemas } from "@acp/shared/schemas/config";
import { cn } from "@/lib/utils";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CourseRulesHelper } from "@/components/forms/course-rules-helper";
import { Save } from "lucide-react";
const NONE = "__none__";
/**
 * Generic create/edit dialog. Fields are described as data; validation uses the named Zod
 * schema from @acp/shared/schemas/config, and the API re-validates with the same schema.
 * `action(values)` resolves to the API result; `onSuccess(result)` runs after a successful save.
 */
export function EntityFormDialog({
  schema,
  fields,
  defaultValues,
  action,
  title,
  description,
  submitLabel = "Save",
  trigger,
  courseRules,
  onSuccess,
}) {
  const [open, setOpen] = useState(false);
  const refreshAll = useRefreshAll();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState(null);
  const form = useForm({
    defaultValues,
    resolver: zodResolver(formSchemas[schema]),
  });
  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    // Send the raw form values: the server parses them with the same schema.
    const raw = form.getValues();
    startTransition(async () => {
      const result = await action(raw);
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        setOpen(false);
        refreshAll();
        onSuccess?.(result);
        form.reset(raw);
      } else {
        setFormError(result.error);
        for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(name, { message });
        }
      }
    });
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset(defaultValues);
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-6 gap-4" noValidate>
          {fields.map((f) => {
            const error = form.formState.errors[f.name]?.message;
            const id = `field-${f.name}`;
            const span =
              f.width === "third"
                ? "col-span-6 sm:col-span-2"
                : f.width === "half"
                  ? "col-span-6 sm:col-span-3"
                  : "col-span-6";
            return (
              <Fragment key={f.name}>
                <div className={cn("space-y-1.5", span)}>
                  {f.type !== "checkbox" && <Label htmlFor={id}>{f.label}</Label>}
                  {["text", "email", "number", "password", "date", "datetime-local"].includes(f.type) && (
                    <Input
                      id={id}
                      type={f.type}
                      inputMode={f.type === "number" ? "numeric" : undefined}
                      autoComplete={f.type === "password" ? "new-password" : undefined}
                      placeholder={f.placeholder}
                      disabled={f.disabled}
                      aria-invalid={!!error}
                      {...form.register(f.name)}
                    />
                  )}
                  {f.type === "textarea" && (
                    <Textarea
                      id={id}
                      rows={f.rows ?? 4}
                      placeholder={f.placeholder}
                      disabled={f.disabled}
                      aria-invalid={!!error}
                      {...form.register(f.name)}
                    />
                  )}
                  {f.type === "select" && (
                    <Controller
                      control={form.control}
                      name={f.name}
                      render={({ field }) => (
                        <Select
                          value={field.value ? String(field.value) : f.emptyLabel ? NONE : ""}
                          onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                          disabled={f.disabled}
                        >
                          <SelectTrigger id={id} className="w-full" aria-invalid={!!error}>
                            <SelectValue placeholder="Choose…" />
                          </SelectTrigger>
                          <SelectContent>
                            {f.emptyLabel && <SelectItem value={NONE}>{f.emptyLabel}</SelectItem>}
                            {f.options.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                  {f.type === "multiselect" && (
                    <Controller
                      control={form.control}
                      name={f.name}
                      render={({ field }) => {
                        const value = Array.isArray(field.value) ? field.value : [];
                        return (
                          <div id={id} className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border p-3">
                            {f.options.map((o) => (
                              <label key={o.value} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={value.includes(o.value)}
                                  disabled={f.disabled}
                                  onCheckedChange={(c) =>
                                    field.onChange(c ? [...value, o.value] : value.filter((x) => x !== o.value))
                                  }
                                />
                                {o.label}
                              </label>
                            ))}
                          </div>
                        );
                      }}
                    />
                  )}
                  {f.type === "checkbox" && (
                    <Controller
                      control={form.control}
                      name={f.name}
                      render={({ field }) => (
                        <label htmlFor={id} className="flex items-center gap-2 pt-1 text-sm font-medium">
                          <Checkbox
                            id={id}
                            checked={!!field.value}
                            disabled={f.disabled}
                            onCheckedChange={(c) => field.onChange(c === true)}
                          />
                          {f.label}
                        </label>
                      )}
                    />
                  )}
                  {f.description && !error && <p className="text-xs text-muted-foreground">{f.description}</p>}
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
                {courseRules && f.name === "teachingDepartmentId" && (
                  <div className="col-span-6">
                    <CourseRulesHelper form={form} data={courseRules} />
                  </div>
                )}
              </Fragment>
            );
          })}
          {formError && (
            <p className="col-span-6 text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
          <DialogFooter className="col-span-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              <Save />
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
