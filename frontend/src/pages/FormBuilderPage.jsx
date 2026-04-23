// src/pages/FormBuilderPage.jsx
import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
  MenuItem,
  Select,
  Tooltip,
  Checkbox,
  Radio,
  FormControlLabel,
  RadioGroup,
  useMediaQuery,
  useTheme,
  Drawer,
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EventIcon from "@mui/icons-material/Event";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import LaptopMacIcon from "@mui/icons-material/LaptopMac";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import DrawOutlinedIcon from "@mui/icons-material/DrawOutlined";
import ViewHeadlineIcon from "@mui/icons-material/ViewHeadline";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import GridOnIcon from "@mui/icons-material/GridOn";

import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import Popover from "@mui/material/Popover";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";


import Layout from "../components/Layout";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

import api from "../services/api";


const IconSvg = ({ name, size = 15, color = "warning.main" }) => {
  const lightGreen = "#22c55e";
  const blue = "#2563eb";

  const muiIcons = {
    Date: <CalendarTodayIcon sx={{ fontSize: size, color }} />,
    Time: <AccessTimeIcon sx={{ fontSize: size, color }} />,
    DateTime: <EventIcon sx={{ fontSize: size, color }} />,
    MonthYear: <EventAvailableIcon sx={{ fontSize: size, color }} />,
    FileUpload: (
      <FileUploadOutlinedIcon sx={{ fontSize: size, color: lightGreen }} />
    ),
    Save: <SaveOutlinedIcon sx={{ fontSize: size, color: "white" }} />,
    Eye: <VisibilityOutlinedIcon sx={{ fontSize: size, color: blue }} />,
    ImageUpload: <ImageOutlinedIcon sx={{ fontSize: size, color: "#9333ea" }} />, // Purple
    Signature: <DrawOutlinedIcon sx={{ fontSize: size, color: "#ea580c" }} />, // Orange
    SectionHeader: <ViewHeadlineIcon sx={{ fontSize: size, color: "#0ea5e9" }} />, // Sky Blue
    Logo: <AddPhotoAlternateIcon sx={{ fontSize: size, color: "#f59e0b" }} />, // Amber/Yellow for logo
    GridOn: <GridOnIcon sx={{ fontSize: size, color: "#10b981" }} />, // Emerald Green
  };

  if (muiIcons[name]) return muiIcons[name];

  const iconMap = {
    TextSingle: "singleline.svg",
    TextMulti: "multiline.svg",
    Dropdown: "dropdown.svg",
    Radio: "/radio.svg",
    Checkbox: "checkbox.svg",
    ExampleUploadedPNG: "/mnt/data/30687653-be1f-4880-b3f3-4221e812f970.png",
  };

  const src = iconMap[name] || iconMap.ExampleUploadedPNG;

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
};

const uid = () => Math.random().toString(36).slice(2, 9);


const TOOLBOX_CATEGORIES = [

  {
    title: "Text Fields",
    items: [
      { type: "text", label: "Single Line", icon: "TextSingle" },
      { type: "textarea", label: "Multi Line", icon: "TextMulti" },
      { type: "section_header", label: "Section Header", icon: "SectionHeader" },
      { type: "grid", label: "Grid / Table", icon: "GridOn" },
    ],
  },
  {
    title: "Choices",
    items: [
      { type: "select", label: "Dropdown", icon: "Dropdown" },
      { type: "radio", label: "Radio", icon: "Radio" },
      { type: "checkbox", label: "Checkbox", icon: "Checkbox" },
    ],
  },
  {
    title: "Date & Time",
    items: [
      { type: "date", label: "Date", icon: "Date" },
      { type: "time", label: "Time", icon: "Time" },
      { type: "datetime", label: "Date-Time", icon: "DateTime" },
      { type: "monthyear", label: "Month-Year", icon: "MonthYear" },
    ],
  },
  {
    title: "Uploads & Sign",
    items: [
      { type: "image_upload", label: "Image Upload", icon: "ImageUpload" },
      { type: "logo", label: "Logo", icon: "Logo" },
      { type: "signature", label: "Signature", icon: "Signature" },
    ],
  },
];

const findTemplateByType = (type) => {
  for (const cat of TOOLBOX_CATEGORIES) {
    const found = cat.items.find((it) => it.type === type);
    if (found) return found;
  }
  return null;
};


function makeField(template) {
  const id = uid();
  const base = {
    id,
    type: template.type,
    label: template.label,
    name: (template.type + "_" + id)
      .replace(/[^a-z0-9_-]/gi, "")
      .toLowerCase(),
    required: false,
  };

  if (
    template.type === "select" ||
    template.type === "radio" ||
    template.type === "checkbox" ||
    template.type === "multiple" ||
    template.type === "image_choices"
  ) {
    base.options = [
      { id: uid(), label: "Option 1", value: "option_1" },
      { id: uid(), label: "Option 2", value: "option_2" },
    ];
  }

  if (template.type === "section_header") {
    return {
      ...base,
      label: "", // Empty label for section header
      subheading: "Add a subheading",
      color: "#000000",
      alignment: "left"
    };
  }

  if (template.type === "logo") {
    return {
      ...base,
      label: "",
      url: null,
      alignment: "left",
    };
  }

  if (template.type === "grid") {
    return {
      ...base,
      label: "Data Grid",
      rows: 3,
      cols: 3,
      colWidths: [150, 150, 150],
      rowHeights: [50, 50, 50],
      cellLabels: {},
      cellFields: {},
    };
  }

  return base;
}

const getDynamicFontSize = (text, baseSize = '1rem') => {
  if (!text || typeof text !== 'string') return baseSize;
  const length = text.length;
  if (length < 40) return baseSize;
  if (length < 80) return `calc(${baseSize} * 0.9)`;
  if (length < 150) return `calc(${baseSize} * 0.85)`;
  return `calc(${baseSize} * 0.75)`;
};

