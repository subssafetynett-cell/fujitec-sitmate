import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentTemplateDownloadMenu } from "@/components/sheq/document-template-download";
import { PageHeader, Panel } from "@/components/sheq/primitives";
import { SheqComplianceResultsPanel } from "@/components/sheq/sheq-compliance-results";
import { renderDocumentTemplate } from "@/components/sheq/document-forms";
import type { SheqFormRecord, Template } from "@/data/sheq";
import { ApiError, createSheqForm, updateSheqForm } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SHEQ_FORM_KINDS = new Set([
  "sheq-service-report",
  "sheq-installation-report",
]);

/** All document templates that can be filled and downloaded from this page. */
const ALL_FILLABLE_KINDS = new Set([
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

const SCORED_KINDS = new Set([
  "sheq-service-report",
  "sheq-installation-report",
]);

type Props = {
  templates: Template[];
  /** When set, open directly on this template (skip pick step). */
  initialTemplateId?: string | null;
  editing?: SheqFormRecord | null;
  /**
   * `sheq` = service/installation/site-sheq only;
   * `all` = every fillable template;
   * `performance` = fillable templates excluding SHEQ service/installation (those stay on SHEQ Forms).
   */
  templateScope?: "sheq" | "all" | "performance";
  onClose: () => void;
  onSaved: (form: SheqFormRecord) => void;
};

function seedValues(template: Template): Record<string, string> {
  return {
    date: new Date().toISOString().slice(0, 10),
    jobDate: new Date().toISOString().slice(0, 10),
    documentNo: template.documentNo || template.code || "",
    approvedBy: template.approvedBy || "Management",
    headerTitle: template.name,
    pageLabel: "Page 1 of 1",
    logoLeft: template.logoLeft || "",
    logoRight: template.logoRight || "",
    hsStatus: "GREEN",
  };
}

export function SheqFormFillPage({
  templates,
  initialTemplateId,
  editing,
  templateScope = "sheq",
  onClose,
  onSaved,
}: Props) {
  const formTemplates = useMemo(() => {
    if (templateScope === "all") {
      return templates.filter(
        (t) =>
          t.status !== "Archived" &&
          Boolean(t.kind && ALL_FILLABLE_KINDS.has(t.kind)),
      );
    }
    if (templateScope === "performance") {
      return templates.filter(
        (t) =>
          t.status !== "Archived" &&
          Boolean(t.kind && ALL_FILLABLE_KINDS.has(t.kind)) &&
          t.kind !== "sheq-service-report" &&
          t.kind !== "sheq-installation-report",
      );
    }
    return templates.filter(
      (t) =>
        (t.kind && SHEQ_FORM_KINDS.has(t.kind)) || t.category === "SHEQ Forms",
    );
  }, [templates, templateScope]);

  const [step, setStep] = useState<"pick" | "fill" | "results">(
    editing || initialTemplateId ? "fill" : "pick",
  );
  const [selectedId, setSelectedId] = useState(
    editing?.templateId || initialTemplateId || "",
  );
  const [title, setTitle] = useState(editing?.title ?? "");
  const [values, setValues] = useState<Record<string, string>>(
    editing?.formData ?? {},
  );
  const [saving, setSaving] = useState(false);
  const [savedForm, setSavedForm] = useState<SheqFormRecord | null>(null);

  const selected =
    formTemplates.find((t) => t.id === selectedId) ||
    templates.find((t) => t.id === selectedId);

  useEffect(() => {
    if (editing) {
      setStep("fill");
      setSelectedId(editing.templateId ?? "");
      setTitle(editing.title);
      const template =
        templates.find((t) => t.id === editing.templateId) ||
        templates.find((t) => t.kind && t.kind === editing.kind);
      const saved = editing.formData ?? {};
      setValues({
        ...saved,
        documentNo:
          saved.documentNo || template?.documentNo || template?.code || "",
        approvedBy: saved.approvedBy || template?.approvedBy || "",
        headerTitle: saved.headerTitle || template?.name || "",
        pageLabel: saved.pageLabel || "Page 1 of 1",
        logoLeft: saved.logoLeft || template?.logoLeft || "",
        logoRight: saved.logoRight || template?.logoRight || "",
      });
      setSaving(false);
      setSavedForm(null);
      return;
    }

    if (initialTemplateId) {
      const template =
        formTemplates.find((t) => t.id === initialTemplateId) ||
        templates.find((t) => t.id === initialTemplateId);
      if (template) {
        setSelectedId(template.id);
        setTitle("");
        setValues(seedValues(template));
        setStep("fill");
        setSaving(false);
        setSavedForm(null);
        return;
      }
    }

    setStep("pick");
    setSelectedId("");
    setTitle("");
    setValues({});
    setSaving(false);
    setSavedForm(null);
  }, [editing, initialTemplateId, formTemplates, templates]);

  function chooseTemplate(template: Template) {
    setSelectedId(template.id);
    setTitle("");
    setValues(seedValues(template));
    setStep("fill");
    setSavedForm(null);
  }

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!selected) {
      toast.message("Select a SHEQ form template first");
      return;
    }
    setSaving(true);
    try {
      let form: SheqFormRecord;
      if (editing) {
        form = await updateSheqForm(editing.id, {
          templateId: selected.id,
          title: title.trim() || undefined,
          formData: values,
          status: "Submitted",
        });
        toast.success(`${form.id} updated`);
      } else {
        form = await createSheqForm({
          templateId: selected.id,
          title: title.trim() || undefined,
          formData: values,
          status: "Submitted",
        });
        toast.success(`${form.id} saved`);
      }
      onSaved(form);
      // Always land on results so the user can download the filled report.
      setSavedForm(form);
      setStep("results");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : editing
            ? "Unable to update SHEQ form"
            : "Unable to save SHEQ form",
      );
    } finally {
      setSaving(false);
    }
  }

  if (step === "results" && selected && savedForm) {
    const isScored = Boolean(
      (selected.kind || savedForm.kind) &&
        SCORED_KINDS.has(selected.kind || savedForm.kind || ""),
    );
    return (
      <div className="animate-rise">
        <PageHeader
          title="Form submitted"
          description={
            isScored
              ? `${savedForm.id} · ${selected.name} — review compliance, then download or return.`
              : `${savedForm.id} · ${selected.name} — download the filled report or return.`
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <DocumentTemplateDownloadMenu
                template={selected}
                formData={savedForm.formData ?? values}
                title={savedForm.title || selected.name}
                className="rounded-xl"
              />
              <Button
                type="button"
                className="rounded-xl"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          }
        />

        {isScored ? (
          <SheqComplianceResultsPanel
            kind={selected.kind || savedForm.kind}
            values={savedForm.formData ?? values}
            className="mb-5"
          />
        ) : null}

        <Panel
          title={selected.name}
          description={
            isScored
              ? "Full report including compliance dashboard and nonconformance findings"
              : "Filled report preview — use Download for PDF or Word"
          }
        >
          <div className="overflow-x-auto rounded-xl border border-border bg-muted/20 p-3 sm:p-5">
            {renderDocumentTemplate(selected, {
              values: savedForm.formData ?? values,
              editable: false,
            })}
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <DocumentTemplateDownloadMenu
              template={selected}
              formData={savedForm.formData ?? values}
              title={savedForm.title || selected.name}
              className="rounded-xl"
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
          editing
            ? "Edit SHEQ form"
            : step === "pick"
              ? "Select SHEQ form"
              : "Fill SHEQ form"
        }
        description={
          editing
            ? `Update ${editing.id}, then save your changes.`
            : step === "pick"
              ? templateScope === "all"
                ? "Choose any form template to open the full fill page."
                : "Choose a SHEQ form template to open the full fill page."
              : `Complete the ${selected?.name ?? "form"}, then save.`
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                if (step === "fill" && !editing) {
                  setStep("pick");
                  return;
                }
                onClose();
              }}
              disabled={saving}
            >
              <ArrowLeft />
              {step === "fill" && !editing ? "Back to templates" : "Back to list"}
            </Button>
            {step === "fill" ? (
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

      {step === "pick" ? (
        <Panel
          title={
            templateScope === "all"
              ? "All form templates"
              : "SHEQ form templates"
          }
          description="Select a template to open it on a full page for filling"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {formTemplates.map((t) => (
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
                    <ClipboardList className="size-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t.code ? `${t.code} · ` : ""}
                      {t.fields} fields
                    </span>
                    {t.description ? (
                      <span className="mt-2 line-clamp-2 block text-xs text-muted-foreground">
                        {t.description}
                      </span>
                    ) : null}
                  </span>
                </div>
              </button>
            ))}
            {formTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                No SHEQ form templates are available yet.
              </p>
            ) : null}
          </div>
        </Panel>
      ) : selected ? (
        <Panel
          title={selected.name}
          description="Amber fields are editable. Scores update the compliance dashboard at the bottom. Save when complete."
        >
          <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="sheq-form-title">Form title</Label>
              <Input
                id="sheq-form-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Defaults from client / site if left blank"
                className="h-10 rounded-xl"
              />
            </div>
            {!editing ? (
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
            {renderDocumentTemplate(selected, {
              values,
              onChange: setField,
              editable: true,
            })}
          </div>

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
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm text-muted-foreground">Template not found.</p>
        </Panel>
      )}
    </div>
  );
}
