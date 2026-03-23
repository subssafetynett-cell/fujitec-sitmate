import React from "react";
import {
    Box,
    Typography,
    TextField,
    MenuItem,
    Checkbox,
    Radio,
    RadioGroup,
    FormControlLabel,
    Button,
} from "@mui/material";

export default function FormRenderer({
    form,
    values,
    onChange,
    onSubmit,
    readOnly = false,
    isSubmitting = false,
    logoUrl,
}) {
    if (!form) return null;

    const handleChange = (fieldId, value) => {
        if (readOnly) return;
        onChange(fieldId, value);
    };

    const handleCheckboxToggle = (fieldId, option) => {
        if (readOnly) return;
        const current = Array.isArray(values[fieldId]) ? values[fieldId] : [];
        const newValue = current.includes(option)
            ? current.filter((v) => v !== option)
            : [...current, option];
        onChange(fieldId, newValue);
    };

    // Style overrides for read-only to ensure black text
    const readOnlyInputProps = {
        readOnly: true,
        sx: {
            "& .MuiInputBase-input": {
                color: "text.primary",
                WebkitTextFillColor: "rgba(0, 0, 0, 0.87) !important",
                cursor: "default"
            },
            "& .MuiOutlinedInput-notchedOutline": { 
                borderColor: "rgba(0, 0, 0, 0.23)",
            },
        }
    };

    const inputSx = {
        "& .MuiOutlinedInput-root": {
            borderRadius: "12px",
        },
    };

    // For Select/Radio/Checkbox, "readOnly" attribute doesn't prevent interaction fully in MUI (select still opens).
    // We strictly control them via value/onChange blocking, but for visual "black text" we need tricks.

    return (
        <Box sx={{ position: "relative" }}>
            {logoUrl && (
                <Box
                    component="img"
                    src={logoUrl}
                    alt="Company Logo"
                    sx={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        height: 60,
                        width: "auto",
                        maxHeight: "100px",
                        objectFit: "contain",
                    }}
                />
            )}
            <Typography
                variant="h4"
                sx={{
                    fontWeight: 700,
                    mb: 3,
                    color: form.titleColor || "inherit",
                    textAlign: form.titleAlignment || "left",
                    pr: logoUrl ? 10 : 0, // Add padding if logo exists to prevent overlap
                }}
            >
                {form.title}
            </Typography>

            {form.fields.map((f) => (
                <Box key={f.id} sx={{ mb: 3 }}>
                    {f.type !== "section_header" && (
                        <Typography sx={{ fontWeight: 600, mb: 1.5 }}>
                            {f.label} {f.required && !readOnly && "*"}
                        </Typography>
                    )}

                    {/* Section Header Renderer */}
                    {f.type === "section_header" && (
                        <Box sx={{ width: '100%', textAlign: f.alignment || 'left', mt: 2, mb: 1 }}>
                            {f.subheading && (
                                <Typography variant="h6" sx={{ fontWeight: 600, color: f.color || '#000' }}>
                                    {f.subheading}
                                </Typography>
                            )}
                        </Box>
                    )}

                    {f.type === "text" && (
                        <TextField
                            fullWidth
                            sx={inputSx}
                            value={values[f.id] || ""}
                            onChange={(e) => handleChange(f.id, e.target.value)}
                            InputProps={readOnly ? readOnlyInputProps : {}}
                            placeholder={readOnly ? "-" : ""}
                        />
                    )}

                    {f.type === "textarea" && (
                        <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            sx={inputSx}
                            value={values[f.id] || ""}
                            onChange={(e) => handleChange(f.id, e.target.value)}
                            InputProps={readOnly ? readOnlyInputProps : {}}
                            placeholder={readOnly ? "-" : ""}
                        />
                    )}

                    {f.type === "select" && (
                        <TextField
                            select
                            fullWidth
                            sx={inputSx}
                            value={values[f.id] || ""}
                            onChange={(e) => handleChange(f.id, e.target.value)}
                            InputProps={readOnly ? readOnlyInputProps : {}}
                        >
                            {f.options?.map((o) => (
                                <MenuItem key={o.id} value={o.value}>
                                    {o.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    )}

                    {f.type === "radio" && (
                        <RadioGroup
                            value={values[f.id] || ""}
                            onChange={(e) => handleChange(f.id, e.target.value)}
                        >
                            {f.options?.map((o) => (
                                <FormControlLabel
                                    key={o.id}
                                    value={o.value}
                                    control={
                                        <Radio
                                            sx={{
                                                "&.Mui-disabled": { color: values[f.id] === o.value ? "primary.main" : "action.disabled" }
                                            }}
                                        />
                                    }
                                    label={o.label}
                                    disabled={readOnly}
                                    sx={{
                                        "& .MuiFormControlLabel-label.Mui-disabled": { color: "text.primary" }
                                    }}
                                />
                            ))}
                        </RadioGroup>
                    )}

                    {f.type === "checkbox" && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {f.options?.map((o) => (
                                <FormControlLabel
                                    key={o.id}
                                    control={
                                        <Checkbox
                                            checked={(values[f.id] || []).includes(o.value)}
                                            onChange={() => handleCheckboxToggle(f.id, o.value)}
                                            disabled={readOnly}
                                            sx={{
                                                "&.Mui-disabled": { color: (values[f.id] || []).includes(o.value) ? "primary.main" : "action.disabled" }
                                            }}
                                        />
                                    }
                                    label={o.label}
                                    sx={{
                                        "& .MuiFormControlLabel-label.Mui-disabled": { color: "text.primary" }
                                    }}
                                />
                            ))}
                        </Box>
                    )}

                    {(f.type === "date" || f.type === "time" || f.type === "datetime" || f.type === "monthyear") && (
                        <TextField
                            type={f.type === "datetime" ? "datetime-local" : f.type === "monthyear" ? "month" : f.type}
                            fullWidth
                            sx={inputSx}
                            value={values[f.id] || ""}
                            onChange={(e) => handleChange(f.id, e.target.value)}
                            InputProps={readOnly ? readOnlyInputProps : {}}
                            InputLabelProps={{ shrink: true }}
                        />
                    )}

                    {/* Image Upload Renderer */}
                    {f.type === "image_upload" && (
                        <Box>
                            {/* Show preview if value exists (either file object, base64 string, or preview url) */}
                            {(values[f.id] || values[f.id + "_preview"]) ? (
                                <Box sx={{ mb: 1 }}>
                                    <Box
                                        component="img"
                                        src={
                                            // 1. Preview URL (File object created URL)
                                            values[f.id + "_preview"] ||
                                            // 2. Base64 string (from DB)
                                            (typeof values[f.id] === 'string' ? values[f.id] : null) ||
                                            // 3. Fallback
                                            ""
                                        }
                                        alt="uploaded"
                                        sx={{ maxWidth: '100%', maxHeight: 300, borderRadius: 2, border: '1px solid #ddd' }}
                                    />
                                    {!readOnly && (
                                        <Button size="small" color="error" onClick={() => {
                                            handleChange(f.id, null);
                                            handleChange(f.id + "_preview", null);
                                        }} sx={{ display: 'block', mt: 1 }}>Remove</Button>
                                    )}
                                </Box>
                            ) : (
                                !readOnly && (
                                    <Button variant="outlined" component="label" fullWidth sx={{ height: 100, borderStyle: 'dashed', borderRadius: "12px" }}>
                                        Upload Image
                                        <input hidden accept="image/*" type="file" onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                const url = URL.createObjectURL(file);
                                                handleChange(f.id, file); // Store File object
                                                handleChange(f.id + "_preview", url); // Store preview URL
                                            }
                                        }} />
                                    </Button>
                                )
                            )}
                        </Box>
                    )}

                    {/* Signature Renderer (Placeholder) */}
                    {f.type === "signature" && (
                        <Box sx={{ border: "1px solid #cbd5e1", borderRadius: "12px", height: 120, bgcolor: readOnly ? "#fff" : "#f8fafc", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography color="text.secondary">{values[f.id] ? "Signed" : "Signature (Pending)"}</Typography>
                        </Box>
                    )}

                </Box>
            ))}

            {!readOnly && onSubmit && (
                <Button
                    variant="contained"
                    fullWidth
                    sx={{
                        mt: 4,
                        mb: 2,
                        textTransform: "none",
                        borderRadius: 4,
                        py: 1.5,
                        fontSize: "1rem",
                        fontWeight: 600,
                        bgcolor: "#EAB308",
                        color: "#111827",
                        boxShadow: "none",
                        "&:hover": { bgcolor: "#CA8A04", boxShadow: "none" },
                        "&.Mui-disabled": { bgcolor: "rgba(234, 179, 8, 0.5)", color: "rgba(17, 24, 39, 0.5)" }
                    }}
                    onClick={onSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
            )}
        </Box>
    );
}
