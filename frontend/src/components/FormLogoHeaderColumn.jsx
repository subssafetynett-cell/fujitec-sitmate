import React from "react";
import { Box } from "@mui/material";
import FormLogoUploadSlot from "./FormLogoUploadSlot";
import { pdfColWidth } from "../utils/pdfFormLayout";

/**
 * Standard 30% header column for left or right logo on document-style forms.
 */
export default function FormLogoHeaderColumn({
  imageSrc,
  onImageChange,
  companyLogoUrl = null,
  readOnly,
  exportMode = false,
  side = "left",
  uploadLabel = "Upload Logo",
  borderColor = "#CCC",
}) {
  return (
    <Box
      sx={pdfColWidth(exportMode, "30%", {
        minHeight: exportMode ? 64 : { md: 100 },
        p: exportMode ? 1 : 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
        ...(side === "left" ? { borderRight: `1px solid ${borderColor}` } : {}),
      })}
    >
      <FormLogoUploadSlot
        imageSrc={imageSrc}
        onImageChange={onImageChange}
        companyLogoUrl={companyLogoUrl}
        readOnly={readOnly}
        exportMode={exportMode}
        alt={side === "left" ? "Left logo" : "Right logo"}
        uploadLabel={uploadLabel}
      />
    </Box>
  );
}
