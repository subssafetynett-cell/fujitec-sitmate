import type { Template } from "@/data/sheq";
import { SignaturePad } from "@/components/sheq/signature-pad";
import {
  DocumentChrome,
  EditableValue,
  type DocumentFormBindings,
} from "./chrome";
import { cn } from "@/lib/utils";

type DocProps = { template: Template } & DocumentFormBindings;

const DAYS = [
  { key: "mon", label: "MON" },
  { key: "tue", label: "TUE" },
  { key: "wed", label: "WED" },
  { key: "thur", label: "THUR" },
  { key: "fri", label: "FRI" },
  { key: "sat", label: "SAT" },
  { key: "sun", label: "SUN" },
] as const;

const CHECK_ITEMS = [
  "The hoist must have a valid safety certificate",
  "Visual inspection of the base for any damage",
  "Visual inspection of access and egress at base",
  "Visual inspection of machine guarding",
  "Visual inspection of hoist way for any obstructions",
  "Visual inspection of cables",
  "Visual inspection of mast for damage and missing bolts",
  "Visual inspection of hoist platform for any damage",
  "Check signage for SWL and ID number",
  "Check emergency evacuation tools are in place",
  "Physical check of control panel isolator and stop switch.",
  "Physical check of gate interlock if fitted",
  "Physical check of top and bottom limits",
  "Physical check of brake stopping distance in both directions",
] as const;

const INFO_FIELDS = [
  { key: "project", label: "PROJECT" },
  { key: "supervisor", label: "SUPERVISOR" },
  { key: "serialNumber", label: "SERIAL NUMBER" },
  { key: "installationTestDate", label: "INSTALLATION TEST DATE:" },
  { key: "certNo", label: "CERT NO:" },
  { key: "expiryDate", label: "EXPIRY DATE:" },
] as const;

function DayCheck({
  fieldKey,
  values,
  onChange,
  editable,
}: { fieldKey: string } & DocumentFormBindings) {
  const checked =
    (values?.[fieldKey] || "").toLowerCase() === "true" ||
    values?.[fieldKey] === "1";

  if (editable && onChange) {
    return (
      <label className="flex min-h-9 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          className="size-3.5 accent-neutral-800"
          checked={checked}
          aria-label={fieldKey}
          onChange={(e) => onChange(fieldKey, e.target.checked ? "true" : "")}
        />
      </label>
    );
  }

  return (
    <div className="flex min-h-9 items-center justify-center">
      <span
        className={cn(
          "inline-block size-3.5 border border-neutral-700",
          checked && "bg-neutral-800",
        )}
      />
    </div>
  );
}

function DaySignature({
  fieldKey,
  label,
  values,
  onChange,
  editable,
}: { fieldKey: string; label: string } & DocumentFormBindings) {
  const value = values?.[fieldKey] || "";
  const isDrawn = value.startsWith("data:image");

  if (!editable && value && !isDrawn) {
    return (
      <EditableValue
        fieldKey={fieldKey}
        values={values}
        editable={false}
        className="min-h-12 text-xs"
      />
    );
  }

  if (editable && onChange) {
    return (
      <SignaturePad
        value={isDrawn ? value : ""}
        height={44}
        label={label}
        className="bg-amber-50/40"
        onChange={(v) => onChange(fieldKey, v)}
      />
    );
  }

  return (
    <SignaturePad
      value={isDrawn ? value : ""}
      readOnly
      height={44}
      label={label}
      className="bg-white"
    />
  );
}

export function AlimakWeeklyCheckDocument({
  template,
  values,
  onChange,
  editable,
}: DocProps) {
  const bind = { values, onChange, editable };

  return (
    <DocumentChrome
      className="alimak-weekly-check-doc"
      meta={{
        title: "Alimak Weekly Check",
        documentNo: template.documentNo || template.code || "",
        approvedBy: template.approvedBy || "",
        dateLabel: values?.date || "",
        pageLabel: values?.pageLabel || "Page 1 of 1",
        logoLeft: values?.logoLeft || template.logoLeft,
        logoRight: values?.logoRight || template.logoRight,
      }}
      {...bind}
    >
      <div className="border-b border-black px-3 py-2 text-center text-base font-bold uppercase tracking-wide">
        Alimak Weekly Check
      </div>

      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          {INFO_FIELDS.map((f) => (
            <col key={f.key} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-neutral-200">
            {INFO_FIELDS.map((f) => (
              <th
                key={f.key}
                className="border border-black px-1.5 py-2 text-left text-[10px] font-semibold uppercase leading-snug"
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {INFO_FIELDS.map((f) => (
              <td key={f.key} className="border border-black p-0">
                <EditableValue
                  fieldKey={f.key}
                  {...bind}
                  className="min-h-9 px-1.5 text-xs"
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[55%]" />
          <col className="w-[20%]" />
          <col className="w-[10%]" />
          <col className="w-[15%]" />
        </colgroup>
        <tbody>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left text-xs font-semibold uppercase">
              Week ending: Sunday
            </th>
            <td className="border border-black p-0">
              <EditableValue
                fieldKey="weekEnding"
                {...bind}
                className="min-h-9 px-2 text-xs"
              />
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left text-xs font-semibold uppercase">
              Lift No.
            </th>
            <td className="border border-black p-0">
              <EditableValue
                fieldKey="liftNo"
                {...bind}
                className="min-h-9 px-2 text-xs"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-[44px]" />
            <col />
            {DAYS.map((d) => (
              <col key={d.key} className="w-[52px]" />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-neutral-200">
              <th className="border border-black px-1 py-2 text-center text-[10px] font-semibold uppercase">
                Item
              </th>
              <th className="border border-black px-2 py-2 text-left text-[10px] font-semibold uppercase">
                Checking List
              </th>
              {DAYS.map((d) => (
                <th
                  key={d.key}
                  className="border border-black px-1 py-2 text-center text-[10px] font-semibold uppercase"
                >
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CHECK_ITEMS.map((item, index) => {
              const n = index + 1;
              return (
                <tr key={n} className="align-middle">
                  <td className="border border-black px-1 py-1.5 text-center font-medium tabular-nums">
                    {n}
                  </td>
                  <td className="border border-black px-2 py-1.5 text-left leading-snug text-neutral-900">
                    {item}
                  </td>
                  {DAYS.map((d) => (
                    <td key={d.key} className="border border-black p-0">
                      <DayCheck
                        fieldKey={`alimak_item_${n}_${d.key}`}
                        {...bind}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="align-middle">
              <td className="border border-black px-1 py-2 text-center font-medium">
                —
              </td>
              <td className="border border-black px-2 py-2 text-left text-xs font-bold uppercase">
                Signature
              </td>
              {DAYS.map((d) => (
                <td key={d.key} className="border border-black p-0 align-top">
                  <DaySignature
                    fieldKey={`alimak_sig_${d.key}`}
                    label={`${d.label} signature`}
                    {...bind}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="border-t border-black px-3 py-3 text-[10px] leading-relaxed text-neutral-500">
        The electronic version of this document is the latest revision. It is the
        responsibility of the individual to ensure that any paper material is the
        current revision. The printed version of this document is uncontrolled.
      </p>
    </DocumentChrome>
  );
}
