import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Download,
  EyeOff,
  MessageSquareWarning,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NewConcernDialog } from "@/components/sheq/new-concern-dialog";
import { renderDocumentTemplate } from "@/components/sheq/document-forms";
import { PageHeader, Panel, EmptyState } from "@/components/sheq/primitives";
import { StatCard } from "@/components/sheq/stat-card";
import { StatusPill } from "@/components/sheq/status-pill";
import type { Concern } from "@/data/sheq";
import { ApiError, concernDownloadUrl, deleteConcern } from "@/lib/api";
import { useSheq } from "@/lib/sheq-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/concerns")({
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content:
          "Report near misses, unsafe acts, unsafe conditions, environmental issues, good practice and improvement ideas — anonymously if needed.",
      },
      { property: "og:title", content: "Sitemate" },
      {
        property: "og:description",
        content: "Frontline concern reporting with a full corrective action workflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConcernsPage,
});

const categories = [
  "All",
  "Occupational Health & Safety",
  "Environmental",
  "Quality",
  "Good Practice",
  "Near Miss",
  "Unsafe Act",
  "Unsafe Condition",
  "Improvement Suggestion",
];

function ConcernsPage() {
  const { concerns, concernWorkflow, overview, templates } = useSheq();
  const queryClient = useQueryClient();
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Concern | null>(null);
  const [viewing, setViewing] = useState<Concern | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      concerns.filter(
        (c) =>
          (cat === "All" || c.category === cat) &&
          `${c.id} ${c.title} ${c.site} ${c.reporter} ${c.templateName ?? ""}`
            .toLowerCase()
            .includes(q.toLowerCase()),
      ),
    [concerns, cat, q],
  );

  const viewingTemplate = useMemo(
    () =>
      viewing?.templateId
        ? templates.find((t) => t.id === viewing.templateId)
        : undefined,
    [viewing, templates],
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["sheq"] });
  }

  async function handleDelete(concern: Concern) {
    const ok = window.confirm(
      `Delete concern “${concern.id} — ${concern.title}”? This cannot be undone.`,
    );
    if (!ok) return;

    setDeletingId(concern.id);
    try {
      await deleteConcern(concern.id);
      toast.success(`${concern.id} deleted`);
      if (viewing?.id === concern.id) setViewing(null);
      if (editing?.id === concern.id) {
        setEditing(null);
        setCreateOpen(false);
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete concern");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Report a Concern"
        description="Anyone on site can raise a concern in seconds — anonymously if they prefer."
        actions={
          <Button
            className="rounded-xl"
            onClick={() => {
              setEditing(null);
              setCreateOpen(true);
            }}
          >
            <Plus /> New concern
          </Button>
        }
      />

      <NewConcernDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditing(null);
        }}
        templates={templates}
        editing={editing}
        onSaved={async () => {
          await refresh();
        }}
      />

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.title ?? "Concern"}</DialogTitle>
            <DialogDescription>
              {viewing
                ? `${viewing.id} · ${viewing.category} · ${viewing.status}`
                : "Concern details"}
            </DialogDescription>
          </DialogHeader>

          {viewing ? (
            viewingTemplate && viewing.formData ? (
              <div className="overflow-x-auto rounded-xl border border-border bg-muted/20 p-3">
                {renderDocumentTemplate(viewingTemplate, {
                  values: viewing.formData,
                  editable: false,
                })}
              </div>
            ) : (
              <div className="grid gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Site:</span> {viewing.site}
                </p>
                <p>
                  <span className="text-muted-foreground">Reporter:</span>{" "}
                  {viewing.anonymous ? "Anonymous" : viewing.reporter}
                </p>
                <p>
                  <span className="text-muted-foreground">Raised:</span> {viewing.raised}
                </p>
                <p>
                  <span className="text-muted-foreground">Priority:</span>{" "}
                  {viewing.priority}
                </p>
              </div>
            )
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            {viewing ? (
              <>
                <Button variant="outline" className="rounded-xl" asChild>
                  <a href={concernDownloadUrl(viewing.id)} download>
                    <Download /> Download
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setViewing(null);
                    setEditing(viewing);
                    setCreateOpen(true);
                  }}
                >
                  <Pencil /> Edit
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setViewing(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open concerns"
          value={overview.openConcerns}
          icon={MessageSquareWarning}
          tone="warning"
        />
        <StatCard
          label="Closed concerns"
          value={overview.closedConcerns}
          tone="success"
          trend={12}
        />
        <StatCard
          label="Anonymous reports"
          value={`${Math.round(
            (concerns.filter((c) => c.anonymous).length /
              Math.max(concerns.length, 1)) *
              100,
          )}%`}
          icon={EyeOff}
        />
        <StatCard
          label="Avg. response time"
          value="6.2 h"
          hint="Target 24 h"
          tone="success"
        />
      </div>

      <Panel
        className="mt-6"
        title="Concern workflow"
        description="From report to verified closure"
      >
        <ol className="flex flex-wrap gap-2">
          {concernWorkflow.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium">
                {i + 1}. {step}
              </span>
              {i < concernWorkflow.length - 1 && (
                <span className="text-muted-foreground">→</span>
              )}
            </li>
          ))}
        </ol>
      </Panel>

      <div className="mt-6 flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search concerns"
            aria-label="Search concerns"
            className="h-10 rounded-xl bg-card pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                cat === c
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={<MessageSquareWarning />}
            title="No concerns here"
            description="Nothing has been reported in this category yet — raise a new concern to get started."
            action={
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setCat("All");
                  setQ("");
                  setEditing(null);
                  setCreateOpen(true);
                }}
              >
                New concern
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((c) => (
              <Panel key={c.id} className="flex flex-col gap-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {c.id}
                  </span>
                  <StatusPill value={c.priority} />
                </div>
                <button
                  type="button"
                  className="text-left font-medium hover:underline"
                  onClick={() => setViewing(c)}
                >
                  {c.title}
                </button>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="w-fit rounded-full">
                    {c.category}
                  </Badge>
                  {c.templateName ? (
                    <Badge variant="outline" className="w-fit rounded-full">
                      {c.templateName}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.site} · {c.anonymous ? "Anonymous reporter" : c.reporter} ·{" "}
                  {c.raised}
                </p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                  <StatusPill value={c.status} />
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      asChild
                    >
                      <a href={concernDownloadUrl(c.id)} download>
                        <Download /> Download
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      disabled={!c.templateId}
                      onClick={() => {
                        setEditing(c);
                        setCreateOpen(true);
                      }}
                    >
                      <Pencil /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-destructive hover:text-destructive"
                      disabled={deletingId === c.id}
                      onClick={() => handleDelete(c)}
                    >
                      <Trash2 /> Delete
                    </Button>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
