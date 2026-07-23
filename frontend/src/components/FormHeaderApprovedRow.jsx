import React from "react";
import { Box, TextField, Typography } from "@mui/material";
import { pdfColWidth, pdfFlexRow } from "../utils/pdfFormLayout";

/**
 * Header row: label | approver value | page (40% / 40% / 20% within center column).
 */
export default function FormHeaderApprovedRow({
  borderColor = "#CCC",
  contentReadOnly = false,
  label,
  onLabelChange,
  value,
  onValueChange,
  pageText = "Page 1 of 1",
  valueTextColor,
  pdfLayout = false,
}) {
  return (
    <Box sx={pdfFlexRow(pdfLayout, { alignItems: "stretch" })}>
      <Box
        sx={pdfColWidth(pdfLayout, "40%", {
          p: 1,
          borderRight: `1px solid ${borderColor}`,
        })}
      >
        {contentReadOnly ? (
          <Typography sx={{ fontWeight: "inherit" }}>{label}</Typography>
        ) : (
          <TextField
            fullWidth
            variant="standard"
            InputProps={{ disableUnderline: true, sx: { fontWeight: "inherit" } }}
            value={label}
            onChange={onLabelChange}
          />
        )}
      </Box>
      <Box
        sx={pdfColWidth(pdfLayout, "40%", {
          p: 0,
          borderRight: `1px solid ${borderColor}`,
          minWidth: 0,
        })}
      >
        {contentReadOnly ? (
          <Typography
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              px: 1,
              py: 1,
              minHeight: "1.5em",
            }}
          >
            {value || " "}
          </Typography>
        ) : (
          <TextField
            fullWidth
            multiline
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: {
                px: 1,
                py: 1,
                height: "100%",
                ...(valueTextColor ? { color: valueTextColor } : {}),
              },
            }}
            value={value}
            onChange={onValueChange}
          />
        )}
      </Box>
      <Box
        data-pdf-page-number
        sx={pdfColWidth(pdfLayout, "20%", {
          p: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          fontSize: "0.85rem",
          whiteSpace: "nowrap",
        })}
      >
        {/* Placeholder kept for layout; PDF generator clears/overlays real page numbers. */}
        {pdfLayout ? "\u00a0" : pageText}
      </Box>
    </Box>
  );
}
