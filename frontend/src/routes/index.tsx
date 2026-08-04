import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FilePenLine,
  FileStack,
  Globe2,
  MapPin,
  MessageSquareWarning,
  Percent,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Panel, ChartFrame } from "@/components/sheq/primitives";
import { SheqFormsOverallDashboard } from "@/components/sheq/sheq-forms-overall-dashboard";
import { StatCard } from "@/components/sheq/stat-card";
import { StatusPill } from "@/components/sheq/status-pill";
import type {
  Activity as ActivityItem,
  Concern,
  NonConformance,
  Overview,
  SheqFormRecord,
  SitePerformance,
} from "@/data/sheq";
import {
  getAuthUser,
  isCompanyAdmin,
  isSuperAdmin,
  sameCompany,
} from "@/lib/auth";
import {
  buildMonthlyComplianceTrend,
  buildMonthlyFormActivity,
  buildMonthlyNcConcernTrend,
  buildScopedOverview,
  buildWorkMixBars,
  computeFormCompliance,
  concernInCompany,
  filterActivitiesForCompany,
  filterActivitiesForUser,
  formBelongsToUser,
  formInCompany,
} from "@/lib/dashboard-scope";
import { useSheq } from "@/lib/sheq-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content:
          "Live executive dashboard for SHEQ management: audits, compliance, KPIs, non-conformances and site performance across every site.",
      },
      { property: "og:title", content: "Sitemate" },
      {
        property: "og:description",
        content:
          "Digitise audits, inspections, compliance, KPIs and non-conformances in one enterprise platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--color-border)",
    background: "var(--color-card)",
    color: "var(--color-card-foreground)",
    boxShadow: "var(--shadow-soft)",
    fontSize: 12,
  },
};

function ScoreRing({
  percent,
  label,
  size = 132,
  color = "var(--color-chart-1)",
}: {
  percent: number;
  label: string;
  size?: number;
  color?: string;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 100 100" width={size} height={size} className="drop-shadow-sm">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="48"
          textAnchor="middle"
          className="fill-foreground text-[18px] font-bold"
          style={{ fontSize: 18, fontWeight: 700 }}
        >
          {Math.round(percent)}%
        </text>
        <text
          x="50"
          y="64"
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 7, fontWeight: 600, letterSpacing: "0.06em" }}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

type ScopeMode = "all" | "company" | "personal";

