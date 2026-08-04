import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { renderDocumentTemplate } from "@/components/sheq/document-forms";
import type { Template } from "@/data/sheq";
import {
  buildElementAsWordVisualBlob,
  downloadElementAsPdf,
  safeDownloadBasename,
  triggerBrowserDownload,
} from "@/lib/filled-form-export";
import { toast } from "sonner";

type Format = "pdf" | "word";

export type DocumentTemplateDownloadApi = {
  startDownload: (format: Format) => void;
  busy: boolean;
};

type Props = {
  template: Template;
  formData: Record<string, string>;
  title: string;
  /** Optional button size/variant for embedding in dialogs. */
  size?: "default" | "sm";
  className?: string;
  /** Custom trigger/menu; when set, the default Download button is not rendered. */
  children?: (api: DocumentTemplateDownloadApi) => ReactNode;
};

async function waitForExportHost(
  getHost: () => HTMLElement | null,
  cancelled: () => boolean,
): Promise<HTMLElement> {
  for (let i = 0; i < 40; i += 1) {
    if (cancelled()) throw new Error("Download cancelled");
    const host = getHost();
    if (host && (host.scrollHeight > 0 || host.childElementCount > 0)) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      return host;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Unable to prepare form for download");
}

async function waitForHostImages(host: HTMLElement) {
  const images = Array.from(host.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
    ),
  );
  await new Promise((r) => setTimeout(r, 160));
}

/** Visual PDF/Word download of a filled document template (includes charts/tables in the form). */
export function DocumentTemplateDownloadMenu({
  template,
  formData,
  title,
  size = "sm",
  className,
  children,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const jobIdRef = useRef(0);
  const [job, setJob] = useState<{ id: number; format: Format } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    const jobId = job.id;

    (async () => {
      setBusy(true);
      try {
        const base = safeDownloadBasename(title || template.name || "sheq-form");
        const isActive = () => !cancelled && jobIdRef.current === jobId;
        const host = await waitForExportHost(
          () => hostRef.current,
          () => !isActive(),
        );
        await waitForHostImages(host);
        if (!isActive()) return;

        if (job.format === "pdf") {
          await downloadElementAsPdf(host, `${base}.pdf`);
          if (!isActive()) return;
          toast.success("PDF downloaded");
          return;
        }

        const built = await buildElementAsWordVisualBlob(host, `${base}.docx`, {
          title: title || template.name,
        });
        if (!isActive()) return;
        triggerBrowserDownload(built.blob, built.filename);
        toast.success("Word document downloaded");
      } catch (err) {
        if (!cancelled && jobIdRef.current === jobId) {
          toast.error(
            err instanceof Error ? err.message : "Unable to download form",
          );
        }
      } finally {
        if (!cancelled && jobIdRef.current === jobId) {
          setBusy(false);
          setJob(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [job, template.name, title]);

  function startDownload(format: Format) {
    if (busy) return;
    if (!formData || Object.keys(formData).length === 0) {
      toast.error("This form has no saved field data to export");
      return;
    }
    const id = jobIdRef.current + 1;
    jobIdRef.current = id;
    setJob({ id, format });
  }

  const api: DocumentTemplateDownloadApi = { startDownload, busy };

  return (
    <>
      {children ? (
        children(api)
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size={size}
              variant="outline"
              className={className ?? "rounded-xl"}
              disabled={busy}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Download />}
              {busy ? "Preparing…" : "Download"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem disabled={busy} onClick={() => startDownload("pdf")}>
              <FileText /> Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onClick={() => startDownload("word")}>
              <FileText /> Download Word
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {job ? (
        <div
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 -z-50 w-[794px] bg-white text-neutral-900 opacity-[0.01]"
        >
          <div ref={hostRef} className="bg-white w-[794px]">
            {renderDocumentTemplate(template, {
              values: formData,
              editable: false,
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