const CanvasFieldItem = ({ f, index, selectedFieldId, setSelectedFieldId, openEdit, onDelete, renderFieldInput, isNested = false }) => {
  return (
    <Draggable key={f.id} draggableId={f.id} index={index}>
      {(dr) => {
        const isSelected = selectedFieldId === f.id;
        return (
          <Box
            ref={dr.innerRef}
            {...dr.draggableProps}
            {...dr.dragHandleProps}
            onClick={(e) => { e.stopPropagation(); setSelectedFieldId(f.id); }}
            sx={{
              py: isNested ? 0.5 : 3,
              px: isNested ? 0.5 : 1,
              borderBottom: isNested ? "none" : "1px solid #eee",
              backgroundColor: isSelected ? "#f9fffc" : (isNested ? "transparent" : "#ffffff"),
              cursor: "grab",
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              overflow: "hidden"
            }}
            style={dr.draggableProps.style}
          >
            <Typography sx={{ 
              fontWeight: 600, 
              mb: isNested ? 0.2 : 1.5, 
              fontSize: getDynamicFontSize(
                f.type === "section_header" ? f.subheading : f.label,
                isNested ? '0.75rem' : '1rem'
              ), 
              whiteSpace: "normal", 
              wordBreak: "break-word",
              lineHeight: 1.3
            }}>
              {f.type === "section_header" ? (
                f.subheading || "Section Header"
              ) : f.type === "logo" ? (
                "Logo"
              ) : !f.label && f.type === "grid" ? (
                null
              ) : (
                f.label
              )}
            </Typography>

            {renderFieldInput(f, isNested)}

            <Box sx={{ mt: 1.5, display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Tooltip title="Edit field">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(f);
                  }}
                  sx={{ border: "1px solid #e5e7eb", borderRadius: 2 }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Delete field">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(f);
                  }}
                  sx={{
                    border: "1px solid #ef4444",
                    borderRadius: 2,
                    color: "#ef4444",
                    "&:hover": { backgroundColor: "#fee2e2" },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        );
      }}
    </Draggable>
  );
};

const GridFieldPreview = ({ field, onChange, selectedFieldId, setSelectedFieldId, openEdit, setFields, renderFieldInput, CanvasFieldItem }) => {
  const rows = field.rows || 3;
  const cols = field.cols || 3;
  
  const getColWidths = () => {
    const w = field.colWidths || [];
    return Array.from({ length: cols }).map((_, i) => w[i] || 150);
  };
  const getRowHeights = () => {
    const h = field.rowHeights || [];
    return Array.from({ length: rows }).map((_, i) => h[i] || 50);
  };

  const colWidths = getColWidths();
  const rowHeights = getRowHeights();
  const cellLabels = field.cellLabels || {};

  const handleCellLabelChange = (r, c, val) => {
    onChange({ cellLabels: { ...cellLabels, [`${r}_${c}`]: val } });
  };

  const handleColResize = (c, e) => {
    e.preventDefault();
    e.stopPropagation();
    const isTouch = e.type === 'touchstart';
    const startX = isTouch ? e.touches[0].clientX : e.clientX;
    const startWidth = colWidths[c];
    
    document.body.style.userSelect = 'none';
    if (!isTouch) document.body.style.cursor = 'col-resize';
    
    const onMove = (moveEvent) => {
      const currentX = isTouch ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = currentX - startX;
      let newWidth = startWidth + deltaX;
      if (newWidth < 50) newWidth = 50;
      
      const newWidths = [...colWidths];
      newWidths[c] = newWidth;
      onChange({ colWidths: newWidths });
    };
    
    const onEnd = () => {
      document.body.style.userSelect = '';
      if (!isTouch) document.body.style.cursor = '';
      if (isTouch) {
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onEnd);
      } else {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onEnd);
      }
    };
    
    if (isTouch) {
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onEnd);
    } else {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onEnd);
    }
  };

  const handleRowResize = (r, e) => {
    e.preventDefault();
    e.stopPropagation();
    const isTouch = e.type === 'touchstart';
    const startY = isTouch ? e.touches[0].clientY : e.clientY;
    const startHeight = rowHeights[r];
    
    document.body.style.userSelect = 'none';
    if (!isTouch) document.body.style.cursor = 'row-resize';
    
    const onMove = (moveEvent) => {
      const currentY = isTouch ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaY = currentY - startY;
      let newHeight = startHeight + deltaY;
      if (newHeight < 30) newHeight = 30;
      
      const newHeights = [...rowHeights];
      newHeights[r] = newHeight;
      onChange({ rowHeights: newHeights });
    };
    
    const onEnd = () => {
      document.body.style.userSelect = '';
      if (!isTouch) document.body.style.cursor = '';
      if (isTouch) {
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onEnd);
      } else {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onEnd);
      }
    };
    
    if (isTouch) {
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onEnd);
    } else {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onEnd);
    }
  };

  const gridTemplateColumns = colWidths.map(w => `${w}px`).join(' ');
  const gridTemplateRows = rowHeights.map(h => `minmax(${h}px, auto)`).join(' ');

  return (
    <Box sx={{ overflowX: 'auto', p: 1 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns, gridTemplateRows, gap: 0, width: 'fit-content', borderTop: '1px solid #cbd5e1', borderLeft: '1px solid #cbd5e1' }}>
        {Array.from({ length: rows }).map((_, r) => (
          Array.from({ length: cols }).map((_, c) => {
            const cellKey = `${r}_${c}`;
            const cellItems = field.cellFields?.[cellKey] || [];
            return (
              <Droppable key={cellKey} droppableId={`cell-${field.id}-${r}-${c}`}>
                {(provided, snapshot) => (
                  <Box 
                    ref={provided.innerRef} 
                    {...provided.droppableProps}
                    sx={{ position: 'relative', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', bgcolor: snapshot.isDraggingOver ? '#f0fdf4' : '#fff', display: 'flex', flexDirection: 'column' }}
                  >
                    {cellItems.map((sf, sfIndex) => (
                      <CanvasFieldItem 
                        key={sf.id} 
                        f={sf} 
                        index={sfIndex} 
                        selectedFieldId={selectedFieldId}
                        setSelectedFieldId={setSelectedFieldId}
                        openEdit={openEdit}
                        onDelete={(subF) => {
                          const newCellFields = { ...field.cellFields };
                          newCellFields[cellKey] = newCellFields[cellKey].filter(x => x.id !== subF.id);
                          onChange({ cellFields: newCellFields });
                          if (selectedFieldId === subF.id) setSelectedFieldId(null);
                        }}
                        renderFieldInput={renderFieldInput}
                        isNested={true}
                      />
                    ))}
                    
                    {cellItems.length === 0 && (
                      <TextField 
                        variant="standard" 
                        fullWidth 
                        placeholder="Text Input" 
                        value={cellLabels[cellKey] || ""}
                        onChange={(e) => handleCellLabelChange(r, c, e.target.value)}
                        InputProps={{ disableUnderline: true, sx: { px: 1, fontSize: '0.875rem' } }}
                        sx={{ height: '100%', flexGrow: 1, display: 'flex', justifyContent: 'center' }}
                      />
                    )}

                    {provided.placeholder}

                    {/* Right Resizer (Column Width) */}
                    <Box 
                      component="button"
                      type="button"
                      onMouseDown={(e) => handleColResize(c, e)}
                      onTouchStart={(e) => handleColResize(c, e)}
                      sx={{
                        position: 'absolute',
                        right: -3,
                        top: 0,
                        bottom: 0,
                        width: 6,
                        cursor: 'col-resize',
                        zIndex: 1,
                        border: 'none',
                        p: 0,
                        m: 0,
                        minWidth: 0,
                        bgcolor: 'transparent',
                        '&:hover': { bgcolor: 'primary.main', opacity: 0.5 }
                      }}
                    />

                    {/* Bottom Resizer (Row Height) */}
                    <Box 
                      component="button"
                      type="button"
                      onMouseDown={(e) => handleRowResize(r, e)}
                      onTouchStart={(e) => handleRowResize(r, e)}
                      sx={{
                        position: 'absolute',
                        bottom: -3,
                        left: 0,
                        right: 0,
                        height: 6,
                        cursor: 'row-resize',
                        zIndex: 1,
                        border: 'none',
                        p: 0,
                        m: 0,
                        minHeight: 0,
                        bgcolor: 'transparent',
                        '&:hover': { bgcolor: 'primary.main', opacity: 0.5 }
                      }}
                    />
                  </Box>
                )}
              </Droppable>
            );
          })
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Drag the cell borders to resize columns and rows. Type text to set static cell headers, or drag fields directly into the cells.
      </Typography>
    </Box>
  );
};


export default function FormBuilderPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [toolboxOpen, setToolboxOpen] = useState(false);



  const [formTitle, setFormTitle] = useState(() => {
    return localStorage.getItem("formbuilder_title") || "";
  });

  const [formTitleColor, setFormTitleColor] = useState(() => {
    return localStorage.getItem("formbuilder_titleColor") || "#000000";
  });
  const [titleAlignment, setTitleAlignment] = useState(() => {
    return localStorage.getItem("formbuilder_titleAlignment") || "left";
  });
  const [settingsAnchorEl, setSettingsAnchorEl] = useState(null);

  // Update localStorage when title settings change
  useEffect(() => {
    localStorage.setItem("formbuilder_title", formTitle);
    localStorage.setItem("formbuilder_titleColor", formTitleColor);
    localStorage.setItem("formbuilder_titleAlignment", titleAlignment);
  }, [formTitle, formTitleColor, titleAlignment]);

  const [fields, setFields] = useState(() => {
    try {
      const saved = localStorage.getItem("formbuilder_form");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [editingField, setEditingField] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState(null);

  const [previewMode, setPreviewMode] = useState("desktop");
  const [isSaving, setIsSaving] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const [isFetching, setIsFetching] = useState(false);

  // Fetch form data if editId is provided
  useEffect(() => {
    if (editId) {
      setIsFetching(true);
      api.get(`/forms/${editId}`)
        .then(res => {
          if (res?.data?.success && res.data.data) {
            const form = res.data.data;
            setFormTitle(form.title || "");
            setFormTitleColor(form.titleColor || "#000000");
            setTitleAlignment(form.titleAlignment || "left");
            setFields(form.fields || []);
          }
        })
        .catch(err => console.error("Error fetching form:", err))
        .finally(() => setIsFetching(false));
    }
  }, [editId]);

  const [successOpen, setSuccessOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await api.post("/forms/upload-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        setEditingField((prev) => ({
          ...prev,
          url: res.data.url,
        }));
      }
    } catch (error) {
      console.error("Logo upload failed", error);
      alert("Failed to upload logo");
    } finally {
      setIsUploading(false);
    }
  };




  const [fieldValues, setFieldValues] = useState({});

  const handleRadioChange = (fieldId, value) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleCheckboxToggle = (fieldId, optionValue) => {
    setFieldValues((prev) => {
      const current = Array.isArray(prev[fieldId]) ? prev[fieldId] : [];
      const exists = current.includes(optionValue);
      const next = exists
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return {
        ...prev,
        [fieldId]: next,
      };
    });
  };


  const saveToLocal = async () => {
    if (!fields.length) {
      alert("Add at least one field before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: formTitle || "Untitled Form",
        titleColor: formTitleColor,
        titleAlignment,
        fields,
      };

      let res;
      if (editId) {
        res = await api.put(`/forms/${editId}`, payload);
      } else {
        res = await api.post("/forms", payload);
      }

      if (!res?.data?.success) {
        alert(res?.data?.message || "Failed to save form");
        return;
      }

      // ✅ Open success modal
      setSuccessOpen(true);

    } catch (err) {
      console.error("Error saving form:", err);
      alert("Something went wrong while saving the form");
    } finally {
      setIsSaving(false);
    }
  };


  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const destId = destination.droppableId;
    const isCanvas = destId === "canvas";
    const isCell = destId.startsWith("cell-");

    if (!isCanvas && !isCell) return;

    // Handle dropping new item from toolbox
    if (source.droppableId.startsWith("toolbox-")) {
      const type = draggableId.replace("tool-", "");
      const template = findTemplateByType(type);
      if (!template) return;

      const newField = makeField(template);

      setFields((prev) => {
        const next = JSON.parse(JSON.stringify(prev));

        if (isCanvas) {
          next.splice(destination.index, 0, newField);
        } else if (isCell) {
          const parts = destId.split("-");
          const gridId = parts[1];
          const cellCoord = `${parts[2]}_${parts[3]}`;
          const grid = next.find(f => f.id === gridId);
          if (grid) {
            if (!grid.cellFields) grid.cellFields = {};
            if (!grid.cellFields[cellCoord]) grid.cellFields[cellCoord] = [];
            grid.cellFields[cellCoord].splice(destination.index, 0, newField);
          }
        }
        return next;
      });
      setSelectedFieldId(newField.id);
      return;
    }

    // Moving existing items (canvas -> cell, cell -> canvas, cell -> cell, reordering)
    setFields((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let movedField = null;

      // 1. Pop from source
      if (source.droppableId === "canvas") {
        movedField = next.splice(source.index, 1)[0];
      } else if (source.droppableId.startsWith("cell-")) {
        const parts = source.droppableId.split("-");
        const gridId = parts[1];
        const cellCoord = `${parts[2]}_${parts[3]}`;
        const grid = next.find(f => f.id === gridId);
        if (grid && grid.cellFields && grid.cellFields[cellCoord]) {
          movedField = grid.cellFields[cellCoord].splice(source.index, 1)[0];
        }
      }

      if (!movedField) return prev;

      // 2. Inject into dest
      if (destId === "canvas") {
        next.splice(destination.index, 0, movedField);
      } else if (isCell) {
        const parts = destId.split("-");
        const gridId = parts[1];
        const cellCoord = `${parts[2]}_${parts[3]}`;
        const grid = next.find(f => f.id === gridId);
        if (grid) {
          if (!grid.cellFields) grid.cellFields = {};
          if (!grid.cellFields[cellCoord]) grid.cellFields[cellCoord] = [];
          grid.cellFields[cellCoord].splice(destination.index, 0, movedField);
        }
      }

      return next;
    });
  };

  const openEdit = (field) => setEditingField({ ...field });
  const closeEdit = () => setEditingField(null);

  const saveEdit = () => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id === editingField.id) {
          // Ensure we return a new object with all properties from editingField
          return { ...editingField };
        }
        return f;
      })
    );
    closeEdit();
  };

  const addOption = () => {
    const newId = uid();

    setEditingField((f) => ({
      ...f,
      options: [
        ...(f.options || []),
        {
          id: newId,
          label: "New option",
          value: `option_${newId}`,
        },
      ],
    }));
  };


  const updateOption = (optId, patch) => {
    setEditingField((f) => ({
      ...f,
      options: (f.options || []).map((o) =>
        o.id === optId ? { ...o, ...patch } : o
      ),
    }));
  };

  const removeOptionEditing = (optId) => {
    setEditingField((f) => ({
      ...f,
      options: (f.options || []).filter((o) => o.id !== optId),
    }));
  };

  // save to DB (and optionally localStorage)




  const canvasPreview = useMemo(() => fields, [fields]);

  const renderFieldInput = (f, isNested = false) => {
    const inputSx = {
      "& .MuiOutlinedInput-root": {
        borderRadius: "12px",
      },
    };

    if (f.type === "text") return <TextField fullWidth sx={inputSx} />;
    if (f.type === "textarea")
      return <TextField fullWidth multiline minRows={3} sx={inputSx} />;
    if (f.type === "date") return <TextField fullWidth type="date" sx={inputSx} />;
    if (f.type === "time") return <TextField fullWidth type="time" sx={inputSx} />;
    if (f.type === "datetime")
      return <TextField fullWidth type="datetime-local" sx={inputSx} />;
    if (f.type === "monthyear") return <TextField fullWidth type="month" sx={inputSx} />;

    // Updated: Image Upload (accepts images)
    if (f.type === "image_upload")
      return (
        <Box sx={{ border: "2px dashed #cbd5e1", borderRadius: "8px", p: isNested ? 0.5 : 3, textAlign: "center", bgcolor: "#f8fafc", color: "text.secondary", transition: "all 0.2s", "&:hover": { borderColor: "#E89F17", bgcolor: "#fffbeb" }, boxSizing: 'border-box', overflow: 'hidden' }}>
          <Box sx={{ mb: 1 }}><ImageOutlinedIcon sx={{ fontSize: isNested ? 24 : 36, opacity: 0.6, color: "#9333ea" }} /></Box>
          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: isNested ? '0.75rem' : 'inherit' }}>{isNested ? "Upload" : "Click to upload image"}</Typography>
        </Box>
      );

    // New: Signature Placeholder
    if (f.type === "signature") {
      const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
      const justifyContent = alignMap[f.alignment] || 'flex-start';
      return (
        <Box sx={{ display: 'flex', justifyContent, width: '100%' }}>
            <Box sx={{ border: "2px dashed #cbd5e1", borderRadius: "12px", minHeight: isNested ? 30 : 60, height: isNested ? 50 : 120, width: isNested ? '100%' : '300px', maxWidth: '100%', bgcolor: "#f8fafc", display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', transition: "all 0.2s", "&:hover": { borderColor: "#E89F17", bgcolor: "#fffbeb" }, boxSizing: 'border-box' }}>
            <Typography variant="body2" sx={{ fontStyle: 'italic', fontWeight: 500, userSelect: 'none', fontSize: isNested ? '0.75rem' : 'inherit' }}>Sign here</Typography>
            </Box>
        </Box>
      );
    }

    if (f.type === "select")
      return (
        <TextField select fullWidth sx={inputSx}>
          {f.options?.map((o) => (
            <MenuItem key={o.id} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      );

    if (f.type === "radio") {
      const value = fieldValues[f.id] ?? "";
      return (
        <RadioGroup
          value={value}
          onChange={(e) => handleRadioChange(f.id, e.target.value)}
        >
          {f.options?.map((o) => (
            <FormControlLabel
              key={o.id}
              value={o.value}
              control={
                <Radio
                  sx={{
                    "& .MuiSvgIcon-root": {
                      fontSize: 22,
                    },
                  }}
                />
              }
              label={o.label}
            />
          ))}
        </RadioGroup>
      );
    }

    if (f.type === "checkbox") {
      const selected = Array.isArray(fieldValues[f.id])
        ? fieldValues[f.id]
        : [];
      return (
        <Box>
          {f.options?.map((o) => (
            <FormControlLabel
              key={o.id}
              control={
                <Checkbox
                  checked={selected.includes(o.value)}
                  onChange={() => handleCheckboxToggle(f.id, o.value)}
                  sx={{
                    "& .MuiSvgIcon-root": {
                      fontSize: 20,
                    },
                  }}
                />
              }
              label={o.label}
            />
          ))}
        </Box>
      );
    }

    if (f.type === "multiple")
      return (
        <Typography sx={{ fontSize: 14 }}>
          Multiple choice preview
        </Typography>
      );

    if (f.type === "image_choices")
      return (
        <Typography sx={{ fontSize: 14 }}>
          Image choices preview
        </Typography>
      );

    if (f.type === "section_header")
      return (
        <Box sx={{ width: '100%', textAlign: f.alignment || 'left' }}>
          {f.subheading && (
            <Typography variant="h6" sx={{ fontWeight: 600, color: f.color || '#000' }}>
              {f.subheading}
            </Typography>
          )}
        </Box>
      );

    if (f.type === "logo") {
      const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
      const justifyContent = alignMap[f.alignment] || 'flex-start';
      return (
        <Box sx={{ display: 'flex', justifyContent, width: '100%', boxSizing: 'border-box' }}>
          {f.url ? (
            <Box component="img" src={f.url} alt="Logo" sx={{ height: isNested ? 40 : 60, width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
          ) : (
            <Box sx={{ p: isNested ? 1 : 2, border: '2px dashed #cbd5e1', borderRadius: 2, bgcolor: '#f8fafc', textAlign: 'center', width: isNested ? '100%' : 200, maxWidth: '100%', boxSizing: 'border-box' }}>
              <AddPhotoAlternateIcon sx={{ fontSize: isNested ? 20 : 30, color: '#f59e0b', mb: 0.5, opacity: 0.7 }} />
              <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: isNested ? '0.6rem' : '0.75rem', fontWeight: 500 }}>No Logo Uploaded</Typography>
            </Box>
          )}
        </Box>
      );
    }

    if (f.type === "grid") {
      return (
        <GridFieldPreview 
          field={f} 
          onChange={(patch) => {
            setFields(prev => prev.map(item => item.id === f.id ? { ...item, ...patch } : item));
          }}
          selectedFieldId={selectedFieldId}
          setSelectedFieldId={setSelectedFieldId}
          openEdit={openEdit}
          setFields={setFields}
          renderFieldInput={renderFieldInput}
          CanvasFieldItem={CanvasFieldItem}
        />
      );
    }

    return null;
  };

  const toolboxContent = (
    <Box sx={{ display: 'flex', gap: 3, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: 3 } }}>
      {TOOLBOX_CATEGORIES.map((cat, i) => (
        <Box key={cat.title || i} sx={{ minWidth: 'auto' }}>
          {cat.title && (
            <Typography sx={{ mb: 1, fontWeight: 700, fontSize: "0.75rem", color: "#64748b", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {cat.title}
            </Typography>
          )}

          <Droppable
            droppableId={`toolbox-${cat.title || i}`}
            isDropDisabled
            direction="horizontal"
          >
            {(provided) => (
              <Box
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  display: "flex",
                  gap: 1.5,
                }}
              >
                {cat.items.map((it, index) => (
                  <Draggable
                    key={it.type}
                    draggableId={`tool-${it.type}`}
                    index={index}
                  >
                    {(dr) => (
                      <Box
                        ref={dr.innerRef}
                        {...dr.draggableProps}
                        {...dr.dragHandleProps}
                        onClick={() => {
                          const tmpl = findTemplateByType(it.type);
                          if (!tmpl) return;
                          const newField = makeField(tmpl);
                          setFields((prev) => [...prev, newField]);
                          setSelectedFieldId(newField.id);
                          if (isMobile) setToolboxOpen(false);
                        }}
                        sx={{
                          height: 70,
                          width: 80,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "column",
                          cursor: "grab",
                          borderRadius: 2,
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#ffffff",
                          p: 0.5,
                          textAlign: "center",
                          transition: "all 150ms ease",
                          "&:hover": {
                            borderColor: "#2563eb",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                            transform: "translateY(-1px)",
                            backgroundColor: "#f8fafc"
                          },
                        }}
                        style={dr.draggableProps.style}
                      >
                        <Box sx={{ mb: 0.5 }}>
                          <IconSvg name={it.icon} size={20} />
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{ fontSize: 11, lineHeight: 1.2, color: "#475569" }}
                        >
                          {it.label}
                        </Typography>
                      </Box>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </Box>
      ))}
    </Box>
  );

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 0, position: "relative", height: "100%" }}>
        {/* Header Actions */}
        <Box
          sx={{
            mb: 2,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "flex-end",
            gap: 2,
          }}
        >
          <Box display="flex" gap={2} sx={{ width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? "space-between" : "flex-end" }}>
            <Button
              variant="outlined"
              startIcon={<IconSvg name="Eye" color="#E89F17" />}
              sx={{
                borderRadius: "12px",
                textTransform: "none",
                borderColor: "#cbd5e1",
                color: "#1e293b",
                fontWeight: 600,
                px: 3,
                py: 1,
                flex: isMobile ? 1 : "auto",
                "&:hover": { borderColor: "#E89F17", backgroundColor: "#fffbeb", color: "#E89F17" },
              }}
              onClick={() => {
                setPreviewMode(isMobile ? "mobile" : "desktop");
                setPreviewOpen(true);
              }}
            >
              Preview
            </Button>

            <Button
              variant="contained"
              startIcon={<IconSvg name="Save" color="#fff" />}
              sx={{
                borderRadius: "12px",
                textTransform: "none",
                backgroundColor: "#E89F17",
                color: "#fff",
                fontWeight: 600,
                px: 3,
                py: 1,
                flex: isMobile ? 1 : "auto",
                boxShadow: "none",
                "&:hover": { backgroundColor: "#d97706", boxShadow: "0px 4px 14px rgba(232, 159, 23, 0.4)" },
              }}
              onClick={saveToLocal}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </Box>
          
          {isMobile && (
            <Button
              variant="outlined"
              sx={{
                borderRadius: "12px",
                textTransform: "none",
                borderColor: "#2563eb",
                color: "#2563eb",
                fontWeight: 600,
                px: 3,
                py: 1.5,
                width: "100%",
                borderStyle: "dashed",
                borderWidth: "2px",
                "&:hover": { backgroundColor: "#f0fdf4" }
              }}
              onClick={() => setToolboxOpen(true)}
            >
              + Select Field
            </Button>
          )}
        </Box>

        <DragDropContext onDragEnd={onDragEnd}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: 'calc(100vh - 160px)' }}>
            
            {/* Top Toolbox (Desktop Only) */}
            {!isMobile && (
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2,
                  border: "1px solid #e5e7eb", 
                  borderRadius: 3, 
                  bgcolor: "#f8fafc", 
                }}
              >
                {toolboxContent}
              </Paper>
            )}

            {/* Canvas */}
            <Box
              sx={{
                flexGrow: 1,
                overflowY: "auto",
                pb: 10,
                display: 'flex',
                justifyContent: 'center',
                width: '100%'
              }}
            >
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, sm: 4, md: 5 },
                    minHeight: "100%",
                    mx: "auto",
                    height: "fit-content",
                    width: "100%",
                    maxWidth: 1200,
                    display: "flex",
                    flexDirection: "column",
                    border: "1px solid #e5e7eb",
                    borderRadius: 3,
                    backgroundColor: "#ffffff",
                    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                  }}
                >
                  {/* Form title input */}
                  <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
                    <TextField
                      fullWidth
                      placeholder="Enter form name"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          fontSize: "1.25rem",
                          fontWeight: 600,
                        },
                      }}
                    />
                    <IconButton
                      onClick={(e) => setSettingsAnchorEl(e.currentTarget)}
                      sx={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 2,
                      }}
                    >
                      <EditOutlinedIcon />
                    </IconButton>

                    <Popover
                      open={Boolean(settingsAnchorEl)}
                      anchorEl={settingsAnchorEl}
                      onClose={() => setSettingsAnchorEl(null)}
                      anchorOrigin={{
                        vertical: "bottom",
                        horizontal: "right",
                      }}
                      transformOrigin={{
                        vertical: "top",
                        horizontal: "right",
                      }}
                    >
                      <Box sx={{ p: 2, width: 250 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                          Title Color
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                          <input
                            type="color"
                            value={formTitleColor}
                            onChange={(e) => setFormTitleColor(e.target.value)}
                            style={{
                              width: "100%",
                              height: 40,
                              cursor: "pointer",
                              border: "1px solid #e5e7eb",
                              borderRadius: 4,
                            }}
                          />
                        </Box>

                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                          Alignment
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, bgcolor: "#f3f4f6", p: 0.5, borderRadius: 1 }}>
                          {[
                            { val: "left", icon: <FormatAlignLeftIcon /> },
                            { val: "center", icon: <FormatAlignCenterIcon /> },
                            { val: "right", icon: <FormatAlignRightIcon /> },
                          ].map((opt) => (
                            <IconButton
                              key={opt.val}
                              size="small"
                              onClick={() => setTitleAlignment(opt.val)}
                              sx={{
                                flex: 1,
                                bgcolor: titleAlignment === opt.val ? "#fff" : "transparent",
                                boxShadow: titleAlignment === opt.val ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                                "&:hover": { bgcolor: "#fff" },
                              }}
                            >
                              {opt.icon}
                            </IconButton>
                          ))}
                        </Box>
                      </Box>
                    </Popover>
                  </Box>






                  <Droppable droppableId="canvas">
                    {(provided, snapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{
                          minHeight: 400,
                          display: "flex",
                          flexDirection: "column",
                          flexGrow: 1,
                          width: "100%",
                          minWidth: "100%",
                          borderRadius: 2,
                          transition: "background 0.2s ease",
                          background: snapshot.isDraggingOver
                            ? "#f5f7ff"
                            : "transparent",
                        }}
                      >
                        {fields.length === 0 && (
                          <Box
                            sx={{
                              border: "1px dashed #d4d4d4",
                              borderRadius: 2,
                              bgcolor: "#fafafa",
                              py: 4,
                              px: 2,
                              textAlign: "center",
                              mb: 2,
                            }}
                          >
                            <Typography
                              variant="h6"
                              sx={{ fontWeight: 600, mb: 1 }}
                            >
                              Start building!
                            </Typography>
                            <Typography sx={{ color: "text.secondary" }}>
                              Drag fields from the left panel and drop here to
                              add them to your form.
                            </Typography>
                          </Box>
                        )}

                        {fields.map((f, i) => (
                          <CanvasFieldItem
                            key={f.id}
                            f={f}
                            index={i}
                            selectedFieldId={selectedFieldId}
                            setSelectedFieldId={setSelectedFieldId}
                            openEdit={openEdit}
                            onDelete={(subF) => {
                              setFields((x) => x.filter(ff => ff.id !== subF.id));
                              if (selectedFieldId === subF.id) setSelectedFieldId(null);
                            }}
                            renderFieldInput={renderFieldInput}
                          />
                        ))}

                        {provided.placeholder}
                      </Box>
                    )}
                  </Droppable>
                </Paper>
              </Box>
            </Box>

          <Drawer
            anchor="bottom"
            open={toolboxOpen}
            onClose={() => setToolboxOpen(false)}
            PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: 4 } }}
          >
            <Box sx={{ p: 3, maxHeight: "80vh", overflowY: "auto" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Select Field
                </Typography>
                <IconButton onClick={() => setToolboxOpen(false)}>
                  <Typography variant="h5" color="textSecondary" sx={{cursor:"pointer", lineHeight: 1}}>✕</Typography>
                </IconButton>
              </Box>
              {toolboxContent}
            </Box>
          </Drawer>
        </DragDropContext>

        {/* Edit field dialog */}
        <Dialog
          open={!!editingField}
          onClose={closeEdit}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Edit Field</DialogTitle>
          <DialogContent>
            {editingField && (
              <Box sx={{ mt: 1 }}>
                {/* LABEL - common (Hide for Section Header) */}
                {editingField.type !== "section_header" && (
                  <TextField
                    label="Field Label"
                    fullWidth
                    sx={{ mb: 2 }}
                    value={editingField.label}
                    onChange={(e) =>
                      setEditingField({
                        ...editingField,
                        label: e.target.value,
                      })
                    }
                  />
                )}

                {/* TEXT + TEXTAREA: only label -> nothing else needed */}

                {/* DROPDOWN / RADIO / CHECKBOX / MULTIPLE / IMAGE_CHOICES: options editing */}
                {(editingField.type === "select" ||
                  editingField.type === "radio" ||
                  editingField.type === "checkbox" ||
                  editingField.type === "multiple" ||
                  editingField.type === "image_choices") && (
                    <>
                      <Typography sx={{ fontWeight: 600, mb: 1 }}>
                        Options
                      </Typography>

                      {(editingField.options || []).map((opt) => (
                        <Stack
                          key={opt.id}
                          direction="row"
                          spacing={2}
                          sx={{ mb: 1 }}
                        >
                          <TextField
                            size="small"
                            fullWidth
                            label="Option label"
                            value={opt.label}
                            onChange={(e) =>
                              updateOption(opt.id, {
                                label: e.target.value,
                                value: `${opt.id}_${e.target.value
                                  .toLowerCase()
                                  .replace(/\s+/g, "_")}`,

                              })
                            }
                          />
                          <IconButton
                            onClick={() => removeOptionEditing(opt.id)}
                            sx={{
                              border: "1px solid #ef4444",
                              borderRadius: 2,
                              color: "#ef4444",
                              "&:hover": {
                                backgroundColor: "#fee2e2",
                              },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))}

                      <Button
                        variant="outlined"
                        onClick={addOption}
                        sx={{
                          mt: 1,
                          borderRadius: 2,
                          textTransform: "none",
                        }}
                      >
                        + Add Option
                      </Button>
                    </>
                  )}

                {/* LOGO EDITING */}
                {editingField.type === "logo" && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Logo Image
                    </Typography>
                    {editingField.url ? (
                      <Box sx={{ mb: 2, textAlign: 'center', border: '1px solid #eee', p: 2, borderRadius: 2 }}>
                        <Box component="img" src={editingField.url} alt="Logo" sx={{ height: 80, objectFit: 'contain' }} />
                        <Box sx={{ mt: 1 }}>
                          <Button size="small" component="label" sx={{ textTransform: 'none' }}>
                            Change Logo
                            <input hidden type="file" accept="image/*" onChange={handleLogoUpload} />
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        disabled={isUploading}
                        sx={{ height: 100, borderStyle: 'dashed', textTransform: 'none' }}
                      >
                        {isUploading ? "Uploading..." : "Upload Logo"}
                        <input hidden type="file" accept="image/*" onChange={handleLogoUpload} />
                      </Button>
                    )}
                  </Box>
                )}

                {/* SECTION HEADER EDITING */}
                {editingField.type === "section_header" && (
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      label="Subheading"
                      fullWidth
                      multiline
                      sx={{ mb: 2 }}
                      value={editingField.subheading || ""}
                      onChange={(e) =>
                        setEditingField({
                          ...editingField,
                          subheading: e.target.value,
                        })
                      }
                    />

                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Text Color
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                      <input
                        type="color"
                        value={editingField.color || "#000000"}
                        onChange={(e) =>
                          setEditingField({
                            ...editingField,
                            color: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          height: 40,
                          cursor: "pointer",
                          border: "1px solid #e5e7eb",
                          borderRadius: 4,
                        }}
                      />
                    </Box>
                  </Box>
                )}

                {/* GRID EDITING */}
                {editingField.type === "grid" && (
                  <Box sx={{ mt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          label="Rows"
                          type="number"
                          fullWidth
                          InputProps={{ inputProps: { min: 1, max: 20 } }}
                          value={editingField.rows || 3}
                          onChange={(e) =>
                            setEditingField({
                              ...editingField,
                              rows: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Columns"
                          type="number"
                          fullWidth
                          InputProps={{ inputProps: { min: 1, max: 10 } }}
                          value={editingField.cols || 3}
                          onChange={(e) =>
                            setEditingField({
                              ...editingField,
                              cols: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* SECTION HEADER OR SIGNATURE OR LOGO ALIGNMENT */}
                {(editingField.type === "section_header" || editingField.type === "signature" || editingField.type === "logo") && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Alignment
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      {["left", "center", "right"].map((align) => (
                        <Button
                          key={align}
                          variant={editingField.alignment === align ? "contained" : "outlined"}
                          onClick={() =>
                            setEditingField({
                              ...editingField,
                              alignment: align,
                            })
                          }
                          sx={{ textTransform: "capitalize", flex: 1 }}
                        >
                          {align}
                        </Button>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEdit}>Cancel</Button>
            <Button variant="contained" onClick={saveEdit}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Preview dialog with mobile / desktop toggle */}
        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle sx={{ pb: 1 }}>
            {/* ROW 1: Preview label + icons */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Typography sx={{ fontWeight: 600 }}>
                Form Preview
              </Typography>

              <Box sx={{ display: "flex", gap: 1 }}>
                {!isMobile && (
                  <>
                    <Tooltip title="Mobile view">
                      <IconButton
                        size="small"
                        onClick={() => setPreviewMode("mobile")}
                        sx={{
                          borderRadius: 2,
                          border:
                            previewMode === "mobile"
                              ? "1px solid #2563eb"
                              : "1px solid transparent",
                          backgroundColor:
                            previewMode === "mobile"
                              ? "rgba(37,99,235,0.08)"
                              : "transparent",
                        }}
                      >
                        <SmartphoneIcon
                          fontSize="small"
                          sx={{
                            color:
                              previewMode === "mobile"
                                ? "#2563eb"
                                : "#6b7280",
                          }}
                        />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Desktop view">
                      <IconButton
                        size="small"
                        onClick={() => setPreviewMode("desktop")}
                        sx={{
                          borderRadius: 2,
                          border:
                            previewMode === "desktop"
                              ? "1px solid #2563eb"
                              : "1px solid transparent",
                          backgroundColor:
                            previewMode === "desktop"
                              ? "rgba(37,99,235,0.08)"
                              : "transparent",
                        }}
                      >
                        <LaptopMacIcon
                          fontSize="small"
                          sx={{
                            color:
                              previewMode === "desktop"
                                ? "#2563eb"
                                : "#6b7280",
                          }}
                        />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            </Box>

            {/* ROW 2: Form title BELOW */}

          </DialogTitle>


          <DialogContent sx={{ bgcolor: "#f8fafc", pt: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                pb: 4,
              }}
            >
              <Box
                sx={{
                  width: previewMode === "mobile" ? 375 : "100%",
                  maxWidth: previewMode === "desktop" ? 800 : "none",
                  borderRadius: previewMode === "mobile" ? "32px" : "16px",
                  border:
                    previewMode === "mobile"
                      ? "8px solid #1e293b"
                      : "1px solid #e2e8f0",
                  boxShadow:
                    previewMode === "mobile"
                      ? "0 20px 40px rgba(15,23,42,0.2)"
                      : "0 10px 30px rgba(0,0,0,0.05)",
                  p: previewMode === "mobile" ? 3 : 5,
                  backgroundColor: "#ffffff",
                  minHeight: previewMode === "mobile" ? 700 : "auto",
                  transition: "all 0.3s ease",
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: "1.75rem",
                    lineHeight: 1.2,
                    mb: 4,
                    color: formTitleColor || "#0f172a",
                    textAlign: titleAlignment || "left",
                    borderBottom: "2px solid #f1f5f9",
                    paddingBottom: 2,
                  }}
                >
                  {formTitle || "Untitled Form"}
                </Typography>
                {canvasPreview.map((f) => (
                  <Box key={f.id} sx={{ mb: 4 }}>
                    {f.type !== "section_header" && f.type !== "logo" && (
                      <Typography sx={{ fontWeight: 600, mb: 1.5, color: "#334155" }}>
                        {f.label} {f.required && <span style={{ color: "#ef4444" }}>*</span>}
                      </Typography>
                    )}
                    {renderFieldInput(f)}
                  </Box>
                ))}
              </Box>
            </Box>
          </DialogContent>



          <DialogActions sx={{ px: 3, py: 2, bgcolor: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
            <Button
              variant="contained"
              onClick={() => setPreviewOpen(false)}
              sx={{
                borderRadius: "10px",
                textTransform: "none",
                fontWeight: 600,
                px: 3,
                bgcolor: "#E89F17",
                "&:hover": { bgcolor: "#d97706" },
              }}
            >
              Close Preview
            </Button>
          </DialogActions>
        </Dialog>


        {/* ✅ SUCCESS DIALOG (ROOT LEVEL) */}
        <Dialog 
          open={successOpen} 
          maxWidth="xs" 
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 4,
              p: 1
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>
            Form Saved Successfully 🎉
          </DialogTitle>

          <DialogContent>
            <Typography>
              Your form has been saved successfully.
            </Typography>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              variant="contained"
              sx={{ 
                textTransform: "none",
                borderRadius: 4,
                px: 3,
                py: 1,
                bgcolor: "hsl(38, 70%, 55%)",
                color: "white",
                fontWeight: 600,
                boxShadow: "none",
                "&:hover": { bgcolor: "hsl(38, 70%, 45%)", boxShadow: "none" }
              }}
              onClick={() => {
                // Close dialog
                setSuccessOpen(false);

                // Clear builder state
                setFormTitle("");
                setFormTitleColor("#000000");
                setTitleAlignment("left");
                setFields([]);

                localStorage.removeItem("formbuilder_title");
                localStorage.removeItem("formbuilder_titleColor");
                localStorage.removeItem("formbuilder_titleAlignment");
                localStorage.removeItem("formbuilder_form");

                // Redirect
                navigate("/forms");
              }}
            >
              Go to Forms
            </Button>
          </DialogActions>
        </Dialog>

      </Container>
    </Layout>
  );
}






