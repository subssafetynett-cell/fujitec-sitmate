import { useEffect, useMemo, useState } from "react";
import { FileStack, Save } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { renderDocumentTemplate } from "@/components/sheq/document-forms";
import type { Concern, Template } from "@/data/sheq";
import { ApiError, createConcern, updateConcern } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CONCERN_KINDS = new Set([
  "ohs-concern",
  "quality-concern",
  "good-practice",
  "sustainability-concern",
]);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  editing?: Concern | null;
  onSaved: (concern: Concern) => void;
};

export function NewConcernDialog({
  open,
  onOpenChange,
  templates,
  editing,
  onSaved,
}: Props) {
  const [step, setStep] = useState<"pick" | "fill">(editing ? "fill" : "pick");
  const [selectedId, setSelectedId] = useState(editing?.templateId ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [values, setValues] = useState<Record<string, string>>(
    editing?.formData ?? {},
  );
  const [anonymous, setAnonymous] = useState(Boolean(editing?.anonymous));
  const [saving, setSaving] = useState(false);

  const concernTemplates = useMemo(
    () =>
      templates.filter(
        (t) =>
          (t.kind && CONCERN_KINDS.has(t.kind)) || t.category === "Concern",
      ),
    [templates],
  );

  const selected =
    concernTemplates.find((t) => t.id === selectedId) ||
    templates.find((t) => t.id === selectedId);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setStep("fill");
      setSelectedId(editing.templateId ?? "");
      setTitle(editing.title);
      setValues(editing.formData ?? {});
      setAnonymous(Boolean(editing.anonymous));
      setSaving(false);
    } else {
      setStep("pick");
      setSelectedId("");
      setTitle("");
      setValues({});
      setAnonymous(false);
      setSaving(false);
    }
  }, [open, editing]);

  function reset() {
    setStep(editing ? "fill" : "pick");
    setSelectedId(editing?.templateId ?? "");
    setTitle(editing?.title ?? "");
    setValues(editing?.formData ?? {});
    setAnonymous(Boolean(editing?.anonymous));
    setSaving(false);
  }

  function chooseTemplate(template: Template) {
    setSelectedId(template.id);
    setTitle("");
    setValues({
      date: new Date().toISOString().slice(0, 10),
      reportDate: new Date().toISOString().slice(0, 10),
      documentNo: template.code || "",
      status: "Opened",
    });
    setStep("fill");
  }

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!selected) {
      toast.message("Select a concern template first");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await updateConcern(editing.id, {
          templateId: selected.id,
          title: title.trim() || undefined,
          formData: values,
          anonymous,
        });
        toast.success(`${updated.id} updated`);
        onSaved(updated);
      } else {
        const created = await createConcern({
          templateId: selected.id,
          title: title.trim() || undefined,
          formData: values,
          anonymous,
        });
        toast.success(`${created.id} saved`);
        onSaved(created);
      }
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : editing
            ? "Unable to update concern"
            : "Unable to save concern",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>
            {editing
              ? "Edit concern"
              : step === "pick"
                ? "Select concern template"
                : "Fill concern form"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `Update ${editing.id}, then save your changes.`
              : step === "pick"
                ? "Choose a concern template to fill and save."
                : `Complete the ${selected?.name ?? "concern"} form, then save.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {step === "pick" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {concernTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => chooseTemplate(t)}
                  className={cn(
                    "rounded-2xl border border-border p-4 text-left transition-colors hover:border-ring",
                    selectedId === t.id && "border-ring ring-2 ring-ring/30",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-muted">
                      <FileStack className="size-4 text-muted-foreground" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{t.name}</span>
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
              {concernTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                  No concern templates are available yet. Add them from the Templates library.
                </p>
              ) : null}
            </div>
          ) : selected ? (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="grid gap-2">
                  <Label htmlFor="concern-title">Concern title</Label>
                  <Input
                    id="concern-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Defaults from observation details if left blank"
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

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-3.5 accent-primary"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                />
                Report anonymously
              </label>

              <p className="text-xs text-muted-foreground">
                Yellow fields are editable. Complete the form, then save.
              </p>

              <div className="overflow-x-auto rounded-xl border border-border bg-muted/20 p-3">
                {renderDocumentTemplate(selected, {
                  values,
                  onChange: setField,
                  editable: true,
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Template not found.</p>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          {step === "fill" ? (
            <Button
              type="button"
              className="rounded-xl"
              onClick={handleSubmit}
              disabled={saving || !selected}
            >
              <Save />
              {saving ? "Saving…" : editing ? "Save changes" : "Save concern"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
