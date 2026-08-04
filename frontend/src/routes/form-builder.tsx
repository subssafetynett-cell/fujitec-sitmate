import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Eye,
  GripVertical,
  Plus,
  Save,
  Send,
  Settings2,
  Trash2,
  PencilRuler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, EmptyState } from "@/components/sheq/primitives";
import type { FieldType } from "@/data/sheq";
import { useSheq } from "@/lib/sheq-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/form-builder")({
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content:
          "Drag-and-drop SHEQ form builder with signatures, photo capture, QR scanning, conditional logic and validation rules.",
      },
      { property: "og:title", content: "Sitemate" },
      { property: "og:description", content: "Build digital inspection and audit forms without code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FormBuilderPage,
});

type Field = {
  uid: string;
  type: FieldType;
  label: string;
  required: boolean;
  help: string;
};

const starter: Field[] = [
  { uid: "f1", type: "heading", label: "Site & inspection details", required: false, help: "" },
  { uid: "f2", type: "text", label: "Inspection reference", required: true, help: "Auto-generated if left blank" },
  { uid: "f3", type: "date", label: "Inspection date", required: true, help: "" },
  { uid: "f4", type: "dropdown", label: "Site", required: true, help: "Pulled from site register" },
  { uid: "f5", type: "image", label: "Evidence photos", required: false, help: "Up to 10 images" },
  { uid: "f6", type: "signature", label: "Inspector signature", required: true, help: "Use a saved signature" },
];

function typeLabel(type: FieldType, formFieldTypes: { key: string; label: string }[]) {
  return formFieldTypes.find((f) => f.key === type)?.label ?? type;
}

function FieldPreview({ field }: { field: Field }) {
  switch (field.type) {
    case "heading":
      return <p className="text-sm font-semibold">{field.label}</p>;
    case "divider":
      return <hr className="border-border" />;
    case "textarea":
    case "richtext":
      return <Textarea placeholder={field.label} className="rounded-xl" rows={3} readOnly />;
    case "checkbox":
    case "radio":
      return (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>○ Yes</span>
          <span>○ No</span>
          <span>○ N/A</span>
        </div>
      );
    case "signature":
      return (
        <div className="grid h-20 place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
          Sign here or insert a saved signature
        </div>
      );
    case "image":
    case "file":
      return (
        <div className="grid h-20 place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
          Drop files or capture a photo
        </div>
      );
    default:
      return <Input placeholder={field.label} className="rounded-xl" readOnly />;
  }
}

function FormBuilderPage() {
  const { formFieldTypes } = useSheq();
  const [fields, setFields] = useState<Field[]>(starter);
  const [selected, setSelected] = useState<string | null>("f2");
  const [dragging, setDragging] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);

  const current = fields.find((f) => f.uid === selected) ?? null;

  const addField = (type: FieldType) => {
    const uid = `f${Date.now()}`;
    setFields((prev) => [
      ...prev,
      { uid, type, label: typeLabel(type, formFieldTypes), required: false, help: "" },
    ]);
    setSelected(uid);
  };

  const update = (uid: string, patch: Partial<Field>) =>
    setFields((prev) => prev.map((f) => (f.uid === uid ? { ...f, ...patch } : f)));

  const remove = (uid: string) => {
    setFields((prev) => prev.filter((f) => f.uid !== uid));
    if (selected === uid) setSelected(null);
  };

  const onDrop = (index: number) => {
    if (dragging === null || dragging === index) return;
    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragging, 1);
      if (moved) next.splice(index, 0, moved);
      return next;
    });
    setDragging(null);
  };

  const groups = [...new Set(formFieldTypes.map((f) => f.group))];

  return (
    <>
      <PageHeader
        title="Form Builder"
        description="Compose digital SHEQ forms by dragging fields onto the canvas. Conditional logic and validation included."
        actions={
          <>
            <Button variant="outline" className="rounded-xl" onClick={() => setPreview((p) => !p)}>
              <Eye /> {preview ? "Edit" : "Preview"}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => toast.success("Draft saved")}>
              <Save /> Save draft
            </Button>
            <Button className="rounded-xl" onClick={() => toast.success("Form published to the template library")}>
              <Send /> Publish
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_290px]">
        <Panel title="Field types" description="Click or drag to add" className="h-fit lg:sticky lg:top-24">
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>
                <div className="flex flex-wrap gap-1.5">
                  {formFieldTypes
                    .filter((f) => f.group === g)
                    .map((f) => (
                      <button
                        key={f.key}
                        onClick={() => addField(f.key)}
                        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {f.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title={preview ? "Form preview" : "Canvas"}
          description={`${fields.length} fields · SHEQ Service Form`}
        >
          {fields.length === 0 ? (
            <EmptyState
              icon={<PencilRuler />}
              title="Your form is empty"
              description="Add a field from the palette to start building this inspection form."
              action={<Button className="rounded-xl" onClick={() => addField("text")}><Plus /> Add text field</Button>}
            />
          ) : (
            <ol className="flex flex-col gap-3">
              {fields.map((f, i) => (
                <li
                  key={f.uid}
                  draggable={!preview}
                  onDragStart={() => setDragging(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(i)}
                  onClick={() => setSelected(f.uid)}
                  className={cn(
                    "group rounded-2xl border border-border bg-card p-4 transition-all",
                    !preview && "cursor-grab hover:border-ring",
                    !preview && selected === f.uid && "border-ring ring-2 ring-ring/40",
                  )}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {!preview && <GripVertical className="size-4 shrink-0 text-muted-foreground" />}
                      <span className="truncate text-sm font-medium">
                        {f.label}
                        {f.required && <span className="ml-1 text-destructive">*</span>}
                      </span>
                    </div>
                    {!preview && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {typeLabel(f.type, formFieldTypes)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${f.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(f.uid);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <FieldPreview field={f} />
                  </div>
                  {f.help && <p className="mt-2 text-xs text-muted-foreground">{f.help}</p>}
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Field settings" description="Validation & logic" className="h-fit lg:sticky lg:top-24">
          {!current ? (
            <p className="text-sm text-muted-foreground">Select a field on the canvas to configure it.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="field-label" className="text-xs">
                  Label
                </Label>
                <Input
                  id="field-label"
                  value={current.label}
                  onChange={(e) => update(current.uid, { label: e.target.value })}
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="field-help" className="text-xs">
                  Helper text
                </Label>
                <Input
                  id="field-help"
                  value={current.help}
                  onChange={(e) => update(current.uid, { help: e.target.value })}
                  placeholder="Guidance for the inspector"
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <Label htmlFor="field-required" className="text-sm">
                  Required
                </Label>
                <Switch
                  id="field-required"
                  checked={current.required}
                  onCheckedChange={(v) => update(current.uid, { required: v })}
                />
              </div>
              <div className="rounded-xl border border-dashed border-border p-3">
                <p className="flex items-center gap-2 text-xs font-medium">
                  <Settings2 className="size-3.5" /> Conditional logic
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Show this field only when a previous answer matches a condition.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full rounded-xl"
                  onClick={() => toast("Condition builder opens here")}
                >
                  Add condition
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
