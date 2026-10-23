import { FileQuestion, ShieldOff } from "lucide-react";
import { StatusMessage } from "@/components/layout/query-state";

export function NoAccessPage() {
  return (
    <StatusMessage icon={ShieldOff} title="You don't have access to this page">
      Your role does not include this section. If you think this is a mistake, ask the portal administrator to check
      your roles.
    </StatusMessage>
  );
}

export function NotFoundPage() {
  return <StatusMessage icon={FileQuestion} title="Page not found" />;
}
