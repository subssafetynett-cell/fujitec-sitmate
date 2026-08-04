import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneRing = {
    default: "bg-accent text-accent-foreground",
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/12 text-destructive",
  }[tone];

  return (
    <div className="card-soft animate-rise p-5 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <p className="min-w-0 truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", toneRing)}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {typeof trend === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
              trend >= 0 ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive",
            )}
          >
            {trend >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(trend)}%
          </span>
        )}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}
