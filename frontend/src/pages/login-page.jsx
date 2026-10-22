import { Navigate, useSearchParams } from "react-router";
import { GraduationCap } from "lucide-react";
import { useApiQuery, useMe } from "@/hooks/use-api";
import { LoginForm } from "@/components/auth/login-form";
import { LoadingScreen } from "@/components/layout/query-state";

export function LoginPage() {
  const [params] = useSearchParams();
  const next = params.get("next");
  const nextPath = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const me = useMe();
  const options = useApiQuery("/auth-options", { staleTime: Infinity });

  if (me.isPending) return <LoadingScreen />;
  if (me.data) return <Navigate to={nextPath} replace />;

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-primary/15 via-background to-chart-2/15 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <GraduationCap className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">KLS Gogte Institute of Technology</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Academic Curriculum Portal</h1>
        </div>
        <LoginForm nextPath={nextPath} socialProviders={options.data?.socialProviders ?? []} />
        <p className="text-center text-xs text-muted-foreground">
          Accounts are created by the portal administrator. Contact your BoS Coordinator if you cannot sign in.
        </p>
      </div>
    </main>
  );
}
