import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Building2, ImagePlus, Loader2, Upload } from "lucide-react";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type DocumentHeaderMeta = {
  title: string;
  documentNo: string;
  approvedBy?: string;
  dateLabel?: string;
  pageLabel?: string;
  logoLeft?: string;
  logoRight?: string;
};

export type DocumentFormBindings = {
  values?: Record<string, string>;
  onChange?: (key: string, value: string) => void;
  editable?: boolean;
};

function LogoCell({
  logo,
  side,
  editable,
  onChange,
}: {
  logo?: string;
  side: "left" | "right";
  editable?: boolean;
  onChange?: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const label = side === "left" ? "Left logo" : "Right logo";

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onChange) return;
    setUploading(true);
    try {
      const { url, uploaded } = await uploadFileToCloudinary(file, {
        folder: "sheq-harmony/logos",
        resourceType: "image",
        acceptImageOnly: true,
      });
      onChange(url);
      if (uploaded) toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to upload logo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (!editable || !onChange) {
    return (
      <div className="flex min-h-[110px] w-full items-center justify-center bg-white p-2">
        {logo ? (
          <img
            src={logo}
            alt={`${side} logo`}
            className="max-h-20 max-w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-neutral-400">
            <Building2 className="size-6" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Logo</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-[110px] w-full flex-col items-center justify-center gap-1.5 bg-amber-50/40 p-2">
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-1 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-black bg-white/80 px-2 py-2 text-center transition-colors hover:bg-white disabled:opacity-60"
      >
        {uploading ? (
          <>
            <Loader2 className="size-5 animate-spin text-neutral-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
              Uploading…
            </span>
          </>
        ) : logo ? (
          <img
            src={logo}
            alt={`${side} logo`}
            className="max-h-16 max-w-full object-contain"
          />
        ) : (
          <>
            <ImagePlus className="size-5 text-neutral-500" />
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
              <Upload className="size-3" />
              Upload logo
            </span>
          </>
        )}
      </button>
      {logo && !uploading ? (
        <button
          type="button"
          className="text-[10px] text-neutral-600 underline"
          onClick={() => onChange("")}
        >
          Remove
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

export function EditableValue({
  fieldKey,
  values,
  onChange,
  editable,
  className,
  placeholder,
  multiline,
}: DocumentFormBindings & {
  fieldKey: string;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const value = values?.[fieldKey] ?? "";

  if (editable && onChange) {
    if (multiline) {
      return (
        <textarea
          className={cn(
            "min-h-16 w-full resize-y bg-amber-50/40 px-2 py-2 text-sm outline-none ring-inset focus:ring-1 focus:ring-neutral-400",
            className,
          )}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(fieldKey, e.target.value)}
        />
      );
    }
    return (
      <input
        className={cn(
          "min-h-9 w-full bg-amber-50/40 px-2 py-2 text-sm outline-none ring-inset focus:ring-1 focus:ring-neutral-400",
          className,
        )}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(fieldKey, e.target.value)}
      />
    );
  }

  return (
    <div className={cn("min-h-9 px-2 py-2 text-sm text-neutral-700", className)}>
      {value || "\u00a0"}
    </div>
  );
}

export function DocumentChrome({
  meta,
  children,
  className,
  values,
  onChange,
  editable,
}: {
  meta: DocumentHeaderMeta;
  children: ReactNode;
  className?: string;
} & DocumentFormBindings) {
  const bind = { values, onChange, editable };
  const logoLeft = values?.logoLeft || meta.logoLeft || "";
  const logoRight = values?.logoRight || meta.logoRight || "";
  const headerTitle = values?.headerTitle || meta.title;
  const pageLabel = values?.pageLabel || meta.pageLabel || "Page 1 of 1";

  return (
    <div
      className={cn(
        "overflow-visible border-2 border-black bg-white text-neutral-900 shadow-sm",
        className,
      )}
    >
      {/* Real HTML tables so PDF/Word capture includes the header layout. */}
      <table className="w-full border-collapse border-b-2 border-black">
        <tbody>
          <tr>
            <td className="w-[130px] border border-black p-0 align-middle">
              <LogoCell
                logo={logoLeft}
                side="left"
                editable={editable}
                onChange={
                  editable && onChange
                    ? (value) => onChange("logoLeft", value)
                    : undefined
                }
              />
            </td>
            <td className="border border-black p-0 align-top">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr>
                    <td
                      colSpan={3}
                      className="border-b border-black p-0 text-center text-sm font-bold uppercase tracking-wide"
                    >
                      {editable && onChange ? (
                        <input
                          className="w-full bg-amber-50/40 px-2 py-3 text-center text-sm font-bold uppercase tracking-wide outline-none ring-inset focus:ring-1 focus:ring-neutral-400"
                          value={headerTitle}
                          placeholder={meta.title}
                          onChange={(e) => onChange("headerTitle", e.target.value)}
                        />
                      ) : (
                        <div className="px-2 py-3">{headerTitle}</div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[140px] border-b border-r border-black px-2 py-2">
                      Date
                    </td>
                    <td colSpan={2} className="border-b border-black p-0">
                      <EditableValue
                        fieldKey="date"
                        {...bind}
                        placeholder="Enter date"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border-b border-r border-black px-2 py-2">
                      Document No. &amp; Rev
                    </td>
                    <td colSpan={2} className="border-b border-black p-0">
                      <EditableValue
                        fieldKey="documentNo"
                        {...bind}
                        placeholder="Document number"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border-r border-black px-2 py-2">Approved by</td>
                    <td className="p-0">
                      <EditableValue
                        fieldKey="approvedBy"
                        {...bind}
                        placeholder="Approved by"
                      />
                    </td>
                    <td className="w-[100px] border-l border-black p-0 align-middle">
                      {editable && onChange ? (
                        <input
                          className="w-full bg-amber-50/40 px-2 py-2 text-xs text-neutral-700 outline-none ring-inset focus:ring-1 focus:ring-neutral-400"
                          value={pageLabel}
                          placeholder="Page 1 of 1"
                          onChange={(e) => onChange("pageLabel", e.target.value)}
                        />
                      ) : (
                        <div className="whitespace-nowrap px-2 py-2 text-xs text-neutral-600">
                          {pageLabel}
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td className="w-[130px] border border-black p-0 align-middle">
              <LogoCell
                logo={logoRight}
                side="right"
                editable={editable}
                onChange={
                  editable && onChange
                    ? (value) => onChange("logoRight", value)
                    : undefined
                }
              />
            </td>
          </tr>
        </tbody>
      </table>
      {children}
    </div>
  );
}

export function FieldRow({
  label,
  value = "",
  wide,
  fieldKey,
  values,
  onChange,
  editable,
}: {
  label: string;
  value?: string;
  wide?: boolean;
  fieldKey?: string;
} & DocumentFormBindings) {
  const resolved = fieldKey ? (values?.[fieldKey] ?? value) : value;

  return (
    <div
      data-export-break
      className={cn(
        "grid border-b border-black text-sm last:border-b-0",
        wide ? "grid-cols-1" : "grid-cols-[200px_minmax(0,1fr)]",
      )}
    >
      <div
        className={cn(
          "bg-neutral-50 px-2 py-2 font-medium",
          !wide && "border-r border-black",
        )}
      >
        {label}
      </div>
      {!wide ? (
        fieldKey ? (
          <EditableValue
            fieldKey={fieldKey}
            values={values}
            onChange={onChange}
            editable={editable}
          />
        ) : (
          <div className="min-h-9 px-2 py-2 text-neutral-700">{resolved || "\u00a0"}</div>
        )
      ) : fieldKey ? (
        <EditableValue
          fieldKey={fieldKey}
          values={values}
          onChange={onChange}
          editable={editable}
          multiline
          className="border-t border-black"
        />
      ) : (
        <div className="min-h-9 border-t border-black px-2 py-2 text-neutral-700">
          {resolved || "\u00a0"}
        </div>
      )}
    </div>
  );
}

export function BlankRows({
  count,
  columns,
  fieldPrefix,
  values,
  onChange,
  editable,
  columnKeys,
}: {
  count: number;
  columns: string[];
  /** Stable keys per column; defaults to sanitized column labels */
  columnKeys?: string[];
  fieldPrefix?: string;
} & DocumentFormBindings) {
  const keys =
    columnKeys ??
    columns.map((col, i) =>
      col === "#"
        ? "n"
        : col
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "") || `c${i}`,
    );

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="grid border-t border-black text-sm"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns.map((col, ci) => {
            const key = fieldPrefix ? `${fieldPrefix}_${i}_${keys[ci]}` : "";
            return (
              <div
                key={col + ci}
                className={cn(
                  "min-h-10",
                  ci < columns.length - 1 && "border-r border-black",
                  col === "#" && "text-center text-neutral-600",
                )}
              >
                {col === "#" ? (
                  <div className="px-2 py-2 text-center text-neutral-600">{i + 1}</div>
                ) : fieldPrefix ? (
                  <EditableValue
                    fieldKey={key}
                    values={values}
                    onChange={onChange}
                    editable={editable}
                    className="min-h-10"
                  />
                ) : (
                  <div className="px-2 py-2">{"\u00a0"}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

export function EditableCheck({
  fieldKey,
  label,
  values,
  onChange,
  editable,
  className,
}: DocumentFormBindings & {
  fieldKey: string;
  label: ReactNode;
  className?: string;
}) {
  const checked = (values?.[fieldKey] || "").toLowerCase() === "true" || values?.[fieldKey] === "1";

  if (editable && onChange) {
    return (
      <label className={cn("flex cursor-pointer items-start gap-2 text-sm text-neutral-800", className)}>
        <input
          type="checkbox"
          className="mt-0.5 size-3.5 shrink-0 accent-neutral-800"
          checked={checked}
          onChange={(e) => onChange(fieldKey, e.target.checked ? "true" : "")}
        />
        <span>{label}</span>
      </label>
    );
  }

  return (
    <label className={cn("flex items-start gap-2 text-sm text-neutral-800", className)}>
      <span
        className={cn(
          "mt-0.5 inline-block size-3.5 shrink-0 border border-neutral-700",
          checked && "bg-neutral-800",
        )}
      />
      <span>{label}</span>
    </label>
  );
}
