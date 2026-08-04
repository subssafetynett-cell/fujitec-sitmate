import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FilePenLine,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentTemplateDownloadMenu } from "@/components/sheq/document-template-download";
import { PageHeader, Panel, EmptyState } from "@/components/sheq/primitives";
import { SheqFormFillPage } from "@/components/sheq/sheq-form-fill-page";
import { SheqComplianceBadge } from "@/components/sheq/sheq-compliance-results";
import type { SheqFormRecord, Template } from "@/data/sheq";
import { ApiError, deleteSheqForm } from "@/lib/api";
import { useSheq } from "@/lib/sheq-context";
import { toast } from "sonner";

/** SHEQ service/installation reports belong on the SHEQ Forms page only. */
const SHEQ_PAGE_ONLY_KINDS = new Set([
  "sheq-service-report",
  "sheq-installation-report",
]);

export const Route = createFileRoute("/performance-monitoring")({
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content: "Fill SHEQ forms and review submitted reports.",
      },
      { property: "og:title", content: "Sitemate" },
      {
        property: "og:description",
        content: "Fill forms and browse filled reports with pagination.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerformanceMonitoringPage,
});

const PAGE_SIZE = 10;

function PerformanceMonitoringPage() {
  const { templates, sheqForms = [] } = useSheq();
  const queryClient = useQueryClient();
  const [fillOpen, setFillOpen] = useState(false);
  const [editing, setEditing] = useState<SheqFormRecord | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SheqFormRecord | null>(null);

  const rows = useMemo(() => {
    const scoped = sheqForms.filter(
      (f) => !(f.kind && SHEQ_PAGE_ONLY_KINDS.has(f.kind)),
    );
    const sorted = [...scoped].sort((a, b) => (a.raised < b.raised ? 1 : -1));
    if (!q.trim()) return sorted;
    const needle = q.trim().toLowerCase();
    return sorted.filter((f) =>
      `${f.id} ${f.title} ${f.templateName ?? ""} ${f.client} ${f.site}`
        .toLowerCase()
        .includes(needle),
    );
  }, [sheqForms, q]);

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteSheqForm(deleteTarget.id);
      toast.success(`${deleteTarget.id} deleted`);
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["sheq"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete form");
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, rows.length);
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage],
  );

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (fillOpen) {
    return (
      <SheqFormFillPage
        templates={templates}
        templateScope="performance"
        editing={editing}
        onClose={() => {
          setFillOpen(false);
          setEditing(null);
        }}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["sheq"] });
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Performance Monitoring"
        description="Fill forms and browse submitted reports. SHEQ service and installation reports are listed on SHEQ Forms."
        actions={
          <Button
            className="rounded-xl"
            onClick={() => {
              setEditing(null);
              setFillOpen(true);
            }}
          >
            <FilePenLine />
            Fill forms
          </Button>
        }
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete form</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.id} — {deleteTarget?.title}
              </span>
              ? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={Boolean(deletingId)}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={Boolean(deletingId)}
              onClick={() => void handleDeleteConfirmed()}
            >
              <Trash2 />
              {deletingId ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Panel
        title="Filled forms"
        description={
          rows.length === 0
            ? "No forms saved yet"
            : `Showing ${pageStart}–${pageEnd} of ${rows.length}`
        }
        actions={
          <div className="relative w-full min-w-[200px] sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search forms"
              aria-label="Search filled forms"
              className="h-9 rounded-xl pl-9"
            />
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="No filled forms yet"
            description="Use Fill forms to choose a template and submit your first report."
            action={
              <Button
                className="rounded-xl"
                onClick={() => {
                  setEditing(null);
                  setFillOpen(true);
                }}
              >
                <FilePenLine />
                Fill forms
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Sl</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Raised</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((f, index) => {
                    const template =
                      templates.find((t) => t.id === f.templateId) ||
                      templates.find((t) => t.kind && t.kind === f.kind);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {f.id}
                        </TableCell>
                        <TableCell className="font-medium">{f.title}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {f.templateName || "Form"}
                          </Badge>
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
                          <FilledFormRowActions
                            form={f}
                            template={template}
                            deleting={deletingId === f.id}
                            onEdit={() => {
                              setEditing(f);
                              setFillOpen(true);
                            }}
                            onDelete={() => setDeleteTarget(f)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <div className="flex flex-wrap items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      type="button"
                      variant={pageNumber === currentPage ? "default" : "outline"}
                      className="size-9 rounded-xl p-0"
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={pageNumber === currentPage ? "page" : undefined}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}

function FilledFormRowActions({
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
