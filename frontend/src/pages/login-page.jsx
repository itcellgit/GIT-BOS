import { Navigate, useSearchParams } from "react-router";
import { FileCheck2, PenLine, Users } from "lucide-react";
import { useApiQuery, useMe } from "@/hooks/use-api";
import { LoginForm } from "@/components/auth/login-form";
import { BrandMark } from "@/components/layout/brand-mark";
import { LoadingScreen } from "@/components/layout/query-state";
import { ThemeMenu } from "@/components/layout/theme-menu";

const highlights = [
  {
    icon: PenLine,
    text: "Frame syllabi in the institution's Theory, Integrated and Lab formats, checked as you type.",
  },
  { icon: Users, text: "Record Internal BoS, External BoS and Academic Council reviews with full version history." },
  {
    icon: FileCheck2,
    text: "Print-ready syllabus PDFs and Action Taken reports, laid out like the official templates.",
  },
];

export function LoginPage() {
  const [params] = useSearchParams();
  const next = params.get("next");
  const nextPath = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const me = useMe();
  const options = useApiQuery("/auth-options", { staleTime: Infinity });

  if (me.isPending || options.isPending) return <LoadingScreen />;
  if (me.data) return <Navigate to={nextPath} replace />;

  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel (large screens) */}
      <section className="relative hidden overflow-hidden border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:border-r lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(var(--sidebar-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--sidebar-foreground) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="size-10" />
          <div>
            <p className="text-[0.7rem] font-medium tracking-wider text-sidebar-foreground/60 uppercase">
              KLS Gogte Institute of Technology
            </p>
            <p className="font-semibold text-sidebar-accent-foreground">Academic Curriculum Portal</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-8">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-sidebar-accent-foreground xl:text-4xl">
            Syllabus framing and Board of Studies approval, in one place.
          </h2>
          <ul className="space-y-5">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3.5 text-sm leading-relaxed">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-brand-gold ring-1 ring-sidebar-border">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-sidebar-foreground/85">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/50">
          KLS Gogte Institute of Technology · Belagavi, Karnataka
        </p>
      </section>

      {/* Sign-in */}
      <section className="relative flex flex-col items-center justify-center bg-background px-4 py-12">
        <ThemeMenu className="absolute top-4 right-4" />
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center text-center lg:hidden">
            <BrandMark className="mb-4 size-12" />
            <p className="text-sm text-muted-foreground">KLS Gogte Institute of Technology</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Academic Curriculum Portal</h1>
          </div>
          <div className="hidden space-y-1.5 lg:block">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in with your institutional Google account.</p>
          </div>
          <LoginForm
            nextPath={nextPath}
            options={options.data}
            oauthError={{ code: params.get("error"), description: params.get("error_description") }}
          />
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Accounts are created by the portal administrator. Contact your BoS Coordinator if you cannot sign in.
          </p>
        </div>
      </section>
    </main>
  );
}
