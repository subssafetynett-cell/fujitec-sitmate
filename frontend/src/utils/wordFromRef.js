/**
 * Export a rendered form DOM node as a Word-compatible .doc (HTML-in-Word).
 * Used by Friday Pack / general-forms standard templates (same capture root as PDF).
 */

function sanitizeFileBase(name) {
  return String(name || "document")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-") || "document";
}

/**
 * @param {React.RefObject<HTMLElement>|HTMLElement} printRef
 * @param {string} fileName
 * @param {(err?: Error) => void} [onComplete]
 * @param {{ title?: string, skipBrandLogos?: boolean }} [options]
 */
export async function downloadWordFromRef(printRef, fileName = "document", onComplete = null, options = {}) {
  const root = printRef?.current || printRef;
  if (!root) {
    console.error("No print reference provided for Word generation.");
    if (onComplete) onComplete(new Error("No print reference"));
    return;
  }

  try {
    const contentHtml = root.innerHTML;
    const docTitle = options.title || fileName || "Form";
    const safeName = sanitizeFileBase(fileName);

    const wordDocument = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${docTitle}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
    @page { size: A4; margin: 20mm 15mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 11pt; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    * { box-sizing: border-box; }
</style>
</head>
<body>${contentHtml}</body>
</html>`;

    const blob = new Blob(["\ufeff", wordDocument], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onComplete) onComplete();
  } catch (err) {
    console.error("Word generation failed:", err);
    if (onComplete) onComplete(err);
  }
}
