import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Eye,
  FileStack,
  History,
  Plus,
  Search,
  Trash2,
  Archive,
  Save,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { renderDocumentTemplate } from "@/components/sheq/document-forms";
import {
  emptyToolboxTalkForm,
  formFromTemplate,
  isToolboxTalkTemplate,
  StandardTemplatePreview,
  ToolboxTalkRegisterForm,
  type ToolboxTalkFormState,
} from "@/components/sheq/toolbox-talk-register";
import { PageHeader, Panel, EmptyState } from "@/components/sheq/primitives";
import { StatusPill } from "@/components/sheq/status-pill";
import type { Template } from "@/data/sheq";
import { ApiError, createToolboxTalkTemplate } from "@/lib/api";
import { useSheq } from "@/lib/sheq-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content:
          "Reusable ISO 9001, ISO 14001, ISO 45001, lift regulation and custom SHEQ form templates with version history.",
      },
      { property: "og:title", content: "Sitemate" },
      {
        property: "og:description",
        content: "Search, duplicate, version and archive your SHEQ form templates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplatesPage,
});

const CONCERN_KINDS = new Set([
  "ohs-concern",
  "quality-concern",
  "good-practice",
  "sustainability-concern",
]);

const SHEQ_FORM_KINDS = new Set([
  "sheq-service-report",
  "sheq-installation-report",
]);

function isConcernTemplate(t: Template) {
  return Boolean(t.kind && CONCERN_KINDS.has(t.kind)) || t.category === "Concern";
}

function isSheqFormsTemplate(t: Template) {
  return (
    Boolean(t.kind && SHEQ_FORM_KINDS.has(t.kind)) || t.category === "SHEQ Forms"
  );
}

function TemplatesPage() {
  const { templates } = useSheq();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Template | null>(null);
  const [form, setForm] = useState<ToolboxTalkFormState>(emptyToolboxTalkForm);
  const [saving, setSaving] = useState(false);

  const cats = useMemo(() => {
    const hasConcern = templates.some(isConcernTemplate);
    const hasSheqForms = templates.some(isSheqFormsTemplate);
    const present = Array.from(
      new Set(
        templates
          .filter((t) => !isConcernTemplate(t) && !isSheqFormsTemplate(t))
          .map((t) => t.category),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return [
      "All",
      ...(hasConcern ? ["Concern"] : []),
      ...(hasSheqForms ? ["SHEQ Forms"] : []),
      ...present,
    ] as const;
  }, [templates]);

  const rows = useMemo(
    () =>
      templates.filter((t) => {
        if (!t.name.toLowerCase().includes(q.toLowerCase())) return false;
        if (cat === "All") return true;
        if (cat === "Concern") return isConcernTemplate(t);
        if (cat === "SHEQ Forms") return isSheqFormsTemplate(t);
        return (
          t.category === cat && !isConcernTemplate(t) && !isSheqFormsTemplate(t)
        );
      }),
    [templates, q, cat],
  );

  useEffect(() => {
    if (cat === "All" || cat === "Concern" || cat === "SHEQ Forms") return;
    if (
      !templates.some(
        (t) =>
          t.category === cat && !isConcernTemplate(t) && !isSheqFormsTemplate(t),
      )
    ) {
      setCat("All");
    }
  }, [templates, cat]);

  function openCreate() {
    setForm(emptyToolboxTalkForm());
    setCreateOpen(true);
  }

  async function saveTemplate(status: "Draft" | "Published") {
    setSaving(true);
    try {
      const created = await createToolboxTalkTemplate({
        name: form.name.trim() || "Tool Box Talk Register",
        documentNo: form.documentNo,
        approvedBy: form.approvedBy,
        status,
        ...(form.logoLeft ? { logoLeft: form.logoLeft } : {}),
        ...(form.logoRight ? { logoRight: form.logoRight } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["sheq"] });
      toast.success(
        status === "Published"
          ? `${created.name} published to the library`
          : `${created.name} saved as draft`,
      );
      setCreateOpen(false);
      setForm(emptyToolboxTalkForm());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Template Library"
        description="Standardise every inspection and audit with reusable, version-controlled templates."
        actions={
          <>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link to="/form-builder">Open form builder</Link>
            </Button>
            <Button className="rounded-xl" onClick={openCreate}>
              <Plus /> New template
            </Button>
          </>
        }
      />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setForm(emptyToolboxTalkForm());
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>New template · Tool Box Talk Register</DialogTitle>
            <DialogDescription>
              Upload left and right logos, fill document details, then save this register to the
              template library.
            </DialogDescription>
          </DialogHeader>

          <ToolboxTalkRegisterForm value={form} onChange={setForm} />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={saving}
              onClick={() => saveTemplate("Draft")}
            >
              <Save />
              {saving ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={saving}
              onClick={() => saveTemplate("Published")}
            >
              <Plus />
              {saving ? "Publishing…" : "Publish template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name ?? "Template"}</DialogTitle>
            <DialogDescription>
              {viewing
                ? `${viewing.category} · ${viewing.version} · ${viewing.status}`
                : "Template preview"}
            </DialogDescription>
          </DialogHeader>

          {viewing ? (
            isToolboxTalkTemplate(viewing) ? (
              <ToolboxTalkRegisterForm
                value={formFromTemplate(viewing)}
                readOnly
              />
            ) : (
              renderDocumentTemplate(viewing) ?? (
                <StandardTemplatePreview template={viewing} />
              )
            )
          ) : null}

          <DialogFooter>
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

      <div className="mb-6 flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            className="h-10 rounded-xl bg-card pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
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

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileStack />}
          title="No templates found"
          description="Nothing matches this search in the selected category."
          action={
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setQ("");
                setCat("All");
              }}
            >
              Reset
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => (
            <Panel key={t.id} className="flex flex-col gap-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    {isToolboxTalkTemplate(t) && (t.logoLeft || t.logoRight) ? (
                      <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
                        <img
                          src={t.logoLeft || t.logoRight}
                          alt=""
                          className="size-full object-contain"
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{t.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.code ? `${t.code} · ` : ""}
                        {t.fields} fields · {t.version}
                      </p>
                      {t.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {t.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Actions for ${t.name}`}>
                      <History className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toast.success(`Duplicated ${t.name}`)}>
                      <Copy /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast(`Version history for ${t.version}`)}>
                      <History /> Version history
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast(`Archived ${t.name}`)}>
                      <Archive /> Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => toast.error(`Deleted ${t.name}`)}
                    >
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {t.category}
                </Badge>
                {t.code ? (
                  <Badge variant="outline" className="rounded-full">
                    {t.code}
                  </Badge>
                ) : isToolboxTalkTemplate(t) ? (
                  <Badge variant="outline" className="rounded-full">
                    Register
                  </Badge>
                ) : null}
                <StatusPill value={t.status} />
                <span className="text-xs text-muted-foreground">{t.uses} submissions</span>
              </div>
              <Button
                size="sm"
                className="w-full rounded-xl"
                onClick={() => setViewing(t)}
              >
                <Eye /> View
              </Button>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
