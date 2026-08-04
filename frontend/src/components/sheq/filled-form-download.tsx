import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { renderDocumentTemplate } from "@/components/sheq/document-forms";
import {
  ToolboxTalkRegisterForm,
  toolboxFromValues,
} from "@/components/sheq/toolbox-talk-register";
import type { SitePackDocument, Template } from "@/data/sheq";
import { ApiError, fetchFilledSitePackForm } from "@/lib/api";
import {
  buildElementAsWordVisualBlob,
  downloadElementAsPdf,
  safeDownloadBasename,
  triggerBrowserDownload,
} from "@/lib/filled-form-export";
import { downloadSiteSheqPdf } from "@/lib/filled-form-site-sheq-pdf";
import { buildFilledFormWordBlob } from "@/lib/filled-form-word";
import { toast } from "sonner";

type Format = "pdf" | "word";

type Props = {
  siteId: string;
  doc: SitePackDocument;
  templates: Template[];
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

export function FilledFormDownloadMenu({ siteId, doc, templates }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const jobIdRef = useRef(0);
  const [job, setJob] = useState<{
    id: number;
    format: Format;
    document: SitePackDocument;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const template =
    templates.find((t) => t.id === (job?.document.templateId || doc.templateId)) ||
    templates.find((t) => t.kind && t.kind === (job?.document.kind || doc.kind));

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    const jobId = job.id;

    (async () => {
      setBusy(true);
      try {
        const base = safeDownloadBasename(job.document.name);
        const exportKind =
          job.document.kind ||
          template?.kind ||
          templates.find((t) => t.id === job.document.templateId)?.kind;

        const isActive = () => !cancelled && jobIdRef.current === jobId;

        // Toolbox Talk and Site SHEQ Word use structured editable tables.
        if (job.format === "word" && (exportKind === "toolbox-talk" || exportKind === "site-sheq")) {
          const { blob, filename } = await buildFilledFormWordBlob(job.document);
          if (!isActive()) return;
          triggerBrowserDownload(blob, filename);
          toast.success("Word document downloaded");
          return;
        }

        // Site SHEQ PDF uses structured autoTable — avoids mid-row cuts and missing borders.
        if (job.format === "pdf" && exportKind === "site-sheq") {
          await downloadSiteSheqPdf(job.document);
          if (!isActive()) return;
          toast.success("PDF downloaded");
          return;
        }

        const host = await waitForExportHost(
          () => hostRef.current,
          () => !isActive(),
        );
        await waitForHostImages(host);
        if (!isActive()) return;

        const isSafeStart =
          exportKind === "safe-start" ||
          Boolean(host.querySelector(".safe-start-doc")) ||
          /safe\s*start/i.test(job.document.name || "") ||
          /safe\s*start/i.test(job.document.templateName || "");

        const isAuditAction =
          exportKind === "audit-action" ||
          Boolean(host.querySelector(".audit-action-doc")) ||
          /audit\s*action/i.test(job.document.name || "") ||
          /audit\s*action/i.test(job.document.templateName || "");

        const fitSinglePage =
          isSafeStart ||
          isAuditAction ||
          exportKind === "toolbox-talk" ||
          exportKind === "rams-briefing";
        // Site SHEQ stays multipage so ST 1–20 tables stay readable (not shrunk to one page).

        if (job.format === "pdf") {
          await downloadElementAsPdf(host, `${base}.pdf`, { fitSinglePage });
          if (!isActive()) return;
          toast.success("PDF downloaded");
          return;
        }

        // Build the Word blob first, then download only if this job is still active.
        let wordBlob: Blob;
        let wordName: string;
        try {
          const built = await buildElementAsWordVisualBlob(host, `${base}.docx`, {
            title: job.document.name,
            fitSinglePage,
          });
          wordBlob = built.blob;
          wordName = built.filename;
        } catch (visualErr) {
          console.error("Visual Word export failed, using structured fallback", visualErr);
          const built = await buildFilledFormWordBlob(job.document);
          wordBlob = built.blob;
          wordName = built.filename;
        }

        if (!isActive()) return;
        triggerBrowserDownload(wordBlob, wordName);
        toast.success("Word document downloaded");
      } catch (err) {
        if (!cancelled && jobIdRef.current === jobId) {
          toast.error(
            err instanceof Error ? err.message : "Unable to download filled form",
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
    // Only re-run when the download job changes — not when templates array identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- template/templates read from latest render with job
  }, [job]);

  async function startDownload(format: Format) {
    if (busy) return;
    setBusy(true);
    try {
      let document = doc;
      try {
        document = await fetchFilledSitePackForm(siteId, doc.id);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404) && !doc.formData) {
          throw err;
        }
      }
      if (!document.formData) {
        toast.error("This form has no saved field data to export");
        setBusy(false);
        return;
      }
      const id = jobIdRef.current + 1;
      jobIdRef.current = id;
      setJob({ id, format, document });
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof ApiError ? err.message : "Unable to prepare download");
    }
  }

  const formData = job?.document.formData ?? {};
  const kind = job?.document.kind || template?.kind;
  const showExportHost = Boolean(
    job &&
      !(job.format === "word" && kind === "toolbox-talk") &&
      !(job.format === "word" && kind === "site-sheq") &&
      !(job.format === "pdf" && kind === "site-sheq"),
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            {busy ? "Preparing…" : "Download"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem disabled={busy} onClick={() => void startDownload("pdf")}>
            <FileText /> Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onClick={() => void startDownload("word")}>
            <FileText /> Download Word
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showExportHost ? (
        <div
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 -z-50 w-[794px] bg-white text-neutral-900 opacity-[0.01]"
        >
          <div ref={hostRef} className="bg-white">
            {kind === "toolbox-talk" ? (
              <ToolboxTalkRegisterForm
                value={toolboxFromValues(formData)}
                readOnly
              />
            ) : template ? (
              renderDocumentTemplate(template, {
                values: formData,
                editable: false,
              })
            ) : (
              <FieldFallbackTable formData={formData} />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function FieldFallbackTable({ formData }: { formData: Record<string, string> }) {
  const rows = Object.entries(formData).filter(
    ([, value]) => value && !value.startsWith("data:image"),
  );
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="border border-black p-2">No text fields saved.</td>
          </tr>
        ) : (
          rows.map(([key, value]) => (
            <tr key={key}>
              <th className="w-[30%] border border-black bg-neutral-50 p-2 text-left align-top">
                {key}
              </th>
              <td className="border border-black p-2 align-top whitespace-pre-wrap">
                {value}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
