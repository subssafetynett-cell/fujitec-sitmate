import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Check, CloudUpload, Loader2, Plus, Target, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartFrame, Panel } from "@/components/sheq/primitives";
import {
  fetchKpiStatYear,
  fetchKpiStatYears,
  saveKpiStatYear,
  type KpiStatMonthValues,
  type KpiStatRow,
} from "@/lib/api";
import { useRegisterKpiExporter } from "@/lib/kpi-export-context";
import { exportOhsReportPdf } from "@/lib/kpi-pdf-export";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

type MonthKey = (typeof MONTHS)[number];

const chartAxis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

const chartTooltip = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--color-border)",
    background: "var(--color-card)",
    color: "var(--color-card-foreground)",
    fontSize: 12,
  },
};

function emptyMonths(): KpiStatMonthValues {
  return {
    Jan: "",
    Feb: "",
    Mar: "",
    Apr: "",
    May: "",
    Jun: "",
    Jul: "",
    Aug: "",
    Sep: "",
    Oct: "",
    Nov: "",
    Dec: "",
  };
}

function defaultHigherIsBetter(indicator: string): boolean {
  const name = indicator.toLowerCase();
  if (
    /(injur|incident|accident|first aid|ltifr|lost time|defect|breakdown|complaint|waste|emission|fatality)/.test(
      name,
    )
  ) {
    return false;
  }
  return true;
}

let rowSeq = 0;

function createRow(year: number, indicator = "", slug = "kpi"): KpiStatRow {
  rowSeq += 1;
  return {
    id: `${slug}-${year}-row-${rowSeq}-${Date.now()}`,
    indicator,
    months: emptyMonths(),
    target: "",
    unit: "",
    higherIsBetter: defaultHigherIsBetter(indicator),
  };
}

function parseNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function calcYtd(months: KpiStatMonthValues): number {
  return MONTHS.reduce((sum, month) => sum + (parseNumber(months[month]) ?? 0), 0);
}

