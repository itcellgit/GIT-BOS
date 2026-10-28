import { cn } from "@/lib/utils";

/** The portal's mark: the KLS GIT logo on a white tile, so it reads on the dark sidebar and in dark mode. */
export function BrandMark({ className }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-black/5",
        className,
      )}
      aria-hidden="true"
    >
      <img src="/kls_git_logo.jpg" alt="" className="size-full object-contain" draggable={false} />
    </span>
  );
}
