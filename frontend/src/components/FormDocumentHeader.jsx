import React from "react";
import { Box } from "@mui/material";
import FormLogoHeaderColumn from "./FormLogoHeaderColumn";
import { pdfColWidth, pdfFlexRow } from "../utils/pdfFormLayout";

export const formDocumentHeaderRowSx = (exportMode = false) =>
  pdfFlexRow(exportMode, { width: "100%", alignItems: "stretch" });

export const formHeaderCenterColumnSx = (borderColor, exportMode = false) =>
  pdfColWidth(exportMode, "40%", {
    display: "flex",
    flexDirection: "column",
    borderRight: `1px solid ${borderColor}`,
    minWidth: 0,
  });

/**
 * Three-column document header: left logo | center metadata | right logo.
 */
export default function FormDocumentHeader({
  borderColor = "#CCC",
  readOnly = false,
  exportMode = false,
  leftImageSrc,
  onLeftImageChange,
  leftCompanyLogoUrl = null,
  rightImageSrc,
  onRightImageChange,
  rightCompanyLogoUrl = null,
  uploadLabel = "Upload Logo",
  children,
  sx,
}) {
  return (
    <Box
      sx={{
        ...formDocumentHeaderRowSx(exportMode),
        border: `1px solid ${borderColor}`,
        overflow: "visible",
        ...sx,
      }}
    >
      <FormLogoHeaderColumn
        imageSrc={leftImageSrc}
        onImageChange={onLeftImageChange}
        companyLogoUrl={leftCompanyLogoUrl}
        readOnly={readOnly}
        exportMode={exportMode}
        side="left"
        borderColor={borderColor}
        uploadLabel={uploadLabel}
      />
      <Box sx={formHeaderCenterColumnSx(borderColor, exportMode)}>{children}</Box>
      <FormLogoHeaderColumn
        imageSrc={rightImageSrc}
        onImageChange={onRightImageChange}
        companyLogoUrl={rightCompanyLogoUrl}
        readOnly={readOnly}
        exportMode={exportMode}
        side="right"
        borderColor={borderColor}
        uploadLabel={uploadLabel}
      />
    </Box>
  );
}
