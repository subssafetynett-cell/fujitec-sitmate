import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ClipboardList,
  Download,
  FileText,
  Loader2,
  MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentTemplateDownloadMenu } from "@/components/sheq/document-template-download";
import { SheqFormFillPage } from "@/components/sheq/sheq-form-fill-page";
import { SheqComplianceBadge } from "@/components/sheq/sheq-compliance-results";
import { renderDocumentTemplate } from "@/components/sheq/document-forms";
import { PageHeader, Panel, EmptyState } from "@/components/sheq/primitives";
import { StatCard } from "@/components/sheq/stat-card";
import { StatusPill } from "@/components/sheq/status-pill";
import type { SheqFormRecord, Template } from "@/data/sheq";
import { ApiError, deleteSheqForm } from "@/lib/api";
import { useSheq } from "@/lib/sheq-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SHEQ_PAGE_KINDS = new Set([
  "sheq-service-report",
  "sheq-installation-report",
]);

export const Route = createFileRoute("/sheq-forms")({
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content:
          "Fill, save and manage SHEQ Service Reports and Installation Service Reports.",
      },
      { property: "og:title", content: "Sitemate" },
      {
        property: "og:description",
        content: "SHEQ service and installation report forms in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SheqFormsPage,
});

const filters = ["All", "SHEQ Service Report", "SHEQ Installation Service Report"] as const;

