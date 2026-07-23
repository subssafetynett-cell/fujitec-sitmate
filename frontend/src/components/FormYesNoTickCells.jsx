import React from "react";
import { Box } from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";

/**
 * Clickable Yes / No tick cells (mutually exclusive). value: "Yes" | "No" | "".
 */
export default function FormYesNoTickCells({
  value = "",
  onYes,
  onNo,
  readOnly = false,
  isDarkMode = false,
  borderColor = "#CCC",
  minHeight = 36,
}) {
  const renderCell = (checked, onClick, withRightBorder) => (
    <Box
      role={readOnly ? undefined : "button"}
      tabIndex={readOnly ? undefined : 0}
      aria-pressed={checked}
      onClick={readOnly ? undefined : onClick}
      onKeyDown={
        readOnly
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
      }
      sx={{
        width: "50%",
        ...(withRightBorder ? { borderRight: `1px solid ${borderColor}` } : {}),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        cursor: readOnly ? "default" : "pointer",
        "&:hover": readOnly ? {} : { bgcolor: "action.hover" },
      }}
    >
      {checked ? (
        <CheckBoxIcon fontSize="small" color="primary" />
      ) : (
        <CheckBoxOutlineBlankIcon
          fontSize="small"
          sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
        />
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", width: "100%", flexWrap: "nowrap" }}>
      {renderCell(value === "Yes", onYes, true)}
      {renderCell(value === "No", onNo, false)}
    </Box>
  );
}
