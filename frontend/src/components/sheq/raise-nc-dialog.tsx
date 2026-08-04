import { useEffect, useMemo, useState } from "react";
import { FileWarning, Save } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderDocumentTemplate } from "@/components/sheq/document-forms";
import type { NonConformance, Template, User } from "@/data/sheq";
import {
  ApiError,
  createNonConformance,
  updateNonConformance,
} from "@/lib/api";
import { scopeUsersToActor } from "@/lib/auth";
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
  users: User[];
  actor: User | null;
  editing?: NonConformance | null;
  onSaved: (nc: NonConformance) => void;
};

export function RaiseNcDialog({
  open,
  onOpenChange,
  templates,
  users,
  actor,
  editing,
  onSaved,
}: Props) {
  const [step, setStep] = useState<"pick" | "fill">(editing ? "fill" : "pick");
  const [selectedId, setSelectedId] = useState(editing?.templateId ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [values, setValues] = useState<Record<string, string>>(
    editing?.formData ?? {},
  );
  const [responsiblePersonId, setResponsiblePersonId] = useState(
    editing?.responsiblePersonId ?? "",
  );
  const [dueDate, setDueDate] = useState(
    editing?.dueDate || editing?.due || "",
  );
  const [priority, setPriority] = useState<string>(
    editing?.priority || editing?.severity || "Medium",
  );
  const [auditRef, setAuditRef] = useState(editing?.auditRef ?? "");
  const [saving, setSaving] = useState(false);

  const concernTemplates = useMemo(
    () =>
      templates.filter(
        (t) =>
          (t.kind && CONCERN_KINDS.has(t.kind)) || t.category === "Concern",
      ),
    [templates],
  );

  const assignees = useMemo(
    () =>
      scopeUsersToActor(actor, users).filter(
        (u) => u.status !== "Suspended" && u.id !== actor?.id,
      ),
    [actor, users],
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
      setResponsiblePersonId(editing.responsiblePersonId ?? "");
      setDueDate(editing.dueDate || editing.due || "");
      setPriority(editing.priority || editing.severity || "Medium");
      setAuditRef(editing.auditRef ?? "");
      setSaving(false);
    } else {
      setStep("pick");
      setSelectedId("");
      setTitle("");
      setValues({});
      setResponsiblePersonId("");
      setDueDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
      setPriority("Medium");
      setAuditRef("");
      setSaving(false);
    }
  }, [open, editing]);

  function chooseTemplate(template: Template) {
    setSelectedId(template.id);
    setTitle("");
    setValues({
      date: new Date().toISOString().slice(0, 10),
      reportDate: new Date().toISOString().slice(0, 10),
      documentNo: template.code || "",
      status: "Opened",
      priority: "Medium",
    });
    setStep("fill");
  }

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!selected) {
      toast.message("Select a concern template");
      return;
    }
    if (!responsiblePersonId) {
      toast.message("Select a responsible person");
      return;
    }
    setSaving(true);
    try {
      const saved = editing
        ? await updateNonConformance(editing.id, {
            formData: values,
            responsiblePersonId,
            priority,
            ...(title.trim() ? { title: title.trim() } : {}),
            ...(dueDate ? { dueDate } : {}),
          })
        : await createNonConformance({
            templateId: selected.id,
            formData: values,
            responsiblePersonId,
            priority,
            ...(title.trim() ? { title: title.trim() } : {}),
            ...(dueDate ? { dueDate } : {}),
            ...(auditRef.trim() ? { auditRef: auditRef.trim() } : {}),
          });
      toast.success(
        editing
          ? `${saved.id} resubmitted for approval`
          : `${saved.id} submitted for admin approval`,
      );
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Unable to save nonconformance",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit & resubmit nonconformance" : "Raise nonconformance"}
          </DialogTitle>
          <DialogDescription>
            Uses the existing concern template. After submit, Company Admin must
            approve before it is assigned.
          </DialogDescription>
        </DialogHeader>

        {step === "pick" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {concernTemplates.map((t) => (
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
                    <FileWarning className="size-4 text-muted-foreground" />
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
            {concernTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                No concern templates available.
              </p>
            ) : null}
          </div>
        ) : selected ? (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="nc-title">Title (optional)</Label>
                <Input
                  id="nc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Defaults from observation details"
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label>Responsible person</Label>
                <Select
                  value={responsiblePersonId}
                  onValueChange={setResponsiblePersonId}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignees.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} · {u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nc-due">Due date</Label>
                <Input
                  id="nc-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Low", "Medium", "High", "Critical"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nc-audit">Audit reference (optional)</Label>
                <Input
                  id="nc-audit"
                  value={auditRef}
                  onChange={(e) => setAuditRef(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            {editing?.rejectionReason ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                <p className="font-medium text-destructive">Rejection reason</p>
                <p className="mt-1 text-muted-foreground">{editing.rejectionReason}</p>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-border bg-muted/20 p-3">
              {renderDocumentTemplate(selected, {
                values,
                onChange: setField,
                editable: true,
              })}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "fill" && !editing ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setStep("pick")}
              disabled={saving}
            >
              Back
            </Button>
          ) : null}
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
              onClick={() => void handleSubmit()}
              disabled={saving || !selected}
            >
              <Save />
              {saving
                ? "Submitting…"
                : editing
                  ? "Resubmit for approval"
                  : "Submit for approval"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
