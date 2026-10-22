import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await authClient.signOut();
        queryClient.clear();
        navigate("/login", { replace: true });
      }}
    >
      Sign out
    </Button>
  );
}
