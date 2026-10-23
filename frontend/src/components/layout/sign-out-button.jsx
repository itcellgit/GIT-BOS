import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton({ className }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={async () => {
        await authClient.signOut();
        queryClient.clear();
        navigate("/login", { replace: true });
      }}
    >
      <LogOut />
      Sign out
    </Button>
  );
}
