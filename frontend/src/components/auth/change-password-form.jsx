import { useState, useTransition } from "react";
import { useNavigate } from "react-router";
import { api } from "@/lib/api";
import { useRefreshAll } from "@/hooks/use-api";
import { toast } from "sonner";
import { passwordProblem } from "@acp/shared/schemas/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function ChangePasswordForm({ required }) {
  const navigate = useNavigate();
  const refreshAll = useRefreshAll();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  function submit(e) {
    e.preventDefault();
    const problem = passwordProblem(values.newPassword);
    const local = {};
    if (!values.currentPassword) local.currentPassword = "Enter your current password";
    if (problem) local.newPassword = problem;
    if (values.newPassword !== values.confirmPassword) local.confirmPassword = "Passwords do not match";
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      const result = await api.post("/account/change-password", values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        return;
      }
      toast.success(result.message ?? "Password changed");
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      await refreshAll();
      if (required) navigate("/", { replace: true });
    });
  }
  const field = (key, label, autoComplete, hint) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="password"
        autoComplete={autoComplete}
        value={values[key]}
        onChange={set(key)}
        aria-invalid={!!errors[key]}
      />
      {errors[key] ? (
        <p className="text-xs text-destructive">{errors[key]}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
  return (
    <form onSubmit={submit} className="max-w-sm space-y-4" noValidate>
      {field("currentPassword", required ? "Current (temporary) password" : "Current password", "current-password")}
      {field("newPassword", "New password", "new-password", "At least 12 characters, with letters and digits.")}
      {field("confirmPassword", "Confirm new password", "new-password")}
      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
