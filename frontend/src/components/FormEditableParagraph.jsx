import React from "react";
import { TextField, Typography } from "@mui/material";

/** Template boilerplate paragraph — editable on General Forms, read-only when filling a site pack. */
export default function FormEditableParagraph({
  value,
  onChange,
  readOnly = false,
  isDarkMode = false,
  minRows = 2,
  sx = {},
}) {
  if (readOnly) {
    return (
      <Typography
        sx={{
          fontSize: "0.95rem",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          ...sx,
        }}
      >
        {value}
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
      value={value}
      onChange={onChange}
      sx={{
        "& .MuiOutlinedInput-root": {
          bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
          fontSize: "0.95rem",
          lineHeight: 1.5,
        },
        ...sx,
      }}
    />
  );
}
