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
import { useTheme } from "../context/ThemeContext";
import SignatureCapture from "./SignatureCapture";
import ImageEvidenceDescriptionField from "./ImageEvidenceDescriptionField";

export default function FormRenderer({
    form,
    values,
    onChange,
    onSubmit,
    readOnly = false,
    isSubmitting = false,
    logoUrl,
    submitLabel = "Submit",
    exportMode = false,
}) {
    const themeContext = useTheme();
    const isDarkMode = themeContext?.isDarkMode;
    if (!form) return null;

    const customBlue = "#003049";
    const headerBg = "#003049";

    const getDynamicFontSize = (text, baseSize = '1rem') => {
        if (!text || typeof text !== 'string') return baseSize;
        const length = text.length;
        if (length < 40) return baseSize;
        if (length < 80) return `calc(${baseSize} * 0.9)`;
        if (length < 150) return `calc(${baseSize} * 0.85)`;
        return `calc(${baseSize} * 0.75)`;
    };

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

    // Style overrides for read-only to ensure plain text appearance
    const readOnlyInputProps = {
        readOnly: true,
        sx: {
            "& .MuiInputBase-input": {
                color: "text.primary",
                WebkitTextFillColor: "rgba(0, 0, 0, 0.87) !important",
                cursor: "default",
                overflow: "visible",
                paddingBottom: "8px",
            },
            "& .MuiOutlinedInput-notchedOutline": { 
                border: "none", // Remove border entirely
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                border: "none",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
                border: "none",
            }
        }
    };

    const inputSx = {
        "& .MuiOutlinedInput-root": {
            borderRadius: "12px",
        },
    };

    // For Select/Radio/Checkbox, "readOnly" attribute doesn't prevent interaction fully in MUI (select still opens).
    // We strictly control them via value/onChange blocking, but for visual "black text" we need tricks.

    const renderFieldItem = (f, isNested = false) => (
        <Box key={f.id} sx={{ 
            mb: isNested ? 0.5 : 3, 
            width: '100%', 
            boxSizing: 'border-box',
            ...(f.layout === 'horizontal' && {
                display: 'flex',
                alignItems: 'center',
                gap: 2
            })
        }}>
            {f.type !== "section_header" && f.type !== "logo" && !(f.type === "grid" && !f.label) && !(f.type === "image_upload" && readOnly) && (
                <Typography sx={{ 
                    fontWeight: 700, 
                    mb: f.layout === 'horizontal' ? 0 : (isNested ? 0.5 : 1), 
                    fontSize: isNested ? '0.75rem' : '0.85rem',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    ...(f.layout === 'horizontal' && { minWidth: '150px' })
                }}>
                    {f.label} {f.required && !readOnly && <span style={{ color: '#ef4444' }}>*</span>}
                </Typography>
            )}

            {/* Section Header Renderer */}
            {f.type === "section_header" && (
                <Box sx={{ 
                    width: '100%', 
                    textAlign: f.alignment || 'left', 
                    mt: 4, 
                    mb: 2,
                    p: 1.5,
                    bgcolor: '#F1F5F9',
                    borderLeft: `5px solid ${headerBg}`,
                    borderRadius: '0 4px 4px 0'
                }}>
                    {f.subheading && (
                        <Typography variant="h6" sx={{ 
                            fontWeight: 800, 
                            color: customBlue,
                            fontSize: '1rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            {f.subheading}
                        </Typography>
                    )}
                </Box>
            )}

            {f.type === "text" && (
                readOnly ? (
                    <Box sx={{ 
                        p: f.isGridCell ? 0.75 : 1.25, 
                        minHeight: f.isGridCell ? 'auto' : '2.5rem', 
                        display: 'flex', 
                        alignItems: 'center',
                        border: f.isGridCell ? 'none' : `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                        borderRadius: f.isGridCell ? 0 : '8px',
                        bgcolor: f.isGridCell ? 'transparent' : (isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
                        boxSizing: 'border-box'
                    }}>
                        <Typography sx={{ 
                            color: "text.primary", 
                            wordBreak: 'break-word',
                            fontSize: getDynamicFontSize(values[f.id], '0.875rem'),
                            lineHeight: 1.4
                        }}>{values[f.id] || "—"}</Typography>
                    </Box>
                ) : (
                    <TextField
                        fullWidth
                        variant={f.isGridCell ? "standard" : "outlined"}
                        size={f.isGridCell ? "medium" : "small"}
                        value={values[f.id] || ""}
                        onChange={(e) => handleChange(f.id, e.target.value)}
                        InputProps={{
                            disableUnderline: f.isGridCell,
                            sx: { 
                                borderRadius: f.isGridCell ? 0 : 2,
                                fontSize: getDynamicFontSize(values[f.id], '0.875rem'),
                                ...(f.isGridCell && {
                                    px: 1.5,
                                    py: 0.5,
                                    "& input": { p: 0 }
                                })
                            }
                        }}
                        sx={{ 
                            mb: isNested ? 0 : 3,
                            ...(f.isGridCell && {
                                "& .MuiInputBase-root": {
                                    bgcolor: 'transparent',
                                    "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }
                                }
                            })
                        }}
                    />
                )
            )}

            {f.type === "textarea" && (
                readOnly ? (
                    <Box sx={{ 
                        p: f.isGridCell ? 0.75 : 1.5, 
                        minHeight: f.isGridCell ? 'auto' : '4.5rem',
                        border: f.isGridCell ? 'none' : `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                        borderRadius: f.isGridCell ? 0 : '8px',
                        bgcolor: f.isGridCell ? 'transparent' : (isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
                        boxSizing: 'border-box'
                    }}>
                        <Typography sx={{ 
                            color: "text.primary", 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-word',
                            fontSize: getDynamicFontSize(values[f.id], '0.875rem'),
                            lineHeight: 1.4
                        }}>{values[f.id] || "—"}</Typography>
                    </Box>
                ) : (
                    <TextField
                        fullWidth
                        multiline
                        variant={f.isGridCell ? "standard" : "outlined"}
                        size={f.isGridCell ? "medium" : "small"}
                        minRows={isNested ? 3 : 4}
                        value={values[f.id] || ""}
                        onChange={(e) => handleChange(f.id, e.target.value)}
                        InputProps={{
                            disableUnderline: f.isGridCell,
                            sx: { 
                                borderRadius: f.isGridCell ? 0 : 2,
                                fontSize: getDynamicFontSize(values[f.id], '0.875rem'),
                                ...(f.isGridCell && {
                                    px: 1.5,
                                    py: 1,
                                    "& textarea": { p: 0 }
                                })
                            }
                        }}
                        sx={{ 
                            mb: isNested ? 0 : 3,
                            ...(f.isGridCell && {
                                "& .MuiInputBase-root": {
                                    bgcolor: 'transparent',
                                    "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }
                                }
                            })
                        }}
                    />
                )
            )}

            {f.type === "select" && (
                readOnly ? (
                    <Box sx={{ 
                        p: f.isGridCell ? 0.75 : 1.25, 
                        minHeight: f.isGridCell ? 'auto' : '2.5rem', 
                        display: 'flex', 
                        alignItems: 'center',
                        border: f.isGridCell ? 'none' : `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                        borderRadius: f.isGridCell ? 0 : '8px',
                        bgcolor: f.isGridCell ? 'transparent' : (isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
                        boxSizing: 'border-box'
                    }}>
                        <Typography sx={{ color: "text.primary", fontSize: '0.875rem' }}>
                            {values[f.id] ? (f.options?.find(o => o.value === values[f.id])?.label || values[f.id]) : "—"}
                        </Typography>
                    </Box>
                ) : (
                    <TextField
                        select
                        fullWidth
                        variant={f.isGridCell ? "standard" : "outlined"}
                        size={f.isGridCell ? "medium" : "small"}
                        value={values[f.id] || ""}
                        onChange={(e) => handleChange(f.id, e.target.value)}
                        InputProps={{
                            disableUnderline: f.isGridCell,
                            sx: { 
                                borderRadius: f.isGridCell ? 0 : 2,
                                fontSize: getDynamicFontSize(values[f.id], '0.875rem'),
                                ...(f.isGridCell && {
                                    px: 1.5,
                                    py: 0.5,
                                    "& .MuiSelect-select": { p: 0 }
                                })
                            }
                        }}
                        sx={{ 
                            mb: isNested ? 0 : 3,
                            ...(f.isGridCell && {
                                "& .MuiInputBase-root": {
                                    bgcolor: 'transparent',
                                    "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }
                                }
                            })
                        }}
                    >
                        {f.options?.map((o) => (
                            <MenuItem key={o.id} value={o.value}>
                                {o.label}
                            </MenuItem>
                        ))}
                    </TextField>
                )
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
                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: f.columns ? 'row' : 'column', 
                    flexWrap: 'wrap',
                    gap: 0.5,
                    ...(f.bordered && {
                        border: `1px solid ${isDarkMode ? '#334155' : '#E2E8F0'}`,
                        p: 2,
                        borderRadius: "8px"
                    })
                }}>
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
                                width: f.columns ? `calc(${100 / f.columns}% - 8px)` : '100%',
                                m: 0,
                                "& .MuiFormControlLabel-label.Mui-disabled": { color: "text.primary" }
                            }}
                        />
                    ))}
                </Box>
            )}

            {(f.type === "date" || f.type === "time" || f.type === "datetime" || f.type === "monthyear") && (
                readOnly ? (
                    <Box sx={{ 
                        p: 1.25, 
                        minHeight: '2.5rem', 
                        display: 'flex', 
                        alignItems: 'center',
                        border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                        borderRadius: '8px',
                        bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                        boxSizing: 'border-box'
                    }}>
                        <Typography sx={{ color: "text.primary", fontSize: '0.875rem' }}>{values[f.id] || "—"}</Typography>
                    </Box>
                ) : (
                    <TextField
                        type={f.type === "datetime" ? "datetime-local" : f.type === "monthyear" ? "month" : f.type}
                        fullWidth
                        sx={inputSx}
                        value={values[f.id] || ""}
                        onChange={(e) => handleChange(f.id, e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                )
            )}

            {f.type === "grid" && (() => {
                const rows = f.rows || 3;
                const cols = f.cols || 3;
                const gridValues = values[f.id] || {};
                const cellLabels = f.cellLabels || {};
                const cellFields = f.cellFields || {};
                
                const getColWidths = () => {
                    const w = f.colWidths || [];
                    return Array.from({ length: cols }).map((_, i) => w[i] ? `${w[i]}px` : '1fr');
                };
                const getRowHeights = () => {
                    const h = f.rowHeights || [];
                    return Array.from({ length: rows }).map((_, i) => h[i] ? `minmax(${h[i]}px, auto)` : 'auto');
                };

                const gridTemplateColumns = getColWidths().join(' ');
                const gridTemplateRows = getRowHeights().join(' ');
                
                return (
                    <Box sx={{ border: "1px solid #e2e8f0", borderRadius: 2, overflowX: "auto", mt: 1 }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns, gridTemplateRows, gap: '1px', bgcolor: '#e2e8f0', width: 'fit-content' }}>
                            {Array.from({ length: rows }).map((_, r) => (
                                Array.from({ length: cols }).map((_, c) => {
                                    const cellKey = `${r}_${c}`;
                                    const isStaticLabel = !!cellLabels[cellKey];
                                    const labelText = cellLabels[cellKey];
                                    const cellVal = gridValues[cellKey] || "";
                                    const cellNestedFields = cellFields[cellKey] || [];
                                    
                                    const gridTheme = f.gridTheme || 'default';
                                    const isPremium = gridTheme === 'premium';
                                    
                                    return (
                                        <Box key={cellKey} sx={{ 
                                            bgcolor: isStaticLabel 
                                                ? (isPremium ? '#003049' : (isDarkMode ? '#1e293b' : '#f8fafc')) 
                                                : (isDarkMode ? '#0f172a' : '#fff'), 
                                            p: 0, 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            alignItems: 'stretch', 
                                            justifyContent: isStaticLabel ? 'center' : 'stretch',
                                            border: `1px solid ${isDarkMode ? '#334155' : '#E2E8F0'}`,
                                            overflow: 'hidden',
                                            minHeight: isStaticLabel ? (isPremium ? '35px' : '30px') : '50px'
                                        }}>
                                            {isStaticLabel && (
                                                <Typography sx={{ 
                                                    p: isPremium ? 1 : 1, 
                                                    fontWeight: isPremium ? 700 : 600, 
                                                    color: isPremium ? '#FFF' : (isDarkMode ? '#cbd5e1' : 'text.secondary'), 
                                                    textAlign: 'center',
                                                    fontSize: isPremium ? '0.75rem' : getDynamicFontSize(labelText, '0.85rem'),
                                                    lineHeight: 1.2,
                                                    wordBreak: 'break-word',
                                                    textTransform: isPremium ? 'uppercase' : 'none',
                                                    letterSpacing: isPremium ? '0.05em' : 'normal',
                                                    bgcolor: isPremium ? '#003049' : 'transparent',
                                                    width: '100%'
                                                }}>{labelText}</Typography>
                                            )}
                                            
                                            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                {cellNestedFields.length > 0 ? (
                                                    <Box sx={{ width: '100%', p: isPremium ? 0 : 1, display: 'flex', flexDirection: 'column' }}>
                                                        {cellNestedFields.map(sf => renderFieldItem({
                                                            ...sf,
                                                            // For premium grids, we often want borderless inputs
                                                            ...(isPremium && { isGridCell: true })
                                                        }, true))}
                                                    </Box>
                                                ) : (
                                                    !isStaticLabel ? (
                                                        readOnly ? (
                                                            <Typography sx={{ 
                                                                p: 1.5, 
                                                                minHeight: '2.5rem', 
                                                                width: '100%', 
                                                                wordBreak: 'break-word', 
                                                                whiteSpace: 'pre-wrap',
                                                                fontSize: getDynamicFontSize(cellVal, '0.875rem'),
                                                                lineHeight: 1.4,
                                                                color: isDarkMode ? '#F9FAFB' : '#111827'
                                                            }}>{cellVal || " "}</Typography>
                                                        ) : (
                                                            <TextField
                                                                fullWidth
                                                                variant="outlined"
                                                                size="small"
                                                                value={cellVal}
                                                                onChange={(e) => {
                                                                    handleChange(f.id, {
                                                                        ...gridValues,
                                                                        [cellKey]: e.target.value
                                                                    });
                                                                }}
                                                                sx={{
                                                                    height: '100%',
                                                                    width: '100%',
                                                                    "& .MuiOutlinedInput-root": {
                                                                        height: '100%',
                                                                        borderRadius: 0,
                                                                        bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : "#fff",
                                                                        "& fieldset": { border: "none" },
                                                                        "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.01)" },
                                                                        "&.Mui-focused": { bgcolor: isDarkMode ? "rgba(255,255,255,0.08)" : "#fff" },
                                                                        "& input": { p: 1.5, fontSize: '0.875rem', color: isDarkMode ? '#F9FAFB' : '#111827' }
                                                                    }
                                                                }}
                                                            />
                                                        )
                                                    ) : null
                                                )}
                                            </Box>
                                        </Box>
                                    );
                                })
                            ))}
                        </Box>
                    </Box>
                );
            })()}

            {/* Image Upload Renderer */}
            {f.type === "image_upload" && (
                <Box>
                    {(values[f.id] || values[f.id + "_preview"]) ? (
                        <Box sx={{ mb: isNested ? 0.5 : 1 }}>
                            <Box
                                component="img"
                                className={exportMode ? "pdf-upload-photo" : undefined}
                                src={
                                    values[f.id + "_preview"] ||
                                    (typeof values[f.id] === 'string' ? values[f.id] : null) ||
                                    ""
                                }
                                alt="uploaded"
                                sx={{ display: 'block', maxWidth: '100%', maxHeight: isNested ? 150 : 300, borderRadius: 2, border: '1px solid #ddd' }}
                            />
                            <ImageEvidenceDescriptionField
                                value={values[f.id + "_description"]}
                                onChange={(text) => handleChange(f.id + "_description", text)}
                                readOnly={readOnly}
                                exportMode={exportMode}
                            />
                            {!readOnly && (
                                <Button size="small" color="error" onClick={() => {
                                    handleChange(f.id, null);
                                    handleChange(f.id + "_preview", null);
                                    handleChange(f.id + "_description", null);
                                }} sx={{ display: 'block', mt: 1 }}>Remove</Button>
                            )}
                        </Box>
                    ) : (
                        !readOnly && (
                            <Button variant="outlined" component="label" fullWidth sx={{ height: isNested ? 60 : 100, borderStyle: 'dashed', borderRadius: "12px", fontSize: isNested ? '0.75rem' : 'inherit' }}>
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

            {/* Signature Renderer */}
            {f.type === "signature" && (() => {
                const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
                const justifyContent = alignMap[f.alignment] || 'flex-start';
                const displayValue =
                    values[f.id + "_preview"] ||
                    (typeof values[f.id] === "string" ? values[f.id] : null) ||
                    null;
                return (
                    <Box sx={{ display: 'flex', justifyContent, width: '100%' }}>
                        <Box sx={{ width: isNested ? '100%' : '340px', maxWidth: '100%' }}>
                            <SignatureCapture
                                value={displayValue}
                                onChange={(url) => {
                                    if (url == null) {
                                        handleChange(f.id, null);
                                        handleChange(f.id + "_preview", null);
                                    } else {
                                        handleChange(f.id, url);
                                        handleChange(f.id + "_preview", null);
                                    }
                                }}
                                readOnly={readOnly}
                                compact={isNested}
                            />
                        </Box>
                    </Box>
                );
            })()}

            {/* Logo Renderer */}
            {f.type === "logo" && (
                <Box sx={{ display: 'flex', justifyContent: f.alignment === 'center' ? 'center' : f.alignment === 'right' ? 'flex-end' : 'flex-start', width: '100%', mb: isNested ? 0.5 : 2 }}>
                    {(values[f.id] || values[f.id + "_preview"]) ? (
                        <Box sx={{ textAlign: f.alignment === 'center' ? 'center' : f.alignment === 'right' ? 'right' : 'left' }}>
                            <Box
                                component="img"
                                className={exportMode ? "pdf-upload-photo pdf-header-logo" : undefined}
                                src={
                                    values[f.id + "_preview"] ||
                                    (typeof values[f.id] === 'string' ? values[f.id] : null) ||
                                    ""
                                }
                                alt="Logo"
                                sx={{ height: isNested ? 40 : 80, width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
                            />
                            {!readOnly && (
                                <Button size="small" color="error" onClick={() => {
                                    handleChange(f.id, null);
                                    handleChange(f.id + "_preview", null);
                                }} sx={{ display: 'block', mt: 0.5, mx: f.alignment === 'center' ? 'auto' : 0, fontSize: '0.7rem' }}>Remove</Button>
                            )}
                        </Box>
                    ) : (
                        f.url ? (
                            <Box sx={{ textAlign: f.alignment === 'center' ? 'center' : f.alignment === 'right' ? 'right' : 'left' }}>
                                <Box component="img" className={exportMode ? "pdf-upload-photo pdf-header-logo" : undefined} src={f.url} alt="Logo" sx={{ height: isNested ? 40 : 80, width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
                                {!readOnly && (
                                    <Button size="small" component="label" sx={{ display: 'block', mt: 0.5, mx: f.alignment === 'center' ? 'auto' : 0, fontSize: '0.7rem' }}>
                                        Change Logo
                                        <input hidden accept="image/*" type="file" onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                const url = URL.createObjectURL(file);
                                                handleChange(f.id, file); // Store File object
                                                handleChange(f.id + "_preview", url); // Store preview URL
                                            }
                                        }} />
                                    </Button>
                                )}
                            </Box>
                        ) : (
                            !readOnly ? (
                                <Button variant="outlined" component="label" sx={{ height: isNested ? 50 : 80, width: 200, borderStyle: 'dashed', borderRadius: 2, textTransform: 'none', fontSize: isNested ? '0.7rem' : 'inherit' }}>
                                    Upload Logo
                                    <input hidden accept="image/*" type="file" onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            const url = URL.createObjectURL(file);
                                            handleChange(f.id, file); // Store File object
                                            handleChange(f.id + "_preview", url); // Store preview URL
                                        }
                                    }} />
                                </Button>
                            ) : (
                                <Box sx={{ p: isNested ? 0.5 : 1, border: '1px dashed #ccc', borderRadius: 2, bgcolor: '#f9f9f9', textAlign: 'center', width: isNested ? '100%' : 200, maxWidth: '100%', boxSizing: 'border-box' }}>
                                    <Typography variant="caption" color="text.secondary">No Logo</Typography>
                                </Box>
                            )
                        )
                    )}
                </Box>
            )}

        </Box>
    );

    return (
        <Box sx={{ position: "relative" }}>
            {logoUrl && (
                <Box
                    component="img"
                    className={exportMode ? "pdf-header-logo" : undefined}
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
                    pr: logoUrl ? 10 : 0,
                }}
            >
                {form.title}
            </Typography>

            {form.fields.map(f => renderFieldItem(f, false))}

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
                    {isSubmitting ? "Submitting..." : submitLabel}
                </Button>
            )}
        </Box>
    );
}
