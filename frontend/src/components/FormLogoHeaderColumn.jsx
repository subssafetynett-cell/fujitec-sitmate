import React from "react";
import { Box } from "@mui/material";
import FormLogoUploadSlot from "./FormLogoUploadSlot";

/**
 * Standard 30% header column for left or right logo on document-style forms.
 */
export default function FormLogoHeaderColumn({
  imageSrc,
  onImageChange,
  readOnly,
  exportMode = false,
  side = "left",
  uploadLabel = "Upload Logo",
  borderColor = "#CCC",
}) {
  return (
    <Box
      sx={{
        width: { xs: "100%", md: "30%" },
        flex: { xs: "1 1 100%", md: "0 0 30%" },
        flexShrink: 0,
        minHeight: { md: 100 },
        p: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        ...(side === "left" ? { borderRight: `1px solid ${borderColor}` } : {}),
      }}
    >
      <FormLogoUploadSlot
        imageSrc={imageSrc}
        onImageChange={onImageChange}
        readOnly={readOnly}
        exportMode={exportMode}
        alt={side === "left" ? "Left logo" : "Right logo"}
        uploadLabel={uploadLabel}
      />
    </Box>
  );
}
