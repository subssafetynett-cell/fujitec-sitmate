/**
 * Layout helpers so Friday Pack / download PDFs never use mobile (xs) breakpoints.
 * Prefer flex + fixed flex-basis in PDF mode (html2canvas handles this more reliably
 * than nested CSS tables for document headers).
 */

/** Flex row that stays horizontal during PDF export. */
export function pdfFlexRow(pdfLayout, sx = {}) {
  return {
    display: "flex",
    flexDirection: "row",
    flexWrap: pdfLayout ? "nowrap" : { xs: "wrap", md: "nowrap" },
    width: "100%",
    boxSizing: "border-box",
    ...sx,
  };
}

/** Column width: fixed %/px + flex-basis in PDF mode; responsive otherwise. */
export function pdfColWidth(pdfLayout, mdWidth, sx = {}) {
  if (pdfLayout) {
    return {
      width: mdWidth,
      maxWidth: mdWidth,
      flex: `0 0 ${mdWidth}`,
      boxSizing: "border-box",
      ...sx,
    };
  }
  return {
    width: { xs: "100%", md: mdWidth },
    ...sx,
  };
}

/** CSS table wrapper for multi-column grids that must not wrap in PDF capture. */
export function pdfTableSx(pdfLayout, sx = {}) {
  if (!pdfLayout) return sx;
  return {
    display: "table",
    width: "100%",
    tableLayout: "fixed",
    borderCollapse: "collapse",
    boxSizing: "border-box",
    ...sx,
  };
}

/** Table row / cell pair for PDF export; falls back to flex row + col width otherwise. */
export function pdfTableRow(pdfLayout, sx = {}) {
  if (pdfLayout) {
    return { display: "table-row", ...sx };
  }
  return pdfFlexRow(false, sx);
}

export function pdfTableCell(pdfLayout, mdWidth, sx = {}) {
  if (pdfLayout) {
    return {
      display: "table-cell",
      width: mdWidth,
      maxWidth: mdWidth,
      verticalAlign: "middle",
      boxSizing: "border-box",
      ...sx,
    };
  }
  return pdfColWidth(false, mdWidth, sx);
}
