import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Says what happened and what to do next. Used for empty and error views. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  tone = "neutral",
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn("flex flex-col items-center px-6 py-10 text-center", className)}
    >
      <span
        className={cn(
          "mb-3 inline-flex size-11 items-center justify-center rounded-2xl",
          tone === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="text-[15px] font-semibold">{title}</p>
      {children && (
        <div className="mt-1 max-w-xs text-[14px] leading-5 text-muted-foreground">{children}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** A grouped list section, iOS settings style. */
export function Group({
  title,
  children,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {title && (
        <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-tight text-muted-foreground">
          {title}
        </h2>
      )}
      <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
        {children}
      </div>
    </section>
  );
}
