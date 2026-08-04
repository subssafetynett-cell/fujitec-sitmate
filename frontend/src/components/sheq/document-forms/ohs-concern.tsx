import { useRef, type ChangeEvent, type ReactNode } from "react";
import { FileUp, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Template } from "@/data/sheq";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload";
import { cn } from "@/lib/utils";
import {
  DocumentChrome,
  EditableValue,
  type DocumentFormBindings,
} from "./chrome";

const OHS_INCIDENT_CLASSES = [
  "Slip, trip, or fall",
  "Unsafe working at height",
  "Failure / misuse of equipment",
  "Electrical hazard",
  "Traffic movement",
  "Exposure to machinery",
  "Welfare issue",
  "Threatening behaviour",
  "Poor site access / egress",
  "Falling objects / equipment",
  "Mechanical hazards",
  "Exposure to harmful substances",
  "Fire hazard",
  "Noise / vibration",
  "Mesh lift shaft",
  "Stored energy (hydraulic)",
  "Open lattice car / gates",
  "No emergency intercom",
  "Unsafe wiring",
  "Unguarded machine",
  "No emergency stop",
  "Inadequate lift partition",
  "Inadequate lighting",
  "Unsafe machine room access",
  "Unsafe lift pit access",
  "Slipping on steps / landing",
  "Entrapment risks",
  "Trapping between skirting / step",
  "Sharp edges",
  "Unsafe scaffolding / platforms",
] as const;

const QUALITY_INCIDENT_CLASSES = [
  "Poor control and levelling accuracy",
  "Doors with no non-contact protection",
  "Obsolete components",
  "No form of signalisation",
  "Unlocking landing door without special tool",
  "No scope for future refurbishment",
  "No / inadequate balustrade on car",
  "No protection against ascending car overspeed",
  "No / inadequate load control",
  "Passenger behaviour",
  "Incorrect design of people flows",
  "Poor workmanship during installation",
  "Guiderails not aligned",
  "Landing doors not aligned",
  "Incorrect wiring",
  "Competence to perform task",
  "Communication issue",
  "Brake adjustments",
  "Switches and fuses",
  "User interface and fault codes",
  "Faulty controller",
  "Faulty car top controller",
  "Bearing malfunction or loud bearing",
] as const;

const SUSTAINABILITY_INCIDENT_CLASSES = [
  "Waste segregation",
  "Oil, chemical spillages",
  "COSHH chemical storage",
  "Hazardous materials apparent, e.g., asbestos",
  "Emissions from scope of work",
  "Standing water",
  "Dust and air quality",
  "Vermin, protected species",
  "Excrement, effluent, needles",
  "No waste transfer / consignment notes",
  "Energy performance of lifts",
] as const;

const DEFAULT_INCIDENT_CLASSES = [
  "Occupational Health & Safety",
  "Environmental",
  "Quality",
  "Good Practice",
  "Near Miss",
  "Unsafe Act",
  "Unsafe Condition",
  "Improvement Suggestion",
] as const;

const NC_CATEGORIES = [
  "Occupational Health & Safety",
  "Environmental",
  "Quality",
  "Good Practice",
  "Near Miss",
  "Unsafe Act",
  "Unsafe Condition",
  "Improvement Suggestion",
] as const;
const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
const STATUSES = ["Open", "Opened", "Assigned", "In Progress", "Verification", "Closed"] as const;

export type ConcernFormTitles = {
  chromeTitle: string;
  bannerTitle: string;
};

type Props = {
  template: Template;
  titles: ConcernFormTitles;
  classificationOptions?: readonly string[];
  classificationHint?: string;
} & DocumentFormBindings;

