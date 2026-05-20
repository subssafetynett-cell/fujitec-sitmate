import React from "react";
import { Box, Button, Typography } from "@mui/material";

export function readImageFileAsDataUrl(file, onLoad) {
  if (!file || typeof onLoad !== "function") return;
  const reader = new FileReader();
  reader.onload = (ev) => onLoad(ev.target?.result || "");
  reader.readAsDataURL(file);
}

/**
 * Left/right logo upload slot used on template form headers (docInfo.logo / docInfo.logoRight).
 */
export default function FormLogoUploadSlot({
  imageSrc,
  onImageChange,
  readOnly = false,
  exportMode = false,
  alt = "Uploaded logo",
  uploadLabel = "Upload Logo",
}) {
  if (exportMode && !imageSrc) {
    return <Box sx={{ minHeight: 48, width: "100%" }} aria-hidden />;
  }

  if (readOnly && !imageSrc) {
    return <Typography variant="caption" color="text.secondary">No Logo</Typography>;
  }

  if (imageSrc) {
    return (
      <>
        <Box
          component="img"
          src={imageSrc}
          alt={alt}
          sx={{
            width: { xs: "100%", md: "80%" },
            maxHeight: "100px",
            objectFit: "contain",
            mb: readOnly ? 0 : 1,
          }}
        />
        {!readOnly && (
          <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap", justifyContent: "center" }}>
            <Button variant="text" size="small" component="label" sx={{ fontSize: "0.7rem" }}>
              Change Logo
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => {
                  readImageFileAsDataUrl(e.target.files?.[0], onImageChange);
                  e.target.value = "";
                }}
              />
            </Button>
            <Button
              variant="text"
              color="error"
              size="small"
              sx={{ fontSize: "0.7rem" }}
              onClick={() => onImageChange("")}
            >
              Remove
            </Button>
          </Box>
        )}
      </>
    );
  }

  if (readOnly) {
    return <Typography variant="caption" color="text.secondary">No Logo</Typography>;
  }

  return (
    <Button variant="outlined" component="label" size="small">
      {uploadLabel}
      <input
        type="file"
        hidden
        accept="image/*"
        onChange={(e) => {
          readImageFileAsDataUrl(e.target.files?.[0], onImageChange);
          e.target.value = "";
        }}
      />
    </Button>
  );
}
