import React from "react";
import { TextField, Typography } from "@mui/material";

/**
 * Full-height table cell text input for general forms (visible border, click anywhere in cell).
 */
export default function FormTableCellTextField({
  value,
  onChange,
  readOnly = false,
  placeholder = "",
  isDarkMode = false,
  minRows = 2,
  minCellHeight = 72,
}) {
  if (readOnly) {
    return (
      <Typography
        sx={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          px: 1,
          py: 1,
          minHeight: minCellHeight,
          width: "100%",
          alignSelf: "stretch",
          boxSizing: "border-box",
        }}
      >
        {value || " "}
      </Typography>
    );
  }

  return (
    <TextField
      fullWidth
      multiline
      minRows={minRows}
      variant="outlined"
      size="small"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      sx={{
        flex: 1,
        alignSelf: "stretch",
        m: 0.5,
        minHeight: minCellHeight,
        pointerEvents: "auto",
        "& .MuiOutlinedInput-root": {
          bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
          height: "100%",
          minHeight: minCellHeight - 8,
          alignItems: "flex-start",
        },
        "& .MuiOutlinedInput-input": {
          cursor: "text",
        },
      }}
    />
  );
}
