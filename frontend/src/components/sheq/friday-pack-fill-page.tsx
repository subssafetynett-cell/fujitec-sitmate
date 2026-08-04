import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileStack, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilledFormDownloadMenu } from "@/components/sheq/filled-form-download";
import { PageHeader, Panel } from "@/components/sheq/primitives";
import { SheqComplianceResultsPanel } from "@/components/sheq/sheq-compliance-results";
import { renderDocumentTemplate } from "@/components/sheq/document-forms";
import {
  ToolboxTalkRegisterForm,
  toolboxFromValues,
  valuesFromToolbox,
} from "@/components/sheq/toolbox-talk-register";
import type { SitePackDocument, Template } from "@/data/sheq";
import {
  ApiError,
  saveFilledSitePackForm,
  updateFilledSitePackForm,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SCORED_KINDS = new Set([
  "sheq-service-report",
  "sheq-installation-report",
]);

type Props = {
  siteId: string;
  siteName: string;
  folderId: string;
  folderName: string;
  templates: Template[];
  editing?: SitePackDocument | null | undefined;
  /** View opens a read-only filled form; edit/create remain writable. */
  mode?: "create" | "edit" | "view" | undefined;
  onClose: () => void;
  onSaved: () => void;
  onEdit?: (() => void) | undefined;
};

const FILLABLE_KINDS = new Set([
  "toolbox-talk",
  "rams-briefing",
  "safe-start",
  "audit-action",
  "puwer",
  "loler",
  "site-sheq",
  "site-induction",
  "ohs-concern",
  "quality-concern",
  "good-practice",
  "sustainability-concern",
  "sheq-service-report",
  "sheq-installation-report",
  "alimak-weekly-check",
]);

export function FridayPackFillPage({
  siteId,
  siteName,
  folderId,
  folderName,
  templates,
  editing,
  mode = editing ? "edit" : "create",
  onClose,
  onSaved,
  onEdit,
}: Props) {
  const isView = mode === "view";
  const [step, setStep] = useState<"pick" | "fill" | "results">(
    editing || isView ? "fill" : "pick",
  );
  const [selectedId, setSelectedId] = useState(editing?.templateId ?? "");
  const [title, setTitle] = useState(editing?.name ?? "");
  const [values, setValues] = useState<Record<string, string>>(editing?.formData ?? {});
  const [saving, setSaving] = useState(false);
  const [savedDoc, setSavedDoc] = useState<SitePackDocument | null>(null);

  useEffect(() => {
    if (editing) {
      setStep("fill");
      setSelectedId(editing.templateId ?? "");
      setTitle(editing.name);
      const template =
        templates.find((t) => t.id === editing.templateId) ||
        templates.find((t) => t.kind && t.kind === editing.kind);
      const saved = editing.formData ?? {};
      // Backfill template branding/meta when older saves omit them.
      // Safe Start starts without logos unless the user uploaded them on this form.
      const isSafeStart = editing.kind === "safe-start";
      setValues({
        ...saved,
        documentNo:
          saved.documentNo || template?.code || template?.documentNo || "",
        approvedBy: saved.approvedBy || template?.approvedBy || "",
        headerTitle:
          saved.headerTitle ||
          (editing.kind === "rams-briefing"
            ? "RAMS Briefing Register"
            : template?.name || ""),
        pageLabel: saved.pageLabel || "Page 1 of 1",
        logoLeft: isSafeStart
          ? saved.logoLeft || ""
          : saved.logoLeft || template?.logoLeft || "",
        logoRight: isSafeStart
          ? saved.logoRight || ""
          : saved.logoRight || template?.logoRight || "",
        ...(editing.kind === "rams-briefing" && !saved.subtitle
          ? {
              subtitle:
                "Risk Assessment & Method Statement (RAMS) Briefing Form",
            }
          : {}),
      });
      setSaving(false);
      return;
    }
    setStep("pick");
    setSelectedId("");
    setTitle("");
    setValues({});
    setSaving(false);
  }, [editing, mode, templates]);

  const fillableTemplates = useMemo(
    () =>
      templates.filter((t) => t.kind && t.kind !== "standard" && FILLABLE_KINDS.has(t.kind)),
    [templates],
  );

  const selected =
    fillableTemplates.find((t) => t.id === selectedId) ||
    templates.find((t) => t.id === selectedId);

  function chooseTemplate(template: Template) {
    setSelectedId(template.id);
    setTitle(`${template.name} — ${siteName}`);
    const isSafeStart = template.kind === "safe-start";
    setValues({
      date: new Date().toISOString().slice(0, 10),
      documentNo: template.code || template.documentNo || "",
      approvedBy: template.approvedBy || "",
      headerTitle:
        template.kind === "rams-briefing"
          ? "RAMS Briefing Register"
          : template.kind === "safe-start"
            ? "Daily Safe Start Briefing Sheet"
            : template.name,
      pageLabel: "Page 1 of 1",
      // Safe Start: empty logo slots (upload while filling). Others inherit template logos.
      logoLeft: isSafeStart ? "" : template.logoLeft || "",
      logoRight: isSafeStart ? "" : template.logoRight || "",
      projectName: siteName,
      site: siteName,
      briefingDate: new Date().toISOString().slice(0, 10),
      ...(template.kind === "rams-briefing"
        ? {
            subtitle:
              "Risk Assessment & Method Statement (RAMS) Briefing Form",
          }
        : {}),
    });
    setStep("fill");
  }

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!selected) {
      toast.message("Select a template first");
      return;
    }
    if (!title.trim()) {
      toast.message("Enter a form title");
      return;
    }

    setSaving(true);
    try {
      let doc: SitePackDocument;
      if (editing) {
        doc = await updateFilledSitePackForm(siteId, editing.id, {
          title: title.trim(),
          formData: values,
        });
        toast.success("Form updated");
      } else {
        doc = await saveFilledSitePackForm({
          siteId,
          folderId,
          templateId: selected.id,
          templateName: selected.name,
          kind: selected.kind,
          title: title.trim(),
          formData: values,
          documentNo: selected.documentNo,
          code: selected.code,
          approvedBy: selected.approvedBy,
        });
        toast.success("Form saved to folder");
      }
      onSaved();
      if (selected.kind && SCORED_KINDS.has(selected.kind)) {
        setSavedDoc(doc);
        setStep("results");
      } else {
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save form");
    } finally {
      setSaving(false);
    }
  }

  if (step === "results" && selected && savedDoc) {
    return (
      <div className="animate-rise">
        <PageHeader
          title="Form submitted"
          description={`Saved to “${folderName}”. Review compliance, then download or return to the folder.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <FilledFormDownloadMenu
                siteId={siteId}
                doc={savedDoc}
                templates={templates}
              />
              <Button type="button" className="rounded-xl" onClick={onClose}>
                Back to folder
              </Button>
            </div>
          }
        />
        <SheqComplianceResultsPanel
          kind={selected.kind || savedDoc.kind}
          values={savedDoc.formData ?? values}
          className="mb-5"
        />
        <Panel
          title={selected.name}
          description="Full report including compliance dashboard and nonconformance findings"
        >
          <div className="overflow-x-auto rounded-xl border border-border bg-muted/20 p-3 sm:p-5">
            {renderDocumentTemplate(selected, {
              values: savedDoc.formData ?? values,
              editable: false,
            })}
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <FilledFormDownloadMenu
              siteId={siteId}
              doc={savedDoc}
              templates={templates}
            />
            <Button type="button" className="rounded-xl" onClick={onClose}>
              Done
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title={
          isView
            ? "View filled form"
            : editing
              ? "Edit filled form"
              : step === "pick"
                ? "Select template"
                : "Fill form"
        }
        description={
          isView
            ? `Read-only view of “${title || editing?.name || "form"}” in folder “${folderName}”.`
            : step === "pick"
              ? `Choose a template to fill for folder “${folderName}” on ${siteName}.`
              : `Fill every highlighted field, then save into “${folderName}”.`
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                if (step === "fill" && !editing && !isView) {
                  setStep("pick");
                  return;
                }
                onClose();
              }}
              disabled={saving}
            >
              <ArrowLeft />
              {step === "fill" && !editing && !isView
                ? "Back to templates"
                : "Back to folder"}
            </Button>
            {isView && editing ? (
              <>
                <FilledFormDownloadMenu
                  siteId={siteId}
                  doc={editing}
                  templates={templates}
                />
                {onEdit ? (
                  <Button type="button" className="rounded-xl" onClick={onEdit}>
                    <Pencil /> Edit
                  </Button>
                ) : null}
              </>
            ) : null}
            {step === "fill" && !isView ? (
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => void handleSave()}
                disabled={saving || !selected}
              >
                <Save />
                {saving ? "Saving…" : editing ? "Save changes" : "Save form"}
              </Button>
            ) : null}
          </div>
        }
      />

      {step === "pick" && !isView ? (
        <Panel title="Templates" description="Select a form template to open the fill page">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fillableTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => chooseTemplate(t)}
                className={cn(
                  "rounded-2xl border border-border p-4 text-left transition-colors hover:border-ring hover:bg-muted/40",
                  selectedId === t.id && "border-ring ring-2 ring-ring/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-muted">
                    <FileStack className="size-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t.code ? `${t.code} · ` : ""}
                      {t.category}
                    </span>
                  </span>
                </div>
              </button>
            ))}
            {fillableTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                No fillable templates are available yet.
              </p>
            ) : null}
          </div>
        </Panel>
      ) : selected ? (
        <Panel
          title={selected.name}
          description={
            isView
              ? "This is a read-only preview of the saved form."
              : selected.kind && SCORED_KINDS.has(selected.kind)
                ? "Amber fields are editable. Scores update the compliance dashboard at the bottom. Save when complete."
                : "Amber fields are editable. Complete the form, then save it into this folder."
          }
        >
          <div className="mb-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="filled-form-title">Saved form title</Label>
              {isView ? (
                <p
                  id="filled-form-title"
                  className="flex h-10 items-center rounded-xl border border-border bg-muted/30 px-3 text-sm"
                >
                  {title || "—"}
                </p>
              ) : (
                <Input
                  id="filled-form-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-10 rounded-xl"
                />
              )}
            </div>
            {!editing && !isView ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setStep("pick")}
              >
                Change template
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-muted/20 p-3 sm:p-5">
            {selected.kind === "toolbox-talk" ? (
              <ToolboxTalkRegisterForm
                value={toolboxFromValues(values)}
                readOnly={isView}
                onChange={
                  isView
                    ? undefined
                    : (next) => setValues(valuesFromToolbox(next))
                }
              />
            ) : (
              renderDocumentTemplate(selected, {
                values,
                onChange: isView ? undefined : setField,
                editable: !isView,
              })
            )}
          </div>

          {!isView ? (
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => void handleSave()}
                disabled={saving || !selected}
              >
                <Save />
                {saving ? "Saving…" : editing ? "Save changes" : "Save form"}
              </Button>
            </div>
          ) : null}
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm text-muted-foreground">Template not found.</p>
        </Panel>
      )}
    </div>
  );
}
