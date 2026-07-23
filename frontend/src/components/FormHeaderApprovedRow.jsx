import React from "react";
import { Box, TextField, Typography } from "@mui/material";

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
}) {
  return (
    <Box sx={{ display: "flex", flexWrap: { xs: "wrap", md: "nowrap" } }}>
      <Box
        sx={{
          width: { xs: "100%", md: "40%" },
          p: 1,
          borderRight: `1px solid ${borderColor}`,
          flexShrink: 0,
        }}
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
        sx={{
          width: { xs: "100%", md: "40%" },
          p: 0,
          borderRight: `1px solid ${borderColor}`,
          minWidth: 0,
          flex: { md: "1 1 auto" },
        }}
      >
        {contentReadOnly ? (
          <Typography
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
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
        sx={{ width: { xs: "100%", md: "20%" }, p: 1, flexShrink: 0 }}
      >
        {pageText}
      </Box>
    </Box>
  );
}