function Dashboard() {
  const {
    overview,
    sitePerformance,
    activities,
    notifications,
    sheqForms = [],
    nonConformances = [],
    concerns = [],
    users = [],
    companies = [],
    sites = [],
  } = useSheq();

  const actor = getAuthUser();
  const isSuper = isSuperAdmin(actor);
  const isCompany = isCompanyAdmin(actor);

  const [companyAdminTab, setCompanyAdminTab] = useState<"company" | "personal">(
    "company",
  );
  const [superTab, setSuperTab] = useState<"all" | "company">("all");
  const [selectedCompany, setSelectedCompany] = useState("");

  const companyNames = useMemo(
    () =>
      [...new Set(companies.map((c) => c.name.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [companies],
  );

  useEffect(() => {
    if (!selectedCompany && companyNames[0]) {
      setSelectedCompany(companyNames[0]);
      return;
    }
    if (
      selectedCompany &&
      companyNames.length > 0 &&
      !companyNames.includes(selectedCompany)
    ) {
      setSelectedCompany(companyNames[0]);
    }
  }, [companyNames, selectedCompany]);

  const activeCompanyName = useMemo(() => {
    if (isSuper && superTab === "company") {
      return selectedCompany || companyNames[0] || "";
    }
    if (isCompany) return actor?.company?.trim() || "";
    return actor?.company?.trim() || "";
  }, [
    isSuper,
    superTab,
    selectedCompany,
    companyNames,
    isCompany,
    actor?.company,
  ]);

  const scopeMode: ScopeMode = useMemo(() => {
    if (isSuper) return superTab === "all" ? "all" : "company";
    if (isCompany) return companyAdminTab === "personal" ? "personal" : "company";
    return "personal";
  }, [isSuper, superTab, isCompany, companyAdminTab]);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const scoped = useMemo(() => {
    let scopedUsers = users;
    let scopedForms = sheqForms;
    let scopedNcs = nonConformances;
    let scopedConcerns = concerns;
    let scopedActivities = activities;
    let companyCount = companies.length;
    let siteCount = sites.length;

    if (scopeMode === "personal" && actor) {
      scopedForms = sheqForms.filter((f) => formBelongsToUser(f, actor));
      scopedNcs = nonConformances.filter((n) => n.reporterId === actor.id);
      scopedConcerns = concerns.filter(
        (c) =>
          !c.anonymous &&
          c.reporter.trim().toLowerCase() === actor.name.trim().toLowerCase(),
      );
      scopedUsers = [actor];
      scopedActivities = filterActivitiesForUser(activities, actor);
      companyCount = actor.company ? 1 : 0;
      siteCount = actor.site ? 1 : sites.length;
    } else if (scopeMode === "company" && activeCompanyName) {
      scopedUsers = users.filter((u) => sameCompany(u.company, activeCompanyName));
      scopedForms = sheqForms.filter((f) =>
        formInCompany(f, activeCompanyName, usersById),
      );
      scopedNcs = nonConformances.filter((n) =>
        sameCompany(n.company, activeCompanyName),
      );
      scopedConcerns = concerns.filter((c) =>
        concernInCompany(c, scopedUsers),
      );
      scopedActivities = filterActivitiesForCompany(activities, scopedUsers);
      companyCount = 1;
      siteCount = sites.length;
    }

    const formCompliance = computeFormCompliance(scopedForms);
    const scopedOverview = buildScopedOverview(overview, {
      companies: companyCount,
      users: scopedUsers,
      sites: siteCount,
      forms: scopedForms,
      nonConformances: scopedNcs,
      concerns: scopedConcerns,
      formAvg: formCompliance.avg,
    });

    return {
      forms: scopedForms,
      nonConformances: scopedNcs,
      concerns: scopedConcerns,
      activities: scopedActivities,
      overview: scopedOverview,
      formCompliance,
      users: scopedUsers,
    };
  }, [
    scopeMode,
    actor,
    activeCompanyName,
    users,
    sheqForms,
    nonConformances,
    concerns,
    activities,
    companies.length,
    sites.length,
    usersById,
    overview,
  ]);

  const scopeLabel =
    scopeMode === "all"
      ? "All companies"
      : scopeMode === "personal"
        ? "My overview"
        : activeCompanyName
          ? `${activeCompanyName} overview`
          : "Company overview";

  return (
    <>
      <PageHeader
        title="Executive Dashboard"
        description={
          scopeMode === "personal"
            ? "Your personal SHEQ work — forms, nonconformances and activity."
            : scopeMode === "all"
              ? "Organisation-wide safety, health, environment and quality across every company."
              : `Company-wide SHEQ performance for ${activeCompanyName || "your company"}.`
        }
        actions={
          <>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link to="/non-conformances">
                <AlertTriangle />
                Nonconformances
              </Link>
            </Button>
            <Button className="rounded-xl" asChild>
              <Link to="/sheq-forms">
                <FilePenLine />
                SHEQ Forms
              </Link>
            </Button>
          </>
        }
      />

      {isCompany ? (
        <Tabs
          value={companyAdminTab}
          onValueChange={(v) => setCompanyAdminTab(v as "company" | "personal")}
          className="mb-6"
        >
          <TabsList className="h-auto w-full justify-start gap-1 rounded-xl p-1 sm:w-auto">
            <TabsTrigger
              value="company"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"
            >
              <Building2 className="size-3.5" />
              Company overview
            </TabsTrigger>
            <TabsTrigger
              value="personal"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"
            >
              <UserRound className="size-3.5" />
              My overview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {isSuper ? (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={superTab}
            onValueChange={(v) => setSuperTab(v as "all" | "company")}
          >
            <TabsList className="h-auto w-full justify-start gap-1 rounded-xl p-1 sm:w-auto">
              <TabsTrigger
                value="all"
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"
              >
                <Globe2 className="size-3.5" />
                All companies
              </TabsTrigger>
              <TabsTrigger
                value="company"
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"
              >
                <Building2 className="size-3.5" />
                Company view
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {superTab === "company" ? (
            <div className="flex min-w-[220px] items-center gap-2">
              <Select
                value={selectedCompany || companyNames[0] || ""}
                onValueChange={setSelectedCompany}
              >
                <SelectTrigger className="h-10 rounded-xl bg-card">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companyNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isSuper && !isCompany ? (
        <div className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <UserRound className="size-3.5" />
          Showing your personal overview
        </div>
      ) : null}

      <DashboardBody
        scopeLabel={scopeLabel}
        scopeMode={scopeMode}
        overview={scoped.overview}
        formCompliance={scoped.formCompliance}
        sheqForms={scoped.forms}
        nonConformances={scoped.nonConformances}
        concerns={scoped.concerns}
        sitePerformance={sitePerformance}
        activities={scoped.activities}
        notifications={notifications}
      />
    </>
  );
}

function DashboardBody({
  scopeLabel,
  scopeMode,
  overview,
  formCompliance,
  sheqForms,
  nonConformances,
  concerns,
  sitePerformance,
  activities,
  notifications,
}: {
  scopeLabel: string;
  scopeMode: ScopeMode;
  overview: Overview;
  formCompliance: ReturnType<typeof computeFormCompliance>;
  sheqForms: SheqFormRecord[];
  nonConformances: NonConformance[];
  concerns: Concern[];
  sitePerformance: SitePerformance[];
  activities: ActivityItem[];
  notifications: {
    id?: string;
    title: string;
    detail: string;
    when: string;
    unread: boolean;
  }[];
}) {
  const ncStatusChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of nonConformances) {
      const s = n.status || n.stage;
      map.set(s, (map.get(s) || 0) + 1);
    }
    if (map.size === 0) {
      return [
        { name: "Open", value: overview.openNonConformances },
        { name: "Closed", value: overview.closedNonConformances },
      ];
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [nonConformances, overview.openNonConformances, overview.closedNonConformances]);

  const monthlyForms = useMemo(
    () => buildMonthlyFormActivity(sheqForms, 6),
    [sheqForms],
  );
  const monthlyNcConcerns = useMemo(
    () => buildMonthlyNcConcernTrend(nonConformances, concerns, 6),
    [nonConformances, concerns],
  );
  const monthlyCompliance = useMemo(
    () => buildMonthlyComplianceTrend(sheqForms, 6),
    [sheqForms],
  );
  const workMix = useMemo(
    () => buildWorkMixBars(sheqForms, nonConformances, concerns),
    [sheqForms, nonConformances, concerns],
  );

  const formsSubmitted = sheqForms.filter((f) => f.status !== "Draft").length;
  const ncTotal = nonConformances.length;
  const ncClosureRate =
    ncTotal > 0
      ? Math.round((overview.closedNonConformances / ncTotal) * 100)
      : 0;
  const openNcs = useMemo(
    () =>
      nonConformances
        .filter((n) => {
          const s = n.status || n.stage;
          return s !== "Closed" && s !== "Rejected";
        })
        .slice(0, 8),
    [nonConformances],
  );

  const rankedSites = useMemo(
    () => [...sitePerformance].sort((a, b) => b.score - a.score).slice(0, 8),
    [sitePerformance],
  );

  const pieColors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  const showOrgCharts = scopeMode !== "personal";

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, color-mix(in oklch, var(--brand-accent) 35%, transparent), transparent 55%), radial-gradient(90% 70% at 100% 20%, color-mix(in oklch, var(--brand-primary) 18%, transparent), transparent 50%), linear-gradient(135deg, color-mix(in oklch, var(--brand-primary) 8%, white), white 60%)",
          }}
        />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
              {scopeLabel}
            </p>
            <h2 className="mt-2 max-w-xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {scopeMode === "personal"
                ? "Your SHEQ work in one view"
                : "Your SHEQ position in one view"}
            </h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Live scores from filled reports, nonconformances, concerns and site
              compliance — updated as work is submitted.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Sites", value: overview.sites, icon: MapPin },
                { label: "Users", value: overview.users, icon: Users },
                { label: "Forms", value: formCompliance.totalForms, icon: ClipboardList },
                { label: "Templates", value: overview.templates, icon: FileStack },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border/70 bg-white/70 px-3 py-3 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <item.icon className="size-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-border/60 bg-white/75 px-6 py-5 backdrop-blur-sm lg:justify-end">
            <ScoreRing
              percent={overview.performanceScore}
              label="PERFORMANCE"
              color="var(--color-chart-1)"
            />
            <ScoreRing
              percent={overview.compliance}
              label="COMPLIANCE"
              color="var(--color-chart-3)"
            />
            <ScoreRing
              percent={
                formCompliance.scored
                  ? formCompliance.avg
                  : ncClosureRate
              }
              label={formCompliance.scored ? "FORM AVG" : "NC CLOSED"}
              color="var(--color-chart-2)"
            />
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Performance score"
          value={`${overview.performanceScore}%`}
          icon={ShieldCheck}
          tone="success"
          hint={scopeLabel}
        />
        <StatCard
          label="Compliance"
          value={`${overview.compliance}%`}
          icon={Activity}
          tone="success"
          hint={
            formCompliance.scored
              ? "From scored SHEQ reports"
              : "Rolling organisation score"
          }
        />
        <StatCard
          label="Open nonconformances"
          value={overview.openNonConformances}
          icon={AlertTriangle}
          tone={overview.openNonConformances > 0 ? "danger" : "success"}
          hint={`${overview.closedNonConformances} closed`}
        />
        <StatCard
          label="Form compliance"
          value={formCompliance.scored ? `${formCompliance.avg}%` : "—"}
          icon={Percent}
          tone={
            formCompliance.avg >= 85
              ? "success"
              : formCompliance.scored
                ? "warning"
                : "default"
          }
          hint={
            formCompliance.scored
              ? `${formCompliance.scored} scored reports · ${formCompliance.findings} NC findings`
              : "From service & installation reports"
          }
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Companies"
          value={overview.companies}
          icon={Building2}
          hint={scopeMode === "all" ? "Multi-tenant" : "In this view"}
        />
        <StatCard
          label="Forms submitted"
          value={formsSubmitted}
          icon={CheckCircle2}
          tone="success"
          hint={`${formCompliance.totalForms} total saved`}
        />
        <StatCard
          label="Open concerns"
          value={overview.openConcerns}
          icon={MessageSquareWarning}
          tone="warning"
          hint={`${overview.closedConcerns} closed`}
        />
        <StatCard
          label="Active users"
          value={overview.activeUsers}
          icon={Users}
          hint={`${overview.users} total`}
        />
      </div>

      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Forms overall dashboard
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Compliance from submitted SHEQ service and installation reports
              {scopeMode === "personal" ? " you filled" : ""}.
            </p>
          </div>
          <Button variant="outline" className="rounded-xl" asChild>
            <Link to="/sheq-forms">
              <ClipboardCheck />
              View SHEQ forms
            </Link>
          </Button>
        </div>
        <SheqFormsOverallDashboard forms={sheqForms} />
      </div>

      {showOrgCharts ? (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Monthly form activity"
              description="Submitted vs closed forms from live SHEQ data"
            >
              <ChartFrame height={280}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyForms} barGap={6}>
                    <CartesianGrid vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="month" {...axis} />
                    <YAxis {...axis} width={32} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "var(--color-muted)" }} {...tooltipStyle} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="submitted"
                      name="Submitted"
                      fill="var(--color-chart-2)"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="closed"
                      name="Closed"
                      fill="var(--color-chart-1)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </Panel>

            <Panel title="Work mix" description="Live share of forms and closure rates">
              <div className="flex max-h-[280px] flex-col gap-4 overflow-y-auto pr-1">
                {workMix.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{item.label}</span>
                      <span className="tabular-nums font-semibold text-foreground">
                        {item.label.includes("rate")
                          ? `${item.percent}%`
                          : item.value}
                      </span>
                    </div>
                    <Progress value={item.percent} className="mt-2 h-2" />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {item.hint}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Panel
              title="Form compliance trends"
              description="Average compliance and NC findings from scored reports"
            >
              <ChartFrame height={280}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyCompliance}>
                    <defs>
                      <linearGradient id="g-compliance" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--color-chart-1)"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--color-chart-1)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="g-findings" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--color-chart-5)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--color-chart-5)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="month" {...axis} />
                    <YAxis {...axis} width={32} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="compliance"
                      name="Compliance %"
                      stroke="var(--color-chart-1)"
                      fill="url(#g-compliance)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="findings"
                      name="NC findings"
                      stroke="var(--color-chart-5)"
                      fill="url(#g-findings)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFrame>
            </Panel>

            <Panel
              title="Nonconformance & concern trends"
              description="Live raised vs closed activity over six months"
            >
              <ChartFrame height={280}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyNcConcerns}>
                    <CartesianGrid vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="month" {...axis} />
                    <YAxis {...axis} width={32} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="raised"
                      name="NCs raised"
                      stroke="var(--color-chart-5)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="closed"
                      name="NCs closed"
                      stroke="var(--color-chart-3)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="concerns"
                      name="Concerns"
                      stroke="var(--color-chart-4)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartFrame>
            </Panel>
          </div>
        </>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {showOrgCharts ? (
          <Panel title="Site performance" description="Top sites by compliance">
            <ChartFrame height={260}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankedSites} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                  <XAxis type="number" domain={[0, 100]} {...axis} />
                  <YAxis type="category" dataKey="name" width={78} {...axis} />
                  <Tooltip cursor={{ fill: "var(--color-muted)" }} {...tooltipStyle} />
                  <Bar
                    dataKey="score"
                    name="Compliance %"
                    fill="var(--color-chart-1)"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
          </Panel>
        ) : (
          <Panel
            title="My nonconformances"
            description={`${nonConformances.length} raised by you`}
          >
            <ul className="flex max-h-[260px] flex-col gap-3 overflow-y-auto pr-1">
              {nonConformances.length === 0 ? (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  No nonconformances raised yet
                </li>
              ) : (
                nonConformances.slice(0, 8).map((n) => (
                  <li
                    key={n.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {n.id} · {n.site}
                      </p>
                    </div>
                    <StatusPill value={n.status || n.stage} />
                  </li>
                ))
              )}
            </ul>
          </Panel>
        )}

        <Panel title="NC status split" description="Live nonconformance workflow">
          <ChartFrame height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ncStatusChart}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                >
                  {ncStatusChart.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Panel>

        <Panel
          title="Open nonconformances"
          description="Items that still need attention"
        >
          <ul className="flex max-h-[260px] flex-col gap-3 overflow-y-auto pr-1">
            {openNcs.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">
                No open nonconformances
              </li>
            ) : (
              openNcs.map((n) => (
                <li
                  key={n.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {n.id} · {n.site} · {n.raised}
                    </p>
                  </div>
                  <StatusPill value={n.status || n.stage} />
                </li>
              ))
            )}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Recent activity"
          description={
            scopeMode === "personal"
              ? "Your latest actions"
              : "Latest actions in this view"
          }
        >
          <ol className="flex flex-col gap-4">
            {activities.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">
                No recent activity
              </li>
            ) : (
              activities.slice(0, 8).map((a, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{a.who}</span>{" "}
                      <span className="text-muted-foreground">{a.what}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{a.when}</p>
                  </div>
                </li>
              ))
            )}
          </ol>
        </Panel>

        <Panel title="Notifications" description="Approvals, assignments and closures">
          <ul className="flex flex-col gap-3">
            {notifications.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </li>
            ) : (
              notifications.slice(0, 8).map((n, i) => (
                <li
                  key={n.id || i}
                  className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border border-border p-3",
                    n.unread && "border-primary/20 bg-primary/[0.03]",
                  )}
                >
                  <span
                    className={
                      n.unread
                        ? "mt-1.5 size-2 rounded-full bg-destructive"
                        : "mt-1.5 size-2 rounded-full bg-muted-foreground/40"
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {n.detail} · {n.when}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
          {overview.openNonConformances > 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm">
              <ShieldAlert className="size-4 text-destructive" />
              <span>
                {overview.openNonConformances} open NC
                {overview.openNonConformances === 1 ? "" : "s"} need attention
              </span>
              <Button size="sm" variant="outline" className="ml-auto rounded-xl" asChild>
                <Link to="/non-conformances">Review</Link>
              </Button>
            </div>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