function sanitizeNumericInput(value: string): string {
  if (value === "" || value === ".") return value;
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatSigned(value: number): string {
  const abs = formatNumber(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return "0";
}

type ScorecardMetrics = {
  ytd: number;
  target: number | null;
  variance: number | null;
  variancePct: number | null;
  onTrack: boolean | null;
};

function getScorecardMetrics(row: KpiStatRow): ScorecardMetrics {
  const ytd = calcYtd(row.months);
  const target = parseNumber(row.target);

  if (target === null) {
    return { ytd, target: null, variance: null, variancePct: null, onTrack: null };
  }

  const variance = ytd - target;
  const variancePct = target === 0 ? null : (variance / Math.abs(target)) * 100;
  const onTrack = row.higherIsBetter ? ytd >= target : ytd <= target;

  return { ytd, target, variance, variancePct, onTrack };
}

function buildYearOptions(apiYears: number[] | undefined, selectedYear: number): number[] {
  const current = new Date().getFullYear();
  const base = [current + 1, current, current - 1, current - 2, current - 3, current - 4];
  return [...new Set([...(apiYears ?? []), ...base, selectedYear])].sort((a, b) => b - a);
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export type KpiDisciplineWorkspaceProps = {
  slug: string;
  label: string;
  shortLabel: string;
};

export function KpiDisciplineWorkspace({ slug, label, shortLabel }: KpiDisciplineWorkspaceProps) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [rows, setRows] = useState<KpiStatRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartRootRef = useRef<HTMLDivElement>(null);

  const yearsQuery = useQuery({
    queryKey: ["kpi-stat-years", slug],
    queryFn: () => fetchKpiStatYears(slug),
  });

  const yearQuery = useQuery({
    queryKey: ["kpi-stat-year", slug, year],
    queryFn: () => fetchKpiStatYear(slug, year),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { year: number; rows: KpiStatRow[] }) =>
      saveKpiStatYear(slug, payload.year, payload.rows),
    onMutate: () => setSaveState("saving"),
    onSuccess: (data) => {
      setSaveState("saved");
      setLastSavedAt(data.updatedAt);
      queryClient.setQueryData(["kpi-stat-year", slug, data.year], data);
      queryClient.invalidateQueries({ queryKey: ["kpi-stat-years", slug] });
    },
    onError: () => setSaveState("error"),
  });

  useEffect(() => {
    if (!yearQuery.data) return;
    skipNextSave.current = true;
    setRows(yearQuery.data.rows);
    setSelectedId(yearQuery.data.rows[0]?.id ?? "");
    setLastSavedAt(yearQuery.data.updatedAt);
    setSaveState("idle");
  }, [yearQuery.data]);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (rows.length === 0 || yearQuery.isFetching) return;

    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMutation.mutate({ year, rows });
    }, 700);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, year]);

  const yearOptions = buildYearOptions(yearsQuery.data?.years, year);
  const metrics = useMemo(() => rows.map((row) => getScorecardMetrics(row)), [rows]);

  const selectedIndex = Math.max(
    0,
    rows.findIndex((row) => row.id === selectedId),
  );
  const selectedRow = rows[selectedIndex] ?? rows[0];
  const selectedMetrics = selectedRow
    ? (metrics[selectedIndex] ?? getScorecardMetrics(selectedRow))
    : null;

  const onTrackCount = metrics.filter((m) => m.onTrack === true).length;
  const offTrackCount = metrics.filter((m) => m.onTrack === false).length;
  const withTargetCount = metrics.filter((m) => m.onTrack !== null).length;
  const scorePct =
    withTargetCount === 0 ? 0 : Math.round((onTrackCount / withTargetCount) * 100);

  const trendSeries = selectedRow
    ? MONTHS.map((month) => ({
        month,
        value: parseNumber(selectedRow.months[month]) ?? 0,
        target: selectedMetrics?.target ?? 0,
      }))
    : [];

  const comparison = rows.map((row, index) => {
    const m = metrics[index]!;
    return {
      name: row.indicator.trim() || `Indicator ${index + 1}`,
      shortName: (row.indicator.trim() || `Ind ${index + 1}`).split(" ").slice(0, 2).join(" "),
      ytd: m.ytd,
      target: m.target ?? 0,
    };
  });

  const updateRow = (id: string, patch: Partial<KpiStatRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const updateMonth = (id: string, month: MonthKey, value: string) => {
    const next = sanitizeNumericInput(value);
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, months: { ...row.months, [month]: next } } : row,
      ),
    );
  };

  const addRow = () => {
    const row = createRow(year, "", slug);
    setRows((prev) => [...prev, row]);
    setSelectedId(row.id);
  };

  const removeRow = (id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((row) => row.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? "");
      return next;
    });
  };

  const saveLabel = (() => {
    if (saveState === "saving") return "Saving…";
    if (saveState === "saved") return "Saved";
    if (saveState === "dirty") return "Unsaved changes";
    if (saveState === "error") return "Save failed — retrying on edit";
    if (lastSavedAt) return `Saved ${new Date(lastSavedAt).toLocaleString()}`;
    return "Auto-save on";
  })();

  const handleExportPdf = useCallback(async () => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }

    const pdfRows = rows.map((row, index) => {
      const m = metrics[index]!;
      return {
        indicator: row.indicator,
        months: row.months,
        target: row.target,
        unit: row.unit,
        higherIsBetter: row.higherIsBetter,
        ytd: m.ytd,
        variance: m.variance,
        variancePct: m.variancePct,
        onTrack: m.onTrack,
      };
    });

    try {
      toast.message("Preparing PDF…");
      await exportOhsReportPdf({
        year,
        rows: pdfRows,
        chartRoot: chartRootRef.current,
        filename: `${slug}-report-${year}.pdf`,
        title: `${label} Report`,
        statsTitle: `${shortLabel} Statistics`,
        scorecardTitle: `${label} Scorecard`,
        dashboardTitle: `${shortLabel} Dashboard`,
      });
      toast.success("PDF downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export PDF");
      throw error;
    }
  }, [metrics, rows, year, slug, label, shortLabel]);

  useRegisterKpiExporter(handleExportPdf);

  if (yearQuery.isLoading && rows.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading data for {year}…
        </div>
      </div>
    );
  }

  if (yearQuery.isError && rows.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-4 text-center">
        <p className="text-sm font-medium">Unable to load KPI data</p>
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => yearQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{label}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Filter by year to switch statistics, scorecard and dashboard. Changes auto-save.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pdf-hide">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Year</span>
            <Select
              value={String(year)}
              onValueChange={(value) => {
                if (saveTimer.current) clearTimeout(saveTimer.current);
                if (saveState === "dirty" || saveState === "saving") {
                  saveMutation.mutate({ year, rows });
                }
                setYear(Number(value));
              }}
            >
              <SelectTrigger className="h-9 w-[120px] rounded-xl" aria-label="Filter by year">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              saveState === "saved" && "bg-success/12 text-success",
              saveState === "saving" && "bg-muted text-muted-foreground",
              saveState === "dirty" && "bg-amber-500/12 text-amber-700 dark:text-amber-400",
              saveState === "error" && "bg-destructive/12 text-destructive",
              saveState === "idle" && "bg-muted text-muted-foreground",
            )}
          >
            {saveState === "saving" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : saveState === "saved" ? (
              <Check className="size-3.5" />
            ) : (
              <CloudUpload className="size-3.5" />
            )}
            {saveLabel}
          </div>
        </div>
      </div>

      <Panel
        title={`${shortLabel} Statistics · ${year}`}
        description="Enter indicators and monthly figures. YTD totals update automatically and all edits auto-save."
        actions={
          <Button type="button" variant="outline" className="rounded-xl" onClick={addRow}>
            <Plus /> Add indicator
          </Button>
        }
      >
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="sticky left-0 z-10 min-w-[220px] bg-muted/40 font-semibold">
                  Indicator
                </TableHead>
                {MONTHS.map((month) => (
                  <TableHead key={month} className="min-w-[76px] text-center font-semibold">
                    {month}
                  </TableHead>
                ))}
                <TableHead className="min-w-[88px] text-center font-semibold">YTD</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell className="sticky left-0 z-10 bg-card p-2">
                    <Input
                      value={row.indicator}
                      onChange={(e) => {
                        const indicator = e.target.value;
                        updateRow(row.id, {
                          indicator,
                          higherIsBetter: defaultHigherIsBetter(indicator),
                        });
                      }}
                      placeholder="Enter indicator"
                      aria-label={`Indicator ${index + 1}`}
                      className="h-9 rounded-lg border-border bg-background"
                    />
                  </TableCell>
                  {MONTHS.map((month) => (
                    <TableCell key={month} className="p-1.5">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={row.months[month]}
                        onChange={(e) => updateMonth(row.id, month, e.target.value)}
                        placeholder="0"
                        aria-label={`${row.indicator || "Indicator"} ${month}`}
                        className="h-9 rounded-lg border-border bg-background text-center tabular-nums"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="p-2 text-center">
                    <span className="inline-flex min-w-[3rem] justify-center rounded-lg bg-muted px-2 py-1.5 text-sm font-semibold tabular-nums">
                      {formatNumber(metrics[index]!.ytd)}
                    </span>
                  </TableCell>
                  <TableCell className="p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${row.indicator || "row"}`}
                      disabled={rows.length <= 1}
                      onClick={() => removeRow(row.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <Panel
        title={`${label} Scorecard · ${year}`}
        description="Targets vs YTD from statistics. Variance = YTD − Target. Status turns On Track or Off Track automatically."
      >
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="sticky left-0 z-10 min-w-[220px] bg-muted/40 font-semibold">
                  Indicator
                </TableHead>
                <TableHead className="min-w-[110px] text-center font-semibold">Target</TableHead>
                <TableHead className="min-w-[90px] text-center font-semibold">YTD</TableHead>
                <TableHead className="min-w-[100px] text-center font-semibold">Unit</TableHead>
                <TableHead className="min-w-[140px] text-center font-semibold">Better when</TableHead>
                <TableHead className="min-w-[130px] text-center font-semibold">Variance</TableHead>
                <TableHead className="min-w-[120px] text-center font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const m = metrics[index]!;
                const favorable = m.onTrack === true;
                const unfavorable = m.onTrack === false;

                return (
                  <TableRow key={`score-${row.id}`}>
                    <TableCell className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">
                      {row.indicator.trim() || (
                        <span className="text-muted-foreground">Untitled indicator</span>
                      )}
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={row.target}
                        onChange={(e) =>
                          updateRow(row.id, { target: sanitizeNumericInput(e.target.value) })
                        }
                        placeholder="0"
                        aria-label={`${row.indicator || "Indicator"} target`}
                        className="h-9 rounded-lg border-border bg-background text-center tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="p-2 text-center">
                      <span className="inline-flex min-w-[3rem] justify-center rounded-lg bg-muted px-2 py-1.5 text-sm font-semibold tabular-nums">
                        {formatNumber(m.ytd)}
                      </span>
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        value={row.unit}
                        onChange={(e) => updateRow(row.id, { unit: e.target.value })}
                        placeholder="e.g. %"
                        aria-label={`${row.indicator || "Indicator"} unit`}
                        className="h-9 rounded-lg border-border bg-background text-center"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Select
                        value={row.higherIsBetter ? "higher" : "lower"}
                        onValueChange={(value) =>
                          updateRow(row.id, { higherIsBetter: value === "higher" })
                        }
                      >
                        <SelectTrigger
                          className="h-9 rounded-lg"
                          aria-label={`${row.indicator || "Indicator"} better when`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="higher">Higher</SelectItem>
                          <SelectItem value="lower">Lower</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-2 text-center">
                      {m.variance === null ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={cn(
                              "inline-flex rounded-lg px-2 py-1 text-sm font-semibold tabular-nums",
                              favorable && "bg-success/12 text-success",
                              unfavorable && "bg-destructive/12 text-destructive",
                            )}
                          >
                            {formatSigned(m.variance)}
                          </span>
                          {m.variancePct !== null && (
                            <span
                              className={cn(
                                "text-[11px] font-medium tabular-nums",
                                favorable && "text-success",
                                unfavorable && "text-destructive",
                              )}
                            >
                              {formatSigned(m.variancePct)}%
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="p-2 text-center">
                      {m.onTrack === null ? (
                        <span className="text-sm text-muted-foreground">Set target</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                            m.onTrack
                              ? "bg-success/12 text-success"
                              : "bg-destructive/12 text-destructive",
                          )}
                        >
                          {m.onTrack ? "On Track" : "Off Track"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <div ref={chartRootRef} className="flex flex-col gap-6" data-ohs-dashboard>
        <div>
          <h2 className="text-base font-semibold">{shortLabel} Dashboard · {year}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Live view of the indicators, targets and monthly values for the selected year.
          </p>
        </div>

        <div data-pdf-section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {rows.map((row, index) => {
            const m = metrics[index]!;
            const active = row.id === selectedRow?.id;
            const good = m.onTrack === true;
            const bad = m.onTrack === false;
            const pct =
              m.target && m.target !== 0
                ? Math.min(
                    100,
                    row.higherIsBetter
                      ? (m.ytd / m.target) * 100
                      : m.ytd === 0
                        ? 100
                        : (m.target / m.ytd) * 100,
                  )
                : 0;

            return (
              <button
                key={`tile-${row.id}`}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={cn(
                  "card-soft w-full p-4 text-left transition-all duration-200 hover:-translate-y-0.5",
                  active && "ring-2 ring-ring",
                )}
              >
                <p className="line-clamp-2 min-h-9 text-xs font-medium text-muted-foreground">
                  {row.indicator.trim() || "Untitled indicator"}
                </p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums">{formatNumber(m.ytd)}</span>
                  <span className="text-xs text-muted-foreground">{row.unit}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Target className="size-3" />
                    {m.target === null ? "—" : formatNumber(m.target)}
                    {row.unit ? ` ${row.unit}` : ""}
                  </span>
                  {m.variance !== null ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 font-semibold",
                        good && "text-success",
                        bad && "text-destructive",
                      )}
                    >
                      {m.variance >= 0 ? (
                        <TrendingUp className="size-3" />
                      ) : (
                        <TrendingDown className="size-3" />
                      )}
                      {formatSigned(m.variance)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No target</span>
                  )}
                </div>
                <Progress value={pct} className="mt-3 h-1.5" />
              </button>
            );
          })}
        </div>

        {selectedRow && selectedMetrics && (
          <div className="flex flex-col gap-4">
            <div data-pdf-section>
              <Panel
                title={selectedRow.indicator.trim() || "Selected indicator"}
                description={`Monthly trend for ${year} against scorecard target`}
              >
                <ChartFrame height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendSeries}>
                      <defs>
                        <linearGradient id="ohsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.75} />
                          <stop offset="55%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="month" {...chartAxis} />
                      <YAxis {...chartAxis} width={40} />
                      <Tooltip {...chartTooltip} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        name="Actual"
                        stroke="var(--color-chart-1)"
                        fill="url(#ohsFill)"
                        strokeWidth={2.5}
                        fillOpacity={1}
                      />
                      {selectedMetrics.target !== null && (
                        <Area
                          type="monotone"
                          dataKey="target"
                          name="Target"
                          stroke="var(--color-chart-4)"
                          fill="none"
                          strokeDasharray="5 4"
                          strokeWidth={2.5}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartFrame>
              </Panel>
            </div>

            <div data-pdf-section>
              <Panel title={`${shortLabel} score`} description={`On Track status for ${year}`}>
                <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-end">
                  <div>
                    <p className="text-5xl font-bold tabular-nums">{scorePct}%</p>
                    <Progress value={scorePct} className="mt-4 h-2.5" />
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">On Track</dt>
                      <dd className="text-xl font-semibold text-success">{onTrackCount}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Off Track</dt>
                      <dd className="text-xl font-semibold text-destructive">{offTrackCount}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Indicators</dt>
                      <dd className="text-xl font-semibold">{rows.length}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">With target</dt>
                      <dd className="text-xl font-semibold">{withTargetCount}</dd>
                    </div>
                  </dl>
                </div>
              </Panel>
            </div>
          </div>
        )}

        <div data-pdf-section>
          <Panel
            title={`YTD vs target · ${year}`}
            description="Comparison of scorecard YTD values against targets for every indicator"
          >
            <ChartFrame height={Math.max(300, 80 + comparison.length * 28)}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison} barGap={6} margin={{ bottom: 24 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis
                    dataKey="shortName"
                    {...chartAxis}
                    interval={0}
                    height={56}
                    angle={-20}
                    textAnchor="end"
                    tickFormatter={(value: string, index: number) =>
                      comparison[index]?.shortName || value
                    }
                  />
                  <YAxis {...chartAxis} width={40} />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    {...chartTooltip}
                    formatter={(value: number, key: string) => [
                      value,
                      key === "ytd" ? "YTD" : "Target",
                    ]}
                    labelFormatter={(_label, payload) => {
                      const item = payload?.[0]?.payload as { name?: string } | undefined;
                      return item?.name || "";
                    }}
                  />
                  <Bar
                    dataKey="ytd"
                    name="YTD"
                    fill="var(--color-chart-1)"
                    fillOpacity={1}
                    radius={[6, 6, 0, 0]}
                    minPointSize={3}
                  />
                  <Bar
                    dataKey="target"
                    name="Target"
                    fill="var(--color-chart-2)"
                    fillOpacity={1}
                    radius={[6, 6, 0, 0]}
                    minPointSize={3}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
          </Panel>
        </div>
      </div>
    </div>
  );
}


/** @deprecated Use KpiDisciplineWorkspace */
export function OhsStatisticsTable() {
  return (
    <KpiDisciplineWorkspace
      slug="health-safety"
      label="Occupational Health & Safety"
      shortLabel="OHS"
    />
  );
}