function Section({ n, title, children }: { n: number | string; title: string; children: ReactNode }) {
  return (
    <div className="border-b border-black last:border-b-0">
      <div className="bg-neutral-100 px-3 py-2 text-sm font-bold uppercase tracking-wide text-neutral-900">
        {n} · {title}
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

function LabeledField({
  label,
  fieldKey,
  values,
  onChange,
  editable,
  multiline,
  required,
  className,
}: DocumentFormBindings & {
  label: string;
  fieldKey: string;
  multiline?: boolean;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-800">
        {label}
        {required ? " *" : ""}
      </div>
      <EditableValue
        fieldKey={fieldKey}
        values={values}
        onChange={onChange}
        editable={editable}
        multiline={multiline}
        placeholder="—"
        className={cn("mt-0.5 px-0", multiline && "min-h-16")}
      />
    </div>
  );
}

function SelectField({
  label,
  fieldKey,
  options,
  values,
  onChange,
  editable,
  required,
}: DocumentFormBindings & {
  label: string;
  fieldKey: string;
  options: readonly string[];
  required?: boolean;
}) {
  const value = values?.[fieldKey] ?? "";
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-800">
        {label}
        {required ? " *" : ""}
      </div>
      {editable && onChange ? (
        <select
          className="mt-1 h-9 w-full rounded-md border border-black bg-amber-50/40 px-2 text-sm outline-none focus:ring-1 focus:ring-neutral-400"
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <div className="mt-0.5 min-h-9 py-1 text-sm text-neutral-700">{value || "—"}</div>
      )}
    </div>
  );
}

function ClassificationField({
  values,
  onChange,
  editable,
  options,
  hint,
}: DocumentFormBindings & { options: readonly string[]; hint?: string }) {
  const selected = new Set(
    (values?.incidentClassification ?? "")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s && s !== "Other"),
  );
  const otherValue = values?.incidentClassificationOther ?? "";

  function toggle(item: string) {
    if (!onChange) return;
    const next = new Set(selected);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    onChange("incidentClassification", Array.from(next).join("|"));
  }

  const summaryParts = [
    ...Array.from(selected),
    ...(otherValue.trim() ? [`Other: ${otherValue.trim()}`] : []),
  ];

  return (
    <div>
      {hint ? (
        <p className="mt-1 text-sm italic text-neutral-600">{hint}</p>
      ) : null}
      {editable && onChange ? (
        <div className="mt-2 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((item) => (
              <label
                key={item}
                className="flex cursor-pointer items-start gap-2 text-sm text-neutral-800"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 shrink-0 accent-neutral-800"
                  checked={selected.has(item)}
                  onChange={() => toggle(item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-800">
              Other
            </div>
            <EditableValue
              fieldKey="incidentClassificationOther"
              values={values}
              onChange={onChange}
              editable={editable}
              placeholder="Enter other incident type"
              className="mt-0.5 px-0"
            />
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm text-neutral-700">
          {summaryParts.length > 0 ? summaryParts.join(", ") : "None selected"}
        </p>
      )}
    </div>
  );
}

function isDataUrl(value: string) {
  return value.startsWith("data:");
}

function isImageDataUrl(value: string) {
  return value.startsWith("data:image/");
}

function PhotoField({
  label,
  fieldKey,
  values,
  onChange,
  editable,
}: DocumentFormBindings & { label: string; fieldKey: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const value = values?.[fieldKey] ?? "";
  const fileName = values?.[`${fieldKey}Name`] ?? "";

  function clearFile() {
    if (!onChange) return;
    onChange(fieldKey, "");
    onChange(`${fieldKey}Name`, "");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onChange) return;

    const okType =
      file.type.startsWith("image/") ||
      file.type === "application/pdf" ||
      file.type === "application/msword" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!okType) {
      toast.error("Choose an image, PDF, or Word document");
      e.target.value = "";
      return;
    }

    try {
      const { url, uploaded } = await uploadFileToCloudinary(file, {
        folder: "sheq-harmony/concerns",
        resourceType: file.type.startsWith("image/") ? "image" : "auto",
        maxBytes: 2_000_000,
      });
      onChange(fieldKey, url);
      onChange(`${fieldKey}Name`, file.name);
      if (uploaded) toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to upload file");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-800">
        {label}
      </div>

      {editable && onChange ? (
        <div className="mt-1 rounded-md border border-dashed border-black bg-amber-50/40 p-3">
          {value ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {isImageDataUrl(value) ? (
                <img
                  src={value}
                  alt={fileName || label}
                  className="max-h-28 max-w-full rounded border border-neutral-200 object-contain bg-white"
                />
              ) : (
                <div className="flex min-h-16 flex-1 items-center gap-2 rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700">
                  <FileUp className="size-4 shrink-0 text-neutral-500" />
                  <span className="truncate">{fileName || "File attached"}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-black bg-white px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  onClick={() => inputRef.current?.click()}
                >
                  <ImagePlus className="size-3.5" />
                  Replace
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-black bg-white px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  onClick={clearFile}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-md px-3 py-5 text-center transition-colors hover:bg-amber-50"
            >
              <ImagePlus className="size-5 text-neutral-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                Upload file
              </span>
              <span className="text-[11px] text-neutral-500">
                Image, PDF or Word · max 2MB
              </span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,application/pdf"
            className="sr-only"
            onChange={(e) => void onFile(e)}
            aria-label={label}
          />
        </div>
      ) : value ? (
        <div className="mt-1">
          {isImageDataUrl(value) ? (
            <img
              src={value}
              alt={fileName || label}
              className="max-h-36 max-w-full rounded border border-neutral-200 object-contain"
            />
          ) : isDataUrl(value) ? (
            <a
              href={value}
              download={fileName || label}
              className="inline-flex items-center gap-2 text-sm text-neutral-700 underline"
            >
              <FileUp className="size-4" />
              {fileName || "Download attached file"}
            </a>
          ) : (
            <p className="text-sm text-neutral-700">{fileName || value}</p>
          )}
        </div>
      ) : (
        <p className="mt-0.5 text-sm italic text-neutral-600">No file provided</p>
      )}
    </div>
  );
}

export function ConcernReportDocument({
  template,
  titles,
  classificationOptions = DEFAULT_INCIDENT_CLASSES,
  classificationHint,
  values,
  onChange,
  editable,
}: Props) {
  const bind = { values, onChange, editable };

  return (
    <DocumentChrome
      meta={{
        title: titles.chromeTitle,
        documentNo: values?.documentNo || template.documentNo || "",
        approvedBy: values?.approvedBy || template.approvedBy || "",
        dateLabel: values?.date || "",
        logoLeft: template.logoLeft,
        logoRight: template.logoRight,
      }}
      {...bind}
    >
      <div className="border-b border-black px-3 py-3 text-center text-base font-bold uppercase tracking-wide">
        {titles.bannerTitle}
      </div>

      <div className="grid grid-cols-2 border-b border-black text-sm">
        <div className="border-r border-black px-3 py-3">
          <SelectField label="Status" fieldKey="status" options={STATUSES} {...bind} />
        </div>
        <div className="px-3 py-3">
          <LabeledField label="Report reference" fieldKey="reportReference" {...bind} />
        </div>
      </div>

      <Section n={1} title="Project details">
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField label="Report date" fieldKey="reportDate" {...bind} />
          <LabeledField label="Customer reference" fieldKey="customerReference" {...bind} />
          <LabeledField label="Project name" fieldKey="projectName" {...bind} />
          <LabeledField label="Customer name" fieldKey="customerName" {...bind} />
        </div>
      </Section>

      <Section n={2} title="Management & contacts">
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField label="Manager" fieldKey="manager" {...bind} />
          <LabeledField label="Supervisor" fieldKey="supervisor" {...bind} />
          <LabeledField
            label="Responsible engineer(s)"
            fieldKey="responsibleEngineers"
            {...bind}
          />
          <LabeledField label="Site contact" fieldKey="siteContact" {...bind} />
        </div>
      </Section>

      <Section n={3} title="Location details">
        <div className="grid gap-4">
          <LabeledField label="Full address" fieldKey="fullAddress" multiline {...bind} />
          <LabeledField
            label="Exact location of incident"
            fieldKey="exactLocation"
            multiline
            {...bind}
          />
        </div>
      </Section>

      <Section n={4} title="Incident classification">
        <ClassificationField
          options={classificationOptions}
          hint={classificationHint}
          {...bind}
        />
      </Section>

      <Section n={5} title="Observations & suggestions">
        <div className="grid gap-4">
          <LabeledField
            label="Observation details"
            fieldKey="observationDetails"
            multiline
            {...bind}
          />
          <PhotoField label="Observation photo" fieldKey="observationPhoto" {...bind} />
          <LabeledField
            label="Corrective action proposed"
            fieldKey="correctiveActionProposed"
            multiline
            {...bind}
          />
          <PhotoField label="Supporting photo" fieldKey="supportingPhoto" {...bind} />
        </div>
      </Section>

      <Section n={6} title="Nonconformance">
        <div className="grid gap-4">
          <LabeledField
            label="Correction action"
            fieldKey="correctionAction"
            multiline
            {...bind}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Category"
              fieldKey="ncCategory"
              options={NC_CATEGORIES}
              {...bind}
            />
            <SelectField
              label="Priority"
              fieldKey="priority"
              options={PRIORITIES}
              {...bind}
            />
            <LabeledField
              label="Assignee (responsible person)"
              fieldKey="assignee"
              required
              {...bind}
            />
            <LabeledField label="Due date" fieldKey="dueDate" required {...bind} />
          </div>
          <PhotoField
            label="Nonconformance photo"
            fieldKey="nonconformancePhoto"
            {...bind}
          />
        </div>
      </Section>

    </DocumentChrome>
  );
}

export function OhsConcernDocument(props: Omit<Props, "titles" | "classificationOptions">) {
  return (
    <ConcernReportDocument
      {...props}
      titles={{
        chromeTitle: "Occupational Health and Safety Concern",
        bannerTitle: "Health and Safety Concern",
      }}
      classificationOptions={OHS_INCIDENT_CLASSES}
    />
  );
}

export function QualityConcernDocument(
  props: Omit<Props, "titles" | "classificationOptions">,
) {
  return (
    <ConcernReportDocument
      {...props}
      titles={{
        chromeTitle: "Quality Concern",
        bannerTitle: "Quality Concern",
      }}
      classificationOptions={QUALITY_INCIDENT_CLASSES}
    />
  );
}

export function GoodPracticeDocument(
  props: Omit<Props, "titles" | "classificationOptions" | "classificationHint">,
) {
  return (
    <ConcernReportDocument
      {...props}
      titles={{
        chromeTitle: "Good Practice",
        bannerTitle: "Positive Observation",
      }}
    />
  );
}

export function SustainabilityConcernDocument(
  props: Omit<Props, "titles" | "classificationOptions" | "classificationHint">,
) {
  return (
    <ConcernReportDocument
      {...props}
      titles={{
        chromeTitle: "Sustainability Concern",
        bannerTitle: "Sustainability Concern",
      }}
      classificationOptions={SUSTAINABILITY_INCIDENT_CLASSES}
      classificationHint="Select one or more environmental or sustainability incidents"
    />
  );
}