function SheqFormsPage() {
  const { sheqForms = [], templates } = useSheq();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [fillOpen, setFillOpen] = useState(false);
  const [initialTemplateId, setInitialTemplateId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SheqFormRecord | null>(null);
  const [viewing, setViewing] = useState<SheqFormRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formTemplates = useMemo(
    () =>
      templates.filter(
        (t) =>
          t.kind === "sheq-service-report" || t.kind === "sheq-installation-report",
      ),
    [templates],
  );

  const pageForms = useMemo(
    () =>
      sheqForms.filter(
        (f) =>
          (f.kind && SHEQ_PAGE_KINDS.has(f.kind)) ||
          f.templateName === "SHEQ Service Report" ||
          f.templateName === "SHEQ Installation Service Report",
      ),
    [sheqForms],
  );

  const rows = useMemo(
    () =>
      pageForms.filter((f) => {
        const matchesFilter =
          filter === "All" ||
          f.templateName === filter ||
          (filter === "SHEQ Service Report" && f.kind === "sheq-service-report") ||
          (filter === "SHEQ Installation Service Report" &&
            f.kind === "sheq-installation-report");
        const matchesQ =
          !q ||
          `${f.id} ${f.title} ${f.site} ${f.client} ${f.templateName ?? ""}`
            .toLowerCase()
            .includes(q.toLowerCase());
        return matchesFilter && matchesQ;
      }),
    [pageForms, filter, q],
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

  function openFillPage(opts?: {
    templateId?: string | null;
    record?: SheqFormRecord | null;
  }) {
    setEditing(opts?.record ?? null);
    setInitialTemplateId(opts?.templateId ?? null);
    setFillOpen(true);
  }

  function closeFillPage() {
    setFillOpen(false);
    setEditing(null);
    setInitialTemplateId(null);
  }

  async function handleDelete(form: SheqFormRecord) {
    const ok = window.confirm(
      `Delete form “${form.id} — ${form.title}”? This cannot be undone.`,
    );
    if (!ok) return;
    setDeletingId(form.id);
    try {
      await deleteSheqForm(form.id);
      toast.success(`${form.id} deleted`);
      if (viewing?.id === form.id) setViewing(null);
      if (editing?.id === form.id) closeFillPage();
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete form");
    } finally {
      setDeletingId(null);
    }
  }

  if (fillOpen) {
    return (
      <SheqFormFillPage
        templates={templates}
        initialTemplateId={initialTemplateId}
        editing={editing}
        onClose={closeFillPage}
        onSaved={async () => {
          await refresh();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="SHEQ Forms"
        description="Select a template to open the full fill page, then save your report."
        actions={
          <Button className="rounded-xl" onClick={() => openFillPage()}>
            <Plus /> New SHEQ form
          </Button>
        }
      />

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.title ?? "SHEQ form"}</DialogTitle>
            <DialogDescription>
              {viewing
                ? `${viewing.id} · ${viewing.templateName ?? "Form"} · ${viewing.status}`
                : "Form details"}
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
                  <span className="text-muted-foreground">Client:</span> {viewing.client}
                </p>
                <p>
                  <span className="text-muted-foreground">Site:</span> {viewing.site}
                </p>
                <p>
                  <span className="text-muted-foreground">Raised:</span> {viewing.raised}
                </p>
              </div>
            )
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            {viewing ? (
              <>
                {viewingTemplate && viewing.formData ? (
                  <DocumentTemplateDownloadMenu
                    template={viewingTemplate}
                    formData={viewing.formData}
                    title={viewing.title || viewingTemplate.name}
                    className="rounded-xl"
                  />
                ) : null}
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    const record = viewing;
                    setViewing(null);
                    openFillPage({ record });
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
        <StatCard label="Saved forms" value={pageForms.length} icon={ClipboardList} />
        <StatCard
          label="Service reports"
          value={pageForms.filter((f) => f.kind === "sheq-service-report").length}
        />
        <StatCard
          label="Installation reports"
          value={pageForms.filter((f) => f.kind === "sheq-installation-report").length}
        />
        <StatCard label="Templates" value={formTemplates.length} tone="success" />
      </div>

      <Panel
        className="mt-6"
        title="Available form templates"
        description="Click a template to open it on a full page and fill it out"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {formTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => openFillPage({ templateId: t.id })}
              className="rounded-2xl border border-border p-4 text-left transition-colors hover:border-ring hover:bg-muted/40"
            >
              <p className="font-medium">{t.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.code ? `${t.code} · ` : ""}
                {t.description || t.category}
              </p>
              <p className="mt-3 text-xs font-medium text-primary">Open fill page →</p>
            </button>
          ))}
          {formTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              No SHEQ form templates are available yet.
            </p>
          ) : null}
        </div>
      </Panel>

      <div className="mt-6 flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search SHEQ forms"
            aria-label="Search SHEQ forms"
            className="h-10 rounded-xl bg-card pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                filter === f
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="No SHEQ forms yet"
            description="Select a template above to open the fill page and save your first report."
            action={
              <Button className="rounded-xl" onClick={() => openFillPage()}>
                <Plus /> New SHEQ form
              </Button>
            }
          />
        ) : (
          <Panel className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Sl</TableHead>
                    <TableHead className="min-w-[100px]">ID</TableHead>
                    <TableHead className="min-w-[180px]">Title</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>H&amp;S</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Raised</TableHead>
                    <TableHead className="w-[1%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((f, index) => {
                    const template =
                      templates.find((t) => t.id === f.templateId) ||
                      templates.find((t) => t.kind && t.kind === f.kind);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {f.id}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left font-medium hover:underline"
                            onClick={() => setViewing(f)}
                          >
                            {f.title}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {f.templateName || "SHEQ form"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {f.hsStatus ? <StatusPill value={f.hsStatus} /> : "—"}
                        </TableCell>
                        <TableCell>
                          <SheqComplianceBadge
                            kind={f.kind}
                            values={f.formData ?? undefined}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {f.raised}
                        </TableCell>
                        <TableCell className="text-right">
                          <SheqFormRowActions
                            form={f}
                            template={template}
                            deleting={deletingId === f.id}
                            onEdit={() => openFillPage({ record: f })}
                            onDelete={() => void handleDelete(f)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}

function SheqFormRowActions({
  form,
  template,
  deleting,
  onEdit,
  onDelete,
}: {
  form: SheqFormRecord;
  template?: Template;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const canDownload = Boolean(template && form.formData);

  const menu = (busy = false, startDownload?: (format: "pdf" | "word") => void) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg"
          aria-label={`Actions for ${form.id}`}
          disabled={deleting || busy}
        >
          {deleting || busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil /> Edit
        </DropdownMenuItem>
        {canDownload && startDownload ? (
          <>
            <DropdownMenuItem disabled={busy} onClick={() => startDownload("pdf")}>
              <FileText /> Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onClick={() => startDownload("word")}>
              <Download /> Download Word
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (canDownload && template && form.formData) {
    return (
      <DocumentTemplateDownloadMenu
        template={template}
        formData={form.formData}
        title={form.title || template.name}
      >
        {({ startDownload, busy }) => menu(busy, startDownload)}
      </DocumentTemplateDownloadMenu>
    );
  }

  return menu();
}
