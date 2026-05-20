import React from "react";
import { Box } from "@mui/material";
import FormLogoHeaderColumn from "./FormLogoHeaderColumn";

export const formDocumentHeaderRowSx = {
  display: "flex",
  flexWrap: { xs: "wrap", md: "nowrap" },
  width: "100%",
};

export const formHeaderCenterColumnSx = (borderColor) => ({
  width: { xs: "100%", md: "40%" },
  flex: { xs: "1 1 100%", md: "0 0 40%" },
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  borderRight: `1px solid ${borderColor}`,
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
  rightImageSrc,
  onRightImageChange,
  uploadLabel = "Upload Logo",
  children,
  sx,
}) {
  return (
    <Box sx={{ ...formDocumentHeaderRowSx, border: `1px solid ${borderColor}`, ...sx }}>
      <FormLogoHeaderColumn
        imageSrc={leftImageSrc}
        onImageChange={onLeftImageChange}
        readOnly={readOnly}
        exportMode={exportMode}
        side="left"
        borderColor={borderColor}
        uploadLabel={uploadLabel}
      />
      <Box sx={formHeaderCenterColumnSx(borderColor)}>{children}</Box>
      <FormLogoHeaderColumn
        imageSrc={rightImageSrc}
        onImageChange={onRightImageChange}
        readOnly={readOnly}
        exportMode={exportMode}
        side="right"
        borderColor={borderColor}
        uploadLabel={uploadLabel}
      />
    </Box>
  );
}
