import { useMemo, useRef, useState } from "react";
import {
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
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  Percent,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentTemplateDownloadMenu } from "@/components/sheq/document-template-download";
import { ChartFrame, EmptyState, Panel } from "@/components/sheq/primitives";
import { SheqFormsOverallDashboard } from "@/components/sheq/sheq-forms-overall-dashboard";
import { StatCard } from "@/components/sheq/stat-card";
import { StatusPill } from "@/components/sheq/status-pill";
import { computeSheqComplianceForKind } from "@/components/sheq/document-forms/sheq-service-forms";
import type { NonConformance, SheqFormRecord, User } from "@/data/sheq";
import { downloadElementAsPdf, safeDownloadBasename } from "@/lib/filled-form-export";
import { useSheq } from "@/lib/sheq-context";
import { toast } from "sonner";

const SCORED = new Set(["sheq-service-report", "sheq-installation-report"]);

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

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function normName(value: string | undefined | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function ncStatus(n: NonConformance) {
  return n.status || n.stage;
}

function formBelongsToUser(form: SheqFormRecord, user: User) {
  if (form.createdById && form.createdById === user.id) return true;
  const userName = normName(user.name);
  if (!userName) return false;
  if (form.createdByName && normName(form.createdByName) === userName) return true;
  if (!form.createdById) {
    const contact = normName(form.formData?.siteContact);
    const briefed = normName(form.formData?.briefedBy);
    if (contact === userName || briefed === userName) return true;
  }
  return false;
}

function monthKey(dateStr: string) {
  const raw = String(dateStr || "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = Number(m) - 1;
  if (!y || Number.isNaN(idx) || idx < 0 || idx > 11) return key;
  return `${months[idx]} ${y.slice(2)}`;
}

type Props = {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UserDetailsDialog({ user, open, onOpenChange }: Props) {
  const { sheqForms, nonConformances, concerns, templates } = useSheq();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [exportingDashboard, setExportingDashboard] = useState(false);

  const userForms = useMemo(() => {
    if (!user) return [];
    return sheqForms
      .filter((f) => formBelongsToUser(f, user))
      .sort((a, b) => b.raised.localeCompare(a.raised) || b.id.localeCompare(a.id));
  }, [sheqForms, user]);

  const raisedNcs = useMemo(() => {
    if (!user) return [];
    return nonConformances.filter((n) => n.reporterId === user.id);
  }, [nonConformances, user]);

  const assignedNcs = useMemo(() => {
    if (!user) return [];
    return nonConformances.filter((n) => n.responsiblePersonId === user.id);
  }, [nonConformances, user]);

  const userConcerns = useMemo(() => {
    if (!user) return [];
    const name = normName(user.name);
    return concerns.filter(
      (c) => !c.anonymous && normName(c.reporter) === name,
    );
  }, [concerns, user]);

  const stats = useMemo(() => {
    const formsSubmitted = userForms.filter((f) => f.status !== "Draft").length;
    const formsDraft = userForms.filter((f) => f.status === "Draft").length;
    const formsClosed = userForms.filter((f) => f.status === "Closed").length;
    const ncsRaised = raisedNcs.length;
    const ncsClosed = raisedNcs.filter((n) => ncStatus(n) === "Closed").length;
    const ncsOpen = ncsRaised - ncsClosed;
    const ncsAssigned = assignedNcs.length;
    const ncsAssignedClosed = assignedNcs.filter(
      (n) => ncStatus(n) === "Closed",
    ).length;
    const concernsRaised = userConcerns.length;
    const concernsClosed = userConcerns.filter((c) => c.status === "Closed").length;

    let complianceTotal = 0;
    let complianceCount = 0;
    let formFindings = 0;
    for (const f of userForms) {
      if (!f.kind || !SCORED.has(f.kind) || !f.formData) continue;
      const summary = computeSheqComplianceForKind(f.kind, f.formData);
      if (!summary || summary.max <= 0) continue;
      complianceTotal += summary.percent;
      formFindings += summary.ncCount;
      complianceCount += 1;
    }

    return {
      formsTotal: userForms.length,
      formsSubmitted,
      formsDraft,
      formsClosed,
      ncsRaised,
      ncsClosed,
      ncsOpen,
      ncsAssigned,
      ncsAssignedClosed,
      concernsRaised,
      concernsClosed,
      formComplianceAvg: complianceCount
        ? Math.round(complianceTotal / complianceCount)
        : 0,
      formComplianceCount: complianceCount,
      formFindings,
    };
  }, [userForms, raisedNcs, assignedNcs, userConcerns]);

  const workSummaryChart = useMemo(
    () => [
      { name: "Forms", value: stats.formsTotal, fill: "var(--color-chart-1)" },
      { name: "NCs raised", value: stats.ncsRaised, fill: "var(--color-chart-5)" },
      { name: "NCs closed", value: stats.ncsClosed, fill: "var(--color-chart-3)" },
      { name: "Assigned", value: stats.ncsAssigned, fill: "var(--color-chart-2)" },
      { name: "Concerns", value: stats.concernsRaised, fill: "var(--color-chart-4)" },
    ],
    [stats],
  );

  const ncStatusChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of raisedNcs) {
      const s = ncStatus(n);
      map.set(s, (map.get(s) || 0) + 1);
    }
    if (map.size === 0) {
      return [
        { name: "Open", value: 0 },
        { name: "Closed", value: 0 },
      ];
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [raisedNcs]);

  const formStatusChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of userForms) {
      map.set(f.status, (map.get(f.status) || 0) + 1);
    }
    if (map.size === 0) {
      return [
        { name: "Draft", value: 0 },
        { name: "Submitted", value: 0 },
        { name: "Closed", value: 0 },
      ];
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [userForms]);

  const monthlyTrend = useMemo(() => {
    const keys = new Set<string>();
    for (const f of userForms) keys.add(monthKey(f.raised));
    for (const n of raisedNcs) keys.add(monthKey(n.raised));
    for (const c of userConcerns) keys.add(monthKey(c.raised));

    // Always show last 6 calendar months so the chart has a stable axis.
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.add(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
    }

    return Array.from(keys)
      .sort()
      .slice(-8)
      .map((key) => ({
        month: monthLabel(key),
        forms: userForms.filter((f) => monthKey(f.raised) === key).length,
        ncs: raisedNcs.filter((n) => monthKey(n.raised) === key).length,
        concerns: userConcerns.filter((c) => monthKey(c.raised) === key).length,
      }));
  }, [userForms, raisedNcs, userConcerns]);

  const hasChartData =
    stats.formsTotal + stats.ncsRaised + stats.ncsAssigned + stats.concernsRaised > 0;

  async function downloadDashboard() {
    if (!user || !dashboardRef.current) return;
    setExportingDashboard(true);
    try {
      const base = safeDownloadBasename(`${user.name}-work-dashboard`);
      await downloadElementAsPdf(dashboardRef.current, `${base}.pdf`);
      toast.success("User dashboard downloaded");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to download dashboard",
      );
    } finally {
      setExportingDashboard(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,72rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b px-6 py-5 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <UserRound className="size-5 shrink-0 text-muted-foreground" />
                <span className="truncate">{user?.name ?? "User details"}</span>
              </DialogTitle>
              <DialogDescription className="mt-1.5">
                {user
                  ? `${user.email} · ${user.role} · ${user.company || "No company"} · ${user.site || "No site"}`
                  : "Review forms, nonconformances and overall work for this user."}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl pdf-hide"
              disabled={!user || exportingDashboard}
              onClick={downloadDashboard}
            >
              {exportingDashboard ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download dashboard
            </Button>
          </div>
        </DialogHeader>

        {!user ? null : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div ref={dashboardRef} className="space-y-6 bg-background p-1">
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-foreground">
                    Work dashboard
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Overall activity and charts for {user.name}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="Forms filled"
                    value={stats.formsTotal}
                    hint={`${stats.formsSubmitted} submitted · ${stats.formsDraft} draft`}
                    icon={FileText}
                  />
                  <StatCard
                    label="NCs raised"
                    value={stats.ncsRaised}
                    hint={`${stats.ncsOpen} open · ${stats.ncsClosed} closed`}
                    icon={ClipboardList}
                    tone={stats.ncsOpen > 0 ? "warning" : "default"}
                  />
                  <StatCard
                    label="NCs completed"
                    value={stats.ncsClosed}
                    hint="Closed from NCs this user raised"
                    icon={CheckCircle2}
                    tone="success"
                  />
                  <StatCard
                    label="Form compliance"
                    value={
                      stats.formComplianceCount ? `${stats.formComplianceAvg}%` : "—"
                    }
                    hint={
                      stats.formComplianceCount
                        ? `${stats.formComplianceCount} scored · ${stats.formFindings} findings`
                        : "From service & installation reports"
                    }
                    icon={Percent}
                    tone={
                      stats.formComplianceAvg >= 85
                        ? "success"
                        : stats.formComplianceCount
                          ? "warning"
                          : "default"
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="Assigned NCs"
                    value={stats.ncsAssigned}
                    hint={`${stats.ncsAssignedClosed} closed as responsible person`}
                    icon={UserRound}
                  />
                  <StatCard
                    label="Forms closed"
                    value={stats.formsClosed}
                    hint="Forms marked Closed"
                    icon={FileText}
                  />
                  <StatCard
                    label="Concerns raised"
                    value={stats.concernsRaised}
                    hint={`${stats.concernsClosed} closed`}
                    icon={ClipboardList}
                  />
                  <StatCard
                    label="Status"
                    value={user.status}
                    hint={`Last active ${user.lastActive || "—"}`}
                    tone={
                      user.status === "Active"
                        ? "success"
                        : user.status === "Suspended"
                          ? "danger"
                          : "warning"
                    }
                  />
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-foreground">
                    Activity graphs
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Visual breakdown of this user’s SHEQ work
                  </p>
                </div>

                {!hasChartData ? (
                  <Panel title="No chart data yet">
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Graphs will appear once this user fills forms, raises
                      nonconformances, or reports concerns.
                    </p>
                  </Panel>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-3">
                      <Panel
                        className="lg:col-span-2"
                        title="Work summary"
                        description="Forms, NCs and concerns at a glance"
                      >
                        <ChartFrame height={260}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={workSummaryChart}
                              margin={{ left: 4, right: 8, top: 8, bottom: 4 }}
                            >
                              <CartesianGrid
                                vertical={false}
                                stroke="var(--color-border)"
                              />
                              <XAxis dataKey="name" {...axis} />
                              <YAxis
                                {...axis}
                                width={28}
                                allowDecimals={false}
                              />
                              <Tooltip {...tooltipStyle} />
                              <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
                                {workSummaryChart.map((entry) => (
                                  <Cell key={entry.name} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartFrame>
                      </Panel>

                      <Panel
                        title="NC status split"
                        description="Nonconformances raised by this user"
                      >
                        {raisedNcs.length === 0 ? (
                          <p className="py-10 text-center text-sm text-muted-foreground">
                            No NCs raised yet
                          </p>
                        ) : (
                          <ChartFrame height={260}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={ncStatusChart}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={52}
                                  outerRadius={82}
                                  paddingAngle={3}
                                >
                                  {ncStatusChart.map((_, i) => (
                                    <Cell
                                      key={i}
                                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                                      stroke="none"
                                    />
                                  ))}
                                </Pie>
                                <Tooltip {...tooltipStyle} />
                                <Legend
                                  iconType="circle"
                                  wrapperStyle={{ fontSize: 11 }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </ChartFrame>
                        )}
                      </Panel>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <Panel
                        className="lg:col-span-2"
                        title="Monthly activity"
                        description="Forms, NCs and concerns over recent months"
                      >
                        <ChartFrame height={260}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={monthlyTrend}
                              margin={{ left: 4, right: 8, top: 8, bottom: 4 }}
                            >
                              <CartesianGrid
                                vertical={false}
                                stroke="var(--color-border)"
                              />
                              <XAxis dataKey="month" {...axis} />
                              <YAxis
                                {...axis}
                                width={28}
                                allowDecimals={false}
                              />
                              <Tooltip {...tooltipStyle} />
                              <Legend
                                iconType="circle"
                                wrapperStyle={{ fontSize: 12 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="forms"
                                name="Forms"
                                stroke="var(--color-chart-1)"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="ncs"
                                name="NCs"
                                stroke="var(--color-chart-5)"
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

                      <Panel
                        title="Form status"
                        description="Draft / submitted / closed"
                      >
                        {userForms.length === 0 ? (
                          <p className="py-10 text-center text-sm text-muted-foreground">
                            No forms yet
                          </p>
                        ) : (
                          <ChartFrame height={260}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={formStatusChart}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={52}
                                  outerRadius={82}
                                  paddingAngle={3}
                                >
                                  {formStatusChart.map((_, i) => (
                                    <Cell
                                      key={i}
                                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                                      stroke="none"
                                    />
                                  ))}
                                </Pie>
                                <Tooltip {...tooltipStyle} />
                                <Legend
                                  iconType="circle"
                                  wrapperStyle={{ fontSize: 11 }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </ChartFrame>
                        )}
                      </Panel>
                    </div>
                  </>
                )}
              </section>

              {userForms.length > 0 ? (
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold tracking-wide text-foreground">
                      Forms compliance
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Scores from this user’s SHEQ service and installation reports
                    </p>
                  </div>
                  <SheqFormsOverallDashboard forms={userForms} />
                </section>
              ) : null}

              <Panel title="Profile" description="Account and access details">
                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Name
                    </dt>
                    <dd className="mt-1 font-medium">{user.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Email
                    </dt>
                    <dd className="mt-1 break-all font-medium">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Mobile
                    </dt>
                    <dd className="mt-1 font-medium">{user.mobile || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Role
                    </dt>
                    <dd className="mt-1 font-medium">{user.role}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Company
                    </dt>
                    <dd className="mt-1 font-medium">{user.company || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Site / Department
                    </dt>
                    <dd className="mt-1 font-medium">
                      {user.site || "—"}
                      {user.department ? ` · ${user.department}` : ""}
                    </dd>
                  </div>
                </dl>
              </Panel>

              <Panel
                title="Nonconformances raised"
                description={`${raisedNcs.length} raised by this user`}
              >
                {raisedNcs.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardList className="size-5" />}
                    title="No nonconformances raised"
                    description="This user has not raised any nonconformances yet."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Raised</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {raisedNcs.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium">{n.id}</TableCell>
                          <TableCell>{n.title}</TableCell>
                          <TableCell>{n.site}</TableCell>
                          <TableCell>
                            <StatusPill value={ncStatus(n)} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {n.raised}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Panel>

              <Panel
                title="Forms submitted"
                description={`${userForms.length} form${userForms.length === 1 ? "" : "s"} attributed to this user`}
                actions={
                  <span className="text-xs text-muted-foreground pdf-hide">
                    Download each form as PDF or Word
                  </span>
                }
              >
                {userForms.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="size-5" />}
                    title="No forms found"
                    description="Forms saved by this user will appear here. New submissions are linked automatically."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Raised</TableHead>
                        <TableHead className="text-right pdf-hide">
                          Download
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userForms.map((f) => {
                        const template =
                          templates.find((t) => t.id === f.templateId) ||
                          templates.find((t) => t.kind === f.kind);
                        return (
                          <TableRow key={f.id}>
                            <TableCell className="font-medium">{f.id}</TableCell>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {f.title || f.templateName || "SHEQ form"}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {f.templateName || f.kind || "—"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{f.site}</TableCell>
                            <TableCell>
                              <StatusPill value={f.status} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {f.raised}
                            </TableCell>
                            <TableCell className="text-right pdf-hide">
                              {template && f.formData ? (
                                <DocumentTemplateDownloadMenu
                                  template={template}
                                  formData={f.formData}
                                  title={f.title || template.name}
                                  size="sm"
                                  className="rounded-xl"
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Unavailable
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Panel>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
