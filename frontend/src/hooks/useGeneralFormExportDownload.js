import { useEffect } from "react";
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import { downloadWordFromRef } from "../utils/wordFromRef";

/**
 * Auto-download when the form is opened with ?action=download or ?action=download_word
 * (Friday Pack / Site Pack opens a new tab for export).
 */
export function useGeneralFormExportDownload({
  action,
  loading,
  docKey,
  containerRef,
  fileBaseName,
  pdfOptions,
  setDownloading,
}) {
  useEffect(() => {
    const downloadAction = String(action || "").toLowerCase();
    if (loading || !docKey) return;
    if (downloadAction !== "download" && downloadAction !== "download_word") return;

    setDownloading(true);
    const timer = setTimeout(() => {
      const onDone = () => {
        setDownloading(false);
        window.close();
      };
      const name = `${fileBaseName}_${docKey}`;
      if (downloadAction === "download_word") {
        downloadWordFromRef(containerRef, name, onDone, { title: name });
      } else {
        downloadPdfFromRef(containerRef, name, onDone, pdfOptions);
      }
    }, 500);

    return () => clearTimeout(timer);
    // One-shot export when the submission is ready; ignore unstable option object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, action, docKey]);
}
