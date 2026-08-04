import { useRef, useState, type ChangeEvent } from "react";
import { Building2, ImagePlus, Loader2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/sheq/signature-pad";
import type { Template } from "@/data/sheq";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
const ATTENDEE_ROWS = 10;

export type ToolboxTalkAttendee = {
  name: string;
  signature: string;
  date: string;
};

export type ToolboxTalkFormState = {
  name: string;
  date: string;
  documentNo: string;
  approvedBy: string;
  presenter: string;
  talkDate: string;
  site: string;
  topic: string;
  consultation: string;
  logoLeft: string;
  logoRight: string;
  attendees: ToolboxTalkAttendee[];
  presenterSignature: string;
};

type Props = {
  value: ToolboxTalkFormState;
  onChange?: (next: ToolboxTalkFormState) => void;
  readOnly?: boolean;
  className?: string;
};

function emptyAttendees(): ToolboxTalkAttendee[] {
  return Array.from({ length: ATTENDEE_ROWS }, () => ({
    name: "",
    signature: "",
    date: "",
  }));
}

function normalizeAttendees(rows?: ToolboxTalkAttendee[]): ToolboxTalkAttendee[] {
  const base = emptyAttendees();
  if (!rows?.length) return base;
  return base.map((row, i) => ({
    name: rows[i]?.name ?? "",
    signature: rows[i]?.signature ?? "",
    date: rows[i]?.date ?? "",
  }));
}

function LogoSlot({
  label,
  logo,
  readOnly,
  onLogo,
}: {
  label: string;
  logo: string;
  readOnly?: boolean;
  onLogo?: (dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onLogo) return;
    setUploading(true);
    try {
      const { url, uploaded } = await uploadFileToCloudinary(file, {
        folder: "sheq-harmony/logos",
        resourceType: "image",
        acceptImageOnly: true,
      });
      onLogo(url);
      if (uploaded) toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to upload logo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (readOnly) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center border border-black bg-white p-3">
        {logo ? (
          <img src={logo} alt={`${label} logo`} className="max-h-20 max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-neutral-400">
            <Building2 className="size-6" />
            <span className="text-[10px] uppercase tracking-wide">Logo</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 border border-black bg-white p-2">
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-black bg-neutral-50 px-2 py-3 text-center transition-colors hover:bg-neutral-100 disabled:opacity-60"
      >
        {uploading ? (
          <>
            <Loader2 className="size-6 animate-spin text-neutral-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
              Uploading…
            </span>
          </>
        ) : logo ? (
          <img src={logo} alt={`${label} logo`} className="max-h-16 max-w-full object-contain" />
        ) : (
          <>
            <ImagePlus className="size-6 text-neutral-500" />
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
              <Upload className="size-3" />
              Upload logo
            </span>
          </>
        )}
      </button>
      {logo && !uploading ? (
        <button
          type="button"
          className="text-[11px] text-neutral-600 underline"
          onClick={() => onLogo?.("")}
        >
          Remove logo
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void onFile(e)}
        aria-label={label}
        disabled={uploading}
      />
    </div>
  );
}

function MetaFieldCell({
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  if (readOnly) {
    return (
      <div className="flex min-h-9 items-center px-2 text-sm text-neutral-800">
        {value || <span className="text-neutral-400">—</span>}
      </div>
    );
  }
  return (
    <Input
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className="h-9 rounded-none border-0 bg-amber-50/40 shadow-none focus-visible:ring-0"
    />
  );
}

function CellInput({
  value,
  onChange,
  readOnly,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  type?: string;
}) {
  if (readOnly) {
    return (
      <div className="flex min-h-9 items-center px-2 text-sm text-neutral-800">
        {value || <span className="text-neutral-300">&nbsp;</span>}
      </div>
    );
  }
  return (
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className="h-9 rounded-none border-0 bg-amber-50/40 shadow-none focus-visible:ring-0"
    />
  );
}

export function ToolboxTalkRegisterForm({
  value,
  onChange,
  readOnly = false,
  className,
}: Props) {
  const attendees = normalizeAttendees(value.attendees);

  const set = <K extends keyof ToolboxTalkFormState>(key: K, v: ToolboxTalkFormState[K]) => {
    if (readOnly || !onChange) return;
    onChange({ ...value, attendees, [key]: v });
  };

  function setAttendee(index: number, patch: Partial<ToolboxTalkAttendee>) {
    if (readOnly || !onChange) return;
    const next = attendees.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange({ ...value, attendees: next });
  }

  return (
    <div
      className={cn(
        "overflow-hidden border-2 border-neutral-700 bg-white text-neutral-900 shadow-sm",
        className,
      )}
    >
      <table className="w-full border-collapse">
        <tbody>
          <tr className="align-stretch">
            <td className="w-[140px] border-b-2 border-neutral-700 p-0 align-middle">
              <LogoSlot
                label="Left logo"
                logo={value.logoLeft}
                readOnly={readOnly}
                onLogo={(logo) => set("logoLeft", logo)}
              />
            </td>
            <td className="border-x border-b-2 border-black border-b-neutral-700 p-0 align-top">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr>
                    <td
                      colSpan={3}
                      className="border-b border-black px-2 py-3 text-center text-sm font-bold uppercase tracking-wide"
                    >
                      Tool Box Talk Register
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[130px] border-b border-r border-black px-2 py-2">
                      Date
                    </td>
                    <td colSpan={2} className="border-b border-black p-0">
                      <CellInput
                        value={value.date}
                        readOnly={readOnly}
                        onChange={(v) => set("date", v)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border-b border-r border-black px-2 py-2">
                      Document No. &amp; Rev
                    </td>
                    <td colSpan={2} className="border-b border-black p-0">
                      <CellInput
                        value={value.documentNo}
                        readOnly={readOnly}
                        onChange={(v) => set("documentNo", v)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border-r border-black px-2 py-2">Approved by</td>
                    <td className="p-0">
                      <CellInput
                        value={value.approvedBy}
                        readOnly={readOnly}
                        onChange={(v) => set("approvedBy", v)}
                      />
                    </td>
                    <td className="w-[90px] border-l border-black px-2 py-2 text-xs text-neutral-600">
                      Page 1 of 1
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td className="w-[140px] border-b-2 border-neutral-700 p-0 align-middle">
              <LogoSlot
                label="Right logo"
                logo={value.logoRight}
                readOnly={readOnly}
                onLogo={(logo) => set("logoRight", logo)}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse border-b-2 border-neutral-700 text-sm">
        <tbody>
          {(
            [
              ["Name of Presenter", value.presenter, "presenter"],
              ["Date", value.talkDate, "talkDate"],
              ["Site", value.site, "site"],
              ["Tool Box Talk Topic", value.topic, "topic"],
            ] as const
          ).map(([label, fieldValue, key]) => (
            <tr key={key}>
              <th className="w-[180px] border border-black bg-white px-2 py-2 text-left font-medium text-neutral-800">
                {label}
              </th>
              <td className="border border-black bg-white p-0">
                <MetaFieldCell
                  value={fieldValue}
                  readOnly={readOnly}
                  onChange={(v) => set(key, v)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="border-b border-black px-3 py-3 text-sm leading-relaxed text-neutral-800">
        The undersigned have been fully briefed on the contents of the attached Tool Box Talk and
        will ensure they work to the agreed safe system of work in place at all times and shall
        raise any concerns directly with the Site Supervisor or Director.
      </p>

      <div className="overflow-x-auto border-b-2 border-neutral-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-200 text-left font-semibold">
              <th className="w-10 border border-black px-2 py-2">#</th>
              <th className="border border-black px-2 py-2">Print Name</th>
              <th className="min-w-[180px] border border-black px-2 py-2">
                Signature
              </th>
              <th className="w-[120px] border border-black px-2 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {attendees.map((row, i) => (
              <tr key={i} className="align-middle">
                <td className="border border-black px-2 py-2 text-center text-neutral-700">
                  {i + 1}
                </td>
                <td className="min-h-12 border border-black p-0">
                  <CellInput
                    value={row.name}
                    readOnly={readOnly}
                    placeholder="Print name"
                    onChange={(v) => setAttendee(i, { name: v })}
                  />
                </td>
                <td className="min-h-12 border border-black p-0">
                  <SignaturePad
                    value={row.signature}
                    readOnly={readOnly}
                    height={56}
                    label={`Attendee ${i + 1} signature`}
                    onChange={(v) => setAttendee(i, { signature: v })}
                  />
                </td>
                <td className="min-h-12 border border-black p-0">
                  <CellInput
                    value={row.date}
                    readOnly={readOnly}
                    placeholder="DD/MM/YYYY"
                    onChange={(v) => setAttendee(i, { date: v })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-b border-black px-3 py-3">
        <p className="mb-2 text-sm font-semibold italic underline">
          Consultation (record all consultation comments raised during the tool box talk)
        </p>
        {readOnly ? (
          <div className="min-h-28 whitespace-pre-wrap px-1 py-2 text-sm text-neutral-800">
            {value.consultation || ""}
          </div>
        ) : (
          <Textarea
            value={value.consultation}
            onChange={(e) => set("consultation", e.target.value)}
            rows={5}
            className="rounded-none border-black bg-amber-50/40 shadow-none focus-visible:ring-0"
          />
        )}
      </div>

      <div className="px-3 py-5">
        <div className="w-full max-w-xs">
          <SignaturePad
            value={value.presenterSignature || ""}
            readOnly={readOnly}
            height={72}
            label="Presenter signature"
            className="border-0 bg-transparent"
            onChange={(v) => set("presenterSignature", v)}
          />
        </div>
        <div className="mt-1 w-56 border-b border-neutral-800" />
        <p className="mt-1 text-sm font-medium">Signature</p>
      </div>

      {!readOnly ? (
        <div className="border-t border-black px-3 py-2 pdf-hide">
          <label className="text-xs text-neutral-500">Template name</label>
          <Input
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Tool Box Talk Register"
            className="mt-1 h-9 rounded-lg"
          />
        </div>
      ) : null}
    </div>
  );
}

export function StandardTemplatePreview({ template }: { template: Template }) {
  const sampleFields = [
    "Reference / ID",
    "Inspection date",
    "Site",
    "Inspector",
    "Findings",
    "Corrective actions",
    "Evidence photos",
    "Signature",
  ].slice(0, Math.max(4, Math.min(template.fields, 8)));

  return (
    <div className="overflow-hidden border-2 border-neutral-700 bg-white text-neutral-900 shadow-sm">
      <div className="border-b-2 border-neutral-700 px-4 py-4 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">{template.category}</p>
        <h3 className="mt-1 text-lg font-bold uppercase">{template.name}</h3>
        <p className="mt-1 text-xs text-neutral-600">
          {template.version} · {template.fields} fields · Updated {template.updated}
        </p>
      </div>
      <div className="grid grid-cols-3 border-b border-black text-sm">
        <div className="border-r border-black px-3 py-2">
          <p className="text-xs text-neutral-500">Status</p>
          <p className="font-medium">{template.status}</p>
        </div>
        <div className="border-r border-black px-3 py-2">
          <p className="text-xs text-neutral-500">Template ID</p>
          <p className="font-medium">{template.id}</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-xs text-neutral-500">Submissions</p>
          <p className="font-medium">{template.uses}</p>
        </div>
      </div>
      <div className="border-b border-black bg-neutral-100 px-3 py-2 text-sm font-semibold">
        Form structure preview
      </div>
      {sampleFields.map((label, i) => (
        <div
          key={label}
          className="grid grid-cols-[40px_minmax(0,1fr)] border-b border-black last:border-b-0"
        >
          <div className="border-r border-black px-2 py-3 text-center text-sm text-neutral-600">
            {i + 1}
          </div>
          <div className="px-3 py-3">
            <p className="text-sm font-medium">{label}</p>
            <div className="mt-2 h-8 rounded-sm border border-black bg-neutral-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const emptyToolboxTalkForm = (): ToolboxTalkFormState => ({
  name: "Tool Box Talk Register",
  date: "",
  documentNo: "",
  approvedBy: "",
  presenter: "",
  talkDate: "",
  site: "",
  topic: "",
  consultation: "",
  logoLeft: "",
  logoRight: "",
  attendees: emptyAttendees(),
  presenterSignature: "",
});

export function isToolboxTalkTemplate(template: Template) {
  return (
    template.kind === "toolbox-talk" ||
    /toolbox|tool box/i.test(template.name)
  );
}

export function formFromTemplate(template: Template): ToolboxTalkFormState {
  return {
    name: template.name,
    date: "",
    documentNo: "",
    approvedBy: "",
    presenter: "",
    talkDate: "",
    site: "",
    topic: "",
    consultation: "",
    logoLeft: template.logoLeft ?? "",
    logoRight: template.logoRight ?? "",
    attendees: emptyAttendees(),
    presenterSignature: "",
  };
}

/** Flatten toolbox talk state into string map for pack form storage. */
export function valuesFromToolbox(state: ToolboxTalkFormState): Record<string, string> {
  const out: Record<string, string> = {
    name: state.name,
    date: state.date,
    documentNo: state.documentNo,
    approvedBy: state.approvedBy,
    presenter: state.presenter,
    talkDate: state.talkDate,
    site: state.site,
    topic: state.topic,
    consultation: state.consultation,
    logoLeft: state.logoLeft,
    logoRight: state.logoRight,
    presenterSignature: state.presenterSignature || "",
  };
  normalizeAttendees(state.attendees).forEach((row, i) => {
    out[`signoff_${i}_name`] = row.name;
    out[`signoff_${i}_signature`] = row.signature;
    out[`signoff_${i}_date`] = row.date;
  });
  return out;
}

/** Rebuild toolbox talk state from a packed string map. */
export function toolboxFromValues(values: Record<string, string>): ToolboxTalkFormState {
  return {
    name: values.name || "Tool Box Talk Register",
    date: values.date || "",
    documentNo: values.documentNo || "",
    approvedBy: values.approvedBy || "",
    presenter: values.presenter || "",
    talkDate: values.talkDate || "",
    site: values.site || "",
    topic: values.topic || "",
    consultation: values.consultation || "",
    logoLeft: values.logoLeft || "",
    logoRight: values.logoRight || "",
    presenterSignature: values.presenterSignature || "",
    attendees: Array.from({ length: ATTENDEE_ROWS }, (_, i) => ({
      name: values[`signoff_${i}_name`] || "",
      signature: values[`signoff_${i}_signature`] || "",
      date: values[`signoff_${i}_date`] || "",
    })),
  };
}
