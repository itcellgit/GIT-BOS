import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/** The portal's mark: a graduation cap on the gold brand tile. */
export function BrandMark({ className }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold text-sidebar-primary-foreground shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <GraduationCap className="size-[55%]" strokeWidth={2.2} />
    </span>
  );
}
