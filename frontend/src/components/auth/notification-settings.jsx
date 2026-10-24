import { useState } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { useRefreshAll } from "@/hooks/use-api";
import { setEmailNotifications } from "@/lib/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const events = [
  "you are assigned to a course",
  "review inputs or expert comments arrive on your syllabus (collected into one email)",
  "your syllabus moves to the next stage, is approved, or is unlocked for a correction",
  "a scheme change means your syllabus needs revision",
  "BoS Coordinators: a syllabus is submitted, or every input of a stage has an action taken",
];

/** My account: workflow emails on or off. */
export function NotificationSettings({ me }) {
  const refreshAll = useRefreshAll();
  const [pending, setPending] = useState(false);

  async function change(on) {
    setPending(true);
    const result = await setEmailNotifications(on);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      refreshAll();
    } else toast.error(result.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <BellRing />
          Email notifications
        </CardTitle>
        <CardDescription>Emails to {me.email} when something needs your attention.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2.5">
          <Checkbox
            id="email-notifications"
            checked={me.emailNotifications}
            disabled={pending}
            onCheckedChange={(v) => change(v === true)}
          />
          <Label htmlFor="email-notifications">Send me workflow emails</Label>
        </div>
        <div className="text-muted-foreground">
          <p>An email is sent when:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {events.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-2">Sign-in and password emails are always sent.</p>
        </div>
      </CardContent>
    </Card>
  );
}
