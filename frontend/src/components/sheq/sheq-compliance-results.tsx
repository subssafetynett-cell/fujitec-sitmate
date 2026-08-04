import { computeSheqComplianceForKind } from "@/components/sheq/document-forms/sheq-service-forms";
import { cn } from "@/lib/utils";

type Props = {
  kind?: string | undefined;
  values?: Record<string, string> | undefined;
  className?: string | undefined;
};

function tone(pct: number) {
  if (pct >= 85) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (pct >= 60) return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-red-100 text-red-800 border-red-200";
}

/** Standalone summary shown after submitting a SHEQ service/installation form. */
export function SheqComplianceResultsPanel({ kind, values, className }: Props) {
  const summary = computeSheqComplianceForKind(kind, values);
  if (!summary) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Compliance result
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
            {summary.percent}%
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Score {summary.score} / {summary.max || "—"}
            {summary.ncCount > 0
              ? ` · ${summary.ncCount} nonconformance${summary.ncCount === 1 ? "" : "s"}`
              : " · No nonconformances"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide",
            tone(summary.percent),
          )}
        >
          {summary.percent >= 85
            ? "Good"
            : summary.percent >= 60
              ? "Fair"
              : "Poor"}
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {summary.sections.map((section) => (
          <div
            key={section.code}
            className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_48px] items-center gap-2 text-xs"
          >
            <span className="truncate text-muted-foreground">{section.title}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  section.percent >= 85
                    ? "bg-emerald-600"
                    : section.percent >= 60
                      ? "bg-amber-500"
                      : section.max > 0
                        ? "bg-red-600"
                        : "bg-muted-foreground/30",
                )}
                style={{ width: `${section.max > 0 ? section.percent : 0}%` }}
              />
            </div>
            <span className="text-right tabular-nums font-semibold">
              {section.max > 0 ? `${section.percent}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SheqComplianceBadge({
  kind,
  values,
}: {
  kind?: string | undefined;
  values?: Record<string, string> | undefined;
}) {
  const summary = computeSheqComplianceForKind(kind, values);
  if (!summary || summary.max <= 0) return null;
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums",
        tone(summary.percent),
      )}
    >
      {summary.percent}%
    </span>
  );
}
