import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NcDetailDialog } from "@/components/sheq/nc-detail-dialog";
import { RaiseNcDialog } from "@/components/sheq/raise-nc-dialog";
import { PageHeader, Panel, ChartFrame, EmptyState } from "@/components/sheq/primitives";
import { StatCard } from "@/components/sheq/stat-card";
import { StatusPill } from "@/components/sheq/status-pill";
import type { NonConformance } from "@/data/sheq";
import { getAuthUser, isCompanyAdmin, isSuperAdmin } from "@/lib/auth";
import { useSheq } from "@/lib/sheq-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/non-conformances")({
  validateSearch: (search: Record<string, unknown>) => ({
    nc: typeof search["nc"] === "string" ? (search["nc"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content:
          "Raise, approve, assign and close nonconformances with corrective responses, evidence and timeline.",
      },
      { property: "og:title", content: "Sitemate" },
      {
        property: "og:description",
        content: "End-to-end NC workflow from raise to verified closure.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NcPage,
});

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

function statusOf(n: NonConformance) {
  return n.status || n.stage;
}

function NcPage() {
  const { nonConformances, ncStages, ncWorkflow, ncByDepartment, templates, users } =
    useSheq();
  const search = useSearch({ from: "/non-conformances" });
  const queryClient = useQueryClient();
  const actor = getAuthUser();
  const isAdmin = isCompanyAdmin(actor) || isSuperAdmin(actor);

  const [stage, setStage] = useState<string>("All");
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [editing, setEditing] = useState<NonConformance | null>(null);
  const [viewing, setViewing] = useState<NonConformance | null>(null);

  useEffect(() => {
    if (!search.nc) return;
    const match = nonConformances.find((n) => n.id === search.nc);
    if (match) setViewing(match);
  }, [search.nc, nonConformances]);

  const stages = useMemo(() => {
    const fromData = Array.from(new Set(nonConformances.map(statusOf)));
    return ["All", ...(ncStages?.length ? ncStages : fromData)];
  }, [nonConformances, ncStages]);

  const rows = useMemo(
    () =>
      nonConformances.filter((n) => stage === "All" || statusOf(n) === stage),
    [nonConformances, stage],
  );

  const pendingApproval = nonConformances.filter(
    (n) => statusOf(n) === "Pending Admin Approval",
  );
  const pendingReview = nonConformances.filter(
    (n) => statusOf(n) === "Pending Admin Review",
  );
  const assignedToMe = nonConformances.filter(
    (n) => n.responsiblePersonId === actor?.id,
  );
  const raisedByMe = nonConformances.filter((n) => n.reporterId === actor?.id);

  const cards = isAdmin
    ? [
        {
          label: "Pending approval",
          value: pendingApproval.length,
          icon: Clock,
          tone: "warning" as const,
        },
        {
          label: "Pending review",
          value: pendingReview.length,
          icon: RefreshCw,
          tone: "warning" as const,
        },
        {
          label: "Assigned / open",
          value: nonConformances.filter((n) =>
            ["Assigned", "Draft", "In Progress", "Reopened"].includes(statusOf(n)),
          ).length,
          icon: AlertTriangle,
        },
        {
          label: "Closed",
          value: nonConformances.filter((n) => statusOf(n) === "Closed").length,
          icon: CheckCircle2,
          tone: "success" as const,
        },
      ]
    : [
        {
          label: "Raised by me",
          value: raisedByMe.length,
          icon: FileWarning,
        },
        {
          label: "Assigned to me",
          value: assignedToMe.length,
          icon: AlertTriangle,
          tone: "warning" as const,
        },
        {
          label: "Pending approval",
          value: raisedByMe.filter((n) => statusOf(n) === "Pending Admin Approval")
            .length,
          icon: Clock,
        },
        {
          label: "Closed",
          value: nonConformances.filter((n) => statusOf(n) === "Closed").length,
          icon: CheckCircle2,
          tone: "success" as const,
        },
      ];

  const statusChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of nonConformances) {
      const s = statusOf(n);
      map.set(s, (map.get(s) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [nonConformances]);

  const priorityChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of nonConformances) {
      const p = n.priority || n.severity || "Medium";
      map.set(p, (map.get(p) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [nonConformances]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["sheq"] });
  }

  return (
    <>
      <PageHeader
        title="Non-Conformance Management"
        description="Raise with a concern template, admin approval, assignment, corrective response and closure."
        actions={
          <Button
            className="rounded-xl"
            onClick={() => {
              setEditing(null);
              setRaiseOpen(true);
            }}
          >
            <Plus /> Raise NC
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            {...(c.tone ? { tone: c.tone } : {})}
          />
        ))}
      </div>

      <Panel className="mt-6" title="Workflow" description="NC lifecycle">
        <ol className="flex flex-wrap gap-2">
          {(ncWorkflow?.length
            ? ncWorkflow
            : [
                "Raise Nonconformance",
                "Pending Admin Approval",
                "Assigned",
                "Response",
                "Pending Admin Review",
                "Closed",
              ]
          ).map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium">
                {i + 1}. {step}
              </span>
              {i < (ncWorkflow?.length ?? 6) - 1 ? (
                <span className="text-muted-foreground">→</span>
              ) : null}
            </li>
          ))}
        </ol>
      </Panel>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Status distribution" description="Current NC statuses">
          <ChartFrame height={240}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusChart} dataKey="value" nameKey="name" outerRadius={90} label>
                  {statusChart.map((_, i) => (
                    <Cell key={i} fill={`var(--color-chart-${(i % 5) + 1})`} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Panel>
        <Panel title="Priority distribution" description="NC by priority">
          <ChartFrame height={240}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityChart}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} width={28} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Count" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Panel>
      </div>

      {ncByDepartment?.length ? (
        <Panel className="mt-6" title="Department-wise NC" description="Open vs closed">
          <ChartFrame height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ncByDepartment} barGap={6}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="department" {...axis} />
                <YAxis {...axis} width={28} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="open" name="Open" fill="var(--color-chart-5)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="closed" name="Closed" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Panel>
      ) : null}

      {isAdmin && pendingApproval.length > 0 ? (
        <Panel
          className="mt-6"
          title="Pending admin approval"
          description="Approve to assign, or reject with a reason"
        >
          <NcTable
            rows={pendingApproval}
            onOpen={setViewing}
          />
        </Panel>
      ) : null}

      {isAdmin && pendingReview.length > 0 ? (
        <Panel
          className="mt-6"
          title="Pending response review"
          description="Approve to close, or reopen with comments"
        >
          <NcTable rows={pendingReview} onOpen={setViewing} />
        </Panel>
      ) : null}

      {!isAdmin && assignedToMe.length > 0 ? (
        <Panel
          className="mt-6"
          title="Assigned nonconformances"
          description="Respond to findings assigned to you"
        >
          <NcTable rows={assignedToMe} onOpen={setViewing} />
        </Panel>
      ) : null}

      <Panel
        className="mt-6"
        title="NC register"
        description="All nonconformances visible to you"
        actions={
          <div className="flex flex-wrap gap-2">
            {stages.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  stage === s
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileWarning />}
            title="No nonconformances yet"
            description="Raise an NC using a concern template. It will wait for Company Admin approval before assignment."
            action={
              <Button
                className="rounded-xl"
                onClick={() => {
                  setEditing(null);
                  setRaiseOpen(true);
                }}
              >
                <Plus /> Raise NC
              </Button>
            }
          />
        ) : (
          <NcTable rows={rows} onOpen={setViewing} />
        )}
      </Panel>

      <RaiseNcDialog
        open={raiseOpen}
        onOpenChange={setRaiseOpen}
        templates={templates}
        users={users}
        actor={actor}
        editing={editing}
        onSaved={async (nc) => {
          await refresh();
          setViewing(nc);
        }}
      />

      <NcDetailDialog
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        nc={viewing}
        actor={actor}
        onChanged={async (nc) => {
          setViewing(nc);
          await refresh();
        }}
        onEditRejected={(nc) => {
          setEditing(nc);
          setRaiseOpen(true);
        }}
      />
    </>
  );
}

function NcTable({
  rows,
  onOpen,
}: {
  rows: NonConformance[];
  onOpen: (nc: NonConformance) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Responsible</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((n) => (
            <TableRow key={n.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {n.id}
              </TableCell>
              <TableCell className="max-w-[220px] truncate font-medium">
                {n.title}
              </TableCell>
              <TableCell className="text-muted-foreground">{n.site}</TableCell>
              <TableCell>
                {n.responsiblePersonName || n.owner || "—"}
              </TableCell>
              <TableCell>
                <StatusPill value={n.priority || n.severity} />
              </TableCell>
              <TableCell>
                <StatusPill value={statusOf(n)} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {n.dueDate || n.due || "—"}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => onOpen(n)}
                >
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
