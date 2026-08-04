import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame, Panel } from "@/components/sheq/primitives";
import { StatCard } from "@/components/sheq/stat-card";
import {
  computeSheqComplianceForKind,
  type SheqComplianceSummary,
} from "@/components/sheq/document-forms/sheq-service-forms";
import type { SheqFormRecord } from "@/data/sheq";
import { ClipboardList, Percent, ShieldAlert, FileCheck2 } from "lucide-react";

const SCORED = new Set(["sheq-service-report", "sheq-installation-report"]);

type FormScore = {
  id: string;
  title: string;
  kind: string;
  raised: string;
  summary: SheqComplianceSummary;
};

function shortTitle(title: string, max = 18) {
  if (title.length <= max) return title;
  return `${title.slice(0, max - 1)}…`;
}

export function SheqFormsOverallDashboard({
  forms,
}: {
  forms: SheqFormRecord[];
}) {
  const scored = useMemo(() => {
    const rows: FormScore[] = [];
    for (const f of forms) {
      if (!f.kind || !SCORED.has(f.kind) || !f.formData) continue;
      const summary = computeSheqComplianceForKind(f.kind, f.formData);
      if (!summary || summary.max <= 0) continue;
      rows.push({
        id: f.id,
        title: f.title || f.id,
        kind: f.kind,
        raised: f.raised,
        summary,
      });
    }
    return rows;
  }, [forms]);

  const avg =
    scored.length > 0
      ? Math.round(
          scored.reduce((acc, r) => acc + r.summary.percent, 0) / scored.length,
        )
      : 0;
  const totalNc = scored.reduce((acc, r) => acc + r.summary.ncCount, 0);
  const serviceCount = scored.filter((r) => r.kind === "sheq-service-report").length;
  const installCount = scored.filter(
    (r) => r.kind === "sheq-installation-report",
  ).length;

  const chartData = scored.slice(0, 12).map((r) => ({
    name: shortTitle(r.title),
    compliance: r.summary.percent,
    ncs: r.summary.ncCount,
  }));

  const sectionAvg = useMemo(() => {
    const map = new Map<string, { total: number; count: number; title: string }>();
    for (const row of scored) {
      for (const section of row.summary.sections) {
        if (section.max <= 0) continue;
        const cur = map.get(section.code) || {
          total: 0,
          count: 0,
          title: section.title,
        };
        cur.total += section.percent;
        cur.count += 1;
        map.set(section.code, cur);
      }
    }
    return Array.from(map.entries())
      .map(([code, v]) => ({
        code,
        title: v.title,
        percent: Math.round(v.total / v.count),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [scored]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Overall form compliance"
          value={scored.length ? `${avg}%` : "—"}
          icon={Percent}
          tone={avg >= 85 ? "success" : avg >= 60 ? "warning" : undefined}
          hint={
            scored.length
              ? `Average of ${scored.length} scored report${scored.length === 1 ? "" : "s"}`
              : "Submit a service or installation report"
          }
        />
        <StatCard
          label="Scored reports"
          value={scored.length}
          icon={FileCheck2}
          hint={`${serviceCount} service · ${installCount} installation`}
        />
        <StatCard
          label="Nonconformances"
          value={totalNc}
          icon={ShieldAlert}
          tone={totalNc > 0 ? "danger" : "success"}
          hint="From score = 1 items"
        />
        <StatCard
          label="All saved forms"
          value={forms.length}
          icon={ClipboardList}
          hint="Including all form types"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Report compliance"
          description="Compliance % for recent SHEQ service and installation reports"
        >
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No scored SHEQ service or installation reports yet.
            </p>
          ) : (
            <ChartFrame height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: 4, right: 8, bottom: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-card)",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="compliance"
                    name="Compliance %"
                    fill="var(--color-chart-1)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
          )}
        </Panel>

        <Panel
          title="Average by section"
          description="Across all scored service & installation reports"
        >
          {sectionAvg.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Section averages appear after scored reports are submitted.
            </p>
          ) : (
            <div className="flex max-h-[280px] flex-col gap-3 overflow-y-auto pr-1">
              {sectionAvg.map((s) => (
                <div key={s.code}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium">{s.title}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.percent}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${s.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
