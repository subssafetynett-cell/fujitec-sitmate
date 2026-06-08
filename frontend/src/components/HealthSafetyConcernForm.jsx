import React, { useState } from "react";
import SignatureCapture from "./SignatureCapture";
import { resolveFormLogoSrc } from "../utils/formLogoUrl";

// --- STABLE HELPER COMPONENTS (Defined outside to prevent focus loss) ---

const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5 3l1-2h4l1 2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const PhotoUpload = ({ fieldId, readOnly, values, handleChange, previewImg, styles }) => {
  const preview = values[fieldId + "_preview"] || (typeof values[fieldId] === "string" ? values[fieldId] : null);
  
  if (readOnly && !preview) return <p style={{fontSize: 14, color: "#cbd5e1", fontStyle: "italic", marginTop: 10}}>No photo provided</p>;

  return (
    <div className="pdf-upload-photo" style={styles.photoBox}>
      {preview ? (
        <>
          <img src={preview} alt="preview" style={styles.photoBoxImg} />
          {!readOnly && (
            <button
              style={styles.removeBtn}
              onClick={() => { handleChange(fieldId, null); handleChange(fieldId + "_preview", null); }}
            >
              REMOVE
            </button>
          )}
        </>
      ) : (
        <>
          <CameraIcon />
          UPLOAD PHOTO
          {!readOnly && (
            <input
              type="file"
              accept="image/*"
              style={styles.fileInput}
              onChange={(e) => previewImg(e.target.files[0], fieldId)}
            />
          )}
        </>
      )}
    </div>
  );
};

const LogoUpload = ({ readOnly, values, logoUrl, handleChange, previewImg, styles, pdfLayout }) => {
  const preview = resolveFormLogoSrc(
    {
      company_logo: values.company_logo,
      company_logo_preview: values.company_logo_preview,
    },
    logoUrl
  );
  if (readOnly && !preview) return null;

  return (
    <div className="pdf-logo-box" style={styles.logoBox}>
      {preview ? (
        <>
          <img
            className="pdf-header-logo"
            src={preview}
            alt="Company Logo"
            crossOrigin={/^https?:\/\//i.test(preview) ? "anonymous" : undefined}
            style={{
              maxHeight: pdfLayout || readOnly ? 80 : "100%",
              maxWidth: pdfLayout || readOnly ? 200 : "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
            }}
          />
          {!readOnly && (
            <button
              style={{ ...styles.removeBtn, top: 2, right: 2, padding: "2px 6px", fontSize: 10 }}
              onClick={() => { handleChange("company_logo", null); handleChange("company_logo_preview", null); }}
            >
              ✕
            </button>
          )}
        </>
      ) : (
        <>
          <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textAlign: "center", padding: 6 }}>COMPANY LOGO</span>
          {!readOnly && (
            <input
              type="file"
              accept="image/*"
              style={styles.fileInput}
              onChange={(e) => previewImg(e.target.files[0], "company_logo")}
            />
          )}
        </>
      )}
    </div>
  );
};

const SectionHeading = ({ section, readOnly, onUpdate, onRemove, onMove, onColorChange, styles }) => {
  if (readOnly) return <div style={{ ...styles.sectionLabel, background: section.color || styles.sectionLabel.background }}>{section.number} · {section.heading}</div>;

  return (
    <div style={{ position: "relative", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: 10 }}>
      <input
        style={{ ...styles.sectionLabel, background: section.color || styles.sectionLabel.background, flex: 1 }}
        value={section.heading}
        onChange={(e) => onUpdate(section.id, e.target.value)}
        placeholder="Section Heading"
      />
      {!readOnly && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input 
            type="color" 
            value={section.color || "#1e3a8a"} 
            onChange={(e) => onColorChange(section.id, e.target.value)}
            style={{ width: 24, height: 24, border: "none", padding: 0, background: "none", cursor: "pointer" }}
            title="Heading Color"
          />
          <button onClick={() => onMove(section.id, "up")} style={styles.moveBtn} title="Move Up">↑</button>
          <button onClick={() => onMove(section.id, "down")} style={styles.moveBtn} title="Move Down">↓</button>
          <button onClick={() => onRemove(section.id)} style={{ ...styles.moveBtn, color: "#ef4444" }} title="Delete Section">🗑️</button>
        </div>
      )}
    </div>
  );
};

const FieldWrapper = ({ sectionId, field, children, readOnly, onUpdateLabel, onRemove, onMove, styles }) => {
  return (
    <div style={{ ...styles.field, position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {readOnly ? (
          <label style={styles.label}>{field.label}</label>
        ) : (
          <input
            style={styles.label}
            value={field.label}
            onChange={(e) => onUpdateLabel(sectionId, field.id, e.target.value)}
            placeholder="Field Label"
          />
        )}
        {!readOnly && (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => onMove(sectionId, field.id, "up")} style={styles.miniMoveBtn}>↑</button>
            <button onClick={() => onMove(sectionId, field.id, "down")} style={styles.miniMoveBtn}>↓</button>
            <button 
              onClick={() => onRemove(sectionId, field.id)}
              style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", fontSize: 10 }}
              title="Delete Field"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {children}
    </div>
  );
};

// --- MAIN COMPONENT ---

const HealthSafetyConcernForm = ({
  values: externalValues,
  onChange,
  readOnly = false,
  formType = "health_safety",
  logoUrl = null,
  pdfLayout = false,
}) => {
  const [internalValues, setInternalValues] = useState({});
  const values = externalValues ?? internalValues;

  const handleChange = (fieldId, value) => {
    if (onChange) {
      onChange(fieldId, value);
    } else {
      setInternalValues((prev) => ({ ...prev, [fieldId]: value }));
    }
  };

  const handleCheckboxToggle = (fieldId, option) => {
    const current = Array.isArray(values[fieldId]) ? values[fieldId] : [];
    const newValue = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    handleChange(fieldId, newValue);
  };

  const previewImg = (file, fieldId) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    handleChange(fieldId, file);
    handleChange(fieldId + "_preview", url);
  };

  const healthSafetyOptions = [
    "Slip, trip, or fall", "Unsafe working at height", "Failure / misuse of equipment",
    "Electrical hazard", "Traffic movement", "Exposure to machinery",
    "Welfare issue", "Threatening behaviour", "Poor site access / egress",
    "Falling objects / equipment", "Mechanical hazards", "Exposure to harmful substances",
    "Fire hazard", "Noise / vibration", "Mesh lift shaft",
    "Stored energy (hydraulic)", "Open lattice car / gates", "No emergency intercom",
    "Unsafe wiring", "Unguarded machine", "No emergency stop",
    "Inadequate lift partition", "Inadequate lighting", "Unsafe machine room access",
    "Unsafe lift pit access", "Slipping on steps / landing", "Entrapment risks",
    "Trapping between skirting / step", "Sharp edges", "Unsafe scaffolding / platforms",
  ];

  const sustainabilityOptions = [
    "Waste segregation", "Oil, chemical spillages", "COSHH chemical storage",
    "Hazardous materials apparent, e.g., asbestos", "Emissions from scope of work",
    "Standing water", "Dust and air quality", "Vermin, protected species",
    "Excrement, effluent, needles", "No waste transfer / consignment notes", "Energy performance of lifts",
  ];

  const qualityOptions = [
    "Poor control and levelling accuracy", "Doors with no non-contact protection", "Obsolete components",
    "No form of signalisation", "Unlocking landing door without special tool", "No scope for future refurbishment",
    "No / inadequate balustrade on car", "No protection against ascending car overspeed", "No / inadequate load control",
    "Passenger behaviour", "Incorrect design of people flows", "Poor workmanship during installation",
    "Guiderails not aligned", "Landing doors not aligned", "Incorrect wiring",
    "Competence to perform task", "Communication issue", "Brake adjustments",
    "Switches and fuses", "User interface and fault codes", "Faulty controller",
    "Faulty car top controller", "Bearing malfunction or loud bearing",
  ];

  const incidentOptions =
    formType === "sustainability"
      ? sustainabilityOptions
      : formType === "quality"
      ? qualityOptions
      : healthSafetyOptions;

  const classificationTitle =
    formType === "sustainability"
      ? "Select one or more environmental or sustainability incidents"
      : formType === "quality"
      ? "Select one or more quality concern incidents"
      : "Select all applicable health and safety incidents";

  const formTitle =
    formType === "sustainability"
      ? "Environmental & Sustainability Concern"
      : formType === "quality"
      ? "Quality Concern"
      : "Health & Safety Concern";

  const resolvedTitle = values.report_heading?.trim() || formTitle;

  const styles = {
    wrap: {
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      width: "100%",
      maxWidth: 980,
      margin: "0 auto",
      padding: readOnly ? "0 0 32px 0" : "2.5rem 2rem",
      color: "#1e293b",
      background: "#ffffff",
      position: "relative",
      borderRadius: readOnly ? 0 : "16px",
      boxShadow: readOnly ? "none" : "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
    },
    header: {
      display: "flex",
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 24,
      marginBottom: "2.5rem",
      paddingBottom: "1.25rem",
      borderBottom: "2px solid #f1f5f9",
    },
    reportHeader: {
      position: "relative",
      marginBottom: "2.5rem",
      paddingBottom: "1.25rem",
      borderBottom: "2px solid #f1f5f9",
      minHeight: 88,
    },
    reportHeaderLogo: {
      position: "absolute",
      top: 0,
      right: 0,
      zIndex: 1,
    },
    reportHeaderTitle: {
      textAlign: "center",
      width: "100%",
      padding: "0 200px 0 24px",
      boxSizing: "border-box",
    },
    logoWrapper: {
      position: "static",
      marginTop: 0,
    },
    logoBox: {
      width: pdfLayout || readOnly ? 200 : 140,
      minWidth: pdfLayout || readOnly ? 180 : undefined,
      height: pdfLayout || readOnly ? 80 : 64,
      border: readOnly ? "1px solid transparent" : "2px dashed #e2e8f0",
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: readOnly ? "transparent" : "#f8fafc",
      position: "relative",
      overflow: pdfLayout || readOnly ? "visible" : "hidden",
      padding: pdfLayout || readOnly ? "4px 8px" : 0,
      boxSizing: "border-box",
      transition: "all 0.2s ease",
    },
    title: {
      fontSize: 28,
      fontWeight: pdfLayout ? 600 : 800,
      color: "#0f172a",
      margin: 0,
      letterSpacing: "-0.02em",
      textTransform: "none",
      width: "100%",
    },
    reportTitle: {
      fontSize: 28,
      fontWeight: pdfLayout ? 600 : 800,
      color: "#0f172a",
      margin: 0,
      letterSpacing: "-0.02em",
      textTransform: "none",
      textAlign: "center",
      lineHeight: 1.25,
    },
    section: { 
      marginBottom: "2.5rem",
      padding: readOnly ? 0 : "1.5rem",
      background: readOnly ? "transparent" : "#fff",
      borderRadius: 12,
      border: readOnly ? "none" : "1px solid #f1f5f9"
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: pdfLayout ? 600 : 700,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      color: "#ffffff",
      background: "#1e3a8a",
      marginBottom: "1.5rem",
      padding: readOnly ? "12px 16px" : "10px 16px",
      borderRadius: "8px",
      display: "block",
      width: "100%",
      border: "none",
      outline: "none",
      fontFamily: "inherit",
    },
    row: { display: "grid", gap: 20, marginBottom: 16 },
    col2: { gridTemplateColumns: "1fr 1fr" },
    col3: { gridTemplateColumns: "1fr 1fr 1fr" },
    field: { display: "flex", flexDirection: "column", gap: 8 },
    label: { 
      fontSize: 12, 
      color: "#475569", 
      fontWeight: pdfLayout ? 500 : 700, 
      textTransform: "uppercase", 
      letterSpacing: "0.025em", 
      marginBottom: 2,
      border: "none",
      background: "transparent",
      outline: "none",
      width: "100%",
      padding: 0,
      cursor: readOnly ? "default" : "text"
    },
    input: {
      fontSize: 14,
      fontWeight: pdfLayout ? 400 : undefined,
      color: "#1e293b",
      background: readOnly ? "transparent" : "#ffffff",
      border: readOnly ? "none" : "1px solid #e2e8f0",
      borderRadius: readOnly ? 0 : 10,
      padding: readOnly ? "4px 0" : "12px 14px",
      fontFamily: "inherit",
      outline: "none",
      width: "100%",
      minHeight: readOnly ? "24px" : "44px",
      lineHeight: "1.5",
      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    },
    textarea: {
      fontSize: 14,
      color: "#1e293b",
      background: readOnly ? "transparent" : "#ffffff",
      border: readOnly ? "none" : "1px solid #e2e8f0",
      borderRadius: readOnly ? 0 : 10,
      padding: readOnly ? "4px 0" : "12px 14px",
      fontFamily: "inherit",
      resize: "none",
      minHeight: readOnly ? "24px" : 100,
      outline: "none",
      width: "100%",
      lineHeight: "1.6",
      wordBreak: "break-word",
      transition: "all 0.2s ease",
    },
    checksGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "10px 24px",
      padding: readOnly ? 0 : "8px",
    },
    checkItem: { 
      display: "flex", 
      alignItems: "center", 
      gap: 10, 
      padding: "6px 8px",
      borderRadius: 8,
      transition: "background 0.2s ease",
    },
    checkLabel: { fontSize: 13, color: "#334155", lineHeight: 1.45, cursor: "pointer" },
    photoBox: {
      border: readOnly ? "1px solid transparent" : "2px dashed #e2e8f0",
      borderRadius: 12,
      minHeight: readOnly ? 140 : 110,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: readOnly ? "flex-start" : "center",
      background: readOnly ? "transparent" : "#f8fafc",
      color: "#64748b",
      fontSize: 12,
      fontWeight: 600,
      gap: 12,
      position: "relative",
      overflow: "hidden",
      marginTop: 6,
      transition: "all 0.2s ease",
    },
    photoBoxImg: { 
      maxHeight: readOnly ? "400px" : "100%", 
      maxWidth: "100%", 
      objectFit: "contain",
      borderRadius: readOnly ? 12 : 0
    },
    fileInput: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      cursor: "pointer",
      width: "100%",
      height: "100%",
    },
    divider: { height: "2px", background: "#f1f5f9", margin: "4rem 0" },
    sigBox: {
      border: readOnly ? "none" : "2px dashed #e2e8f0",
      borderRadius: readOnly ? 0 : 12,
      width: "100%",
      maxWidth: 520,
      padding: readOnly ? 0 : 12,
      color: "#64748b",
      fontSize: 13,
      background: readOnly ? "transparent" : "#f8fafc",
      position: "relative",
      transition: "all 0.2s ease",
    },
    footerRow: { display: "flex", alignItems: "flex-end", gap: 32, justifyContent: "flex-end" },
    reportSignatureRow: {
      display: "flex",
      justifyContent: "flex-end",
      width: "100%",
      marginTop: "3rem",
    },
    reportSignatureCol: {
      width: "100%",
      maxWidth: 320,
      textAlign: "right",
    },
    otherRow: { 
      display: "flex", 
      alignItems: "center", 
      gap: 12, 
      marginTop: 24,
      padding: readOnly ? 0 : "0 8px"
    },
    otherInput: {
      flex: 1,
      fontSize: 14,
      background: "transparent",
      border: "none",
      borderBottom: "2px solid #f1f5f9",
      padding: "8px 0",
      color: "#0f172a",
      fontFamily: "inherit",
      outline: "none",
      borderRadius: 0,
      minHeight: "30px",
      transition: "border-color 0.2s ease",
    },
    note: { 
      fontSize: 12, 
      color: "#94a3b8", 
      textAlign: "center", 
      marginTop: "2.5rem",
      display: readOnly ? "none" : "block",
      fontStyle: "italic"
    },
    removeBtn: {
      position: "absolute",
      top: 10,
      right: 10,
      background: "rgba(255,255,255,0.95)",
      border: "1px solid #e2e8f0",
      borderRadius: 8,
      cursor: "pointer",
      padding: "6px 12px",
      fontSize: 11,
      color: "#ef4444",
      fontWeight: 700,
      boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
      transition: "all 0.2s ease",
    },
    formFooter: {
      marginTop: "2rem",
      paddingTop: "1.25rem",
      borderTop: "2px solid #f8fafc",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      color: "#94a3b8",
      fontSize: 12,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.075em",
    },
    moveBtn: {
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: 6,
      cursor: "pointer",
      padding: "4px 8px",
      fontSize: 14,
      color: "#1e3a8a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s ease",
    },
    miniMoveBtn: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontSize: 12,
      color: "#94a3b8",
      padding: "0 2px",
      transition: "color 0.2s ease",
    }
  };

  const defaultSchema = [
    {
      id: "project_details",
      heading: "Project details",
      number: "1",
      fields: [
        { id: "report_date", label: "Report date", type: "date" },
        { id: "customer_reference", label: "Customer reference", type: "text" },
        { id: "project_name", label: "Project name", type: "text" },
        { id: "customer_name", label: "Customer name", type: "text" },
      ]
    },
    {
      id: "management",
      heading: "Management & contacts",
      number: "2",
      fields: [
        { id: "fujitec_manager", label: "Manager", type: "text" },
        { id: "fujitec_supervisor", label: "Supervisor", type: "text" },
        { id: "responsible_person", label: "Responsible engineer(s)", type: "text" },
        { id: "site_contact", label: "Site contact", type: "text" },
      ]
    },
    {
      id: "location",
      heading: "Location details",
      number: "3",
      fields: [
        { id: "full_address", label: "Full address", type: "textarea" },
        { id: "exact_location", label: "Exact location of incident", type: "textarea" },
      ]
    },
    {
      id: "classification",
      heading: "Incident classification",
      number: "4",
      fields: [],
      special: "incidents",
      options: incidentOptions
    },
    {
      id: "observations",
      heading: "Observations & suggestions",
      number: "5",
      fields: [
        { id: "observation_details", label: "Observation details", type: "textarea" },
        { id: "observation_photo", label: "Observation photo", type: "photo" },
        { id: "corrective_action", label: "Corrective action proposed", type: "textarea" },
        { id: "suggestion_photo", label: "Supporting photo", type: "photo" },
      ]
    },
    {
      id: "nonconformance",
      heading: "Nonconformance",
      number: "6",
      fields: [
        { id: "noncon_action", label: "Correction action", type: "textarea" },
        { id: "noncon_responsible", label: "Responsible person", type: "text" },
        { id: "noncon_date", label: "Date completed", type: "date" },
        { id: "noncon_photo", label: "Nonconformance photo", type: "photo" },
      ]
    }
  ];

  const [schema, setSchema] = useState(values.form_schema || defaultSchema);
  const [showResetModal, setShowResetModal] = useState(false);

  const updateSchema = (newSchema) => {
    setSchema(newSchema);
    handleChange("form_schema", newSchema);
  };

  const addField = (sectionId) => {
    const newSchema = schema.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          fields: [...s.fields, { id: `custom_${Date.now()}`, label: "New Field", type: "text" }]
        };
      }
      return s;
    });
    updateSchema(newSchema);
  };

  const removeField = (sectionId, fieldId) => {
    const newSchema = schema.map(s => {
      if (s.id === sectionId) {
        return { ...s, fields: s.fields.filter(f => f.id !== fieldId) };
      }
      return s;
    });
    updateSchema(newSchema);
  };

  const addSection = () => {
    const newId = `section_${Date.now()}`;
    const newSchema = [
      ...schema,
      { id: newId, heading: "New Section", number: (schema.length + 1).toString(), fields: [] }
    ];
    updateSchema(newSchema);
  };

  const removeSection = (sectionId) => {
    const newSchema = schema.filter(s => s.id !== sectionId);
    updateSchema(newSchema);
  };

  const updateSectionHeading = (sectionId, newHeading) => {
    const newSchema = schema.map(s => s.id === sectionId ? { ...s, heading: newHeading } : s);
    updateSchema(newSchema);
  };

  const updateFieldLabel = (sectionId, fieldId, newLabel) => {
    const newSchema = schema.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          fields: s.fields.map(f => f.id === fieldId ? { ...f, label: newLabel } : f)
        };
      }
      return s;
    });
    updateSchema(newSchema);
  };

  const moveField = (sectionId, fieldId, direction) => {
    const newSchema = schema.map(s => {
      if (s.id === sectionId) {
        const index = s.fields.findIndex(f => f.id === fieldId);
        const newFields = [...s.fields];
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex >= 0 && newIndex < newFields.length) {
          [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
        }
        return { ...s, fields: newFields };
      }
      return s;
    });
    updateSchema(newSchema);
  };

  const moveSection = (sectionId, direction) => {
    const index = schema.findIndex(s => s.id === sectionId);
    const newSchema = [...schema];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < newSchema.length) {
      [newSchema[index], newSchema[newIndex]] = [newSchema[newIndex], newSchema[index]];
    }
    updateSchema(newSchema);
  };

  const updateSectionColor = (sectionId, color) => {
    const newSchema = schema.map(s => s.id === sectionId ? { ...s, color } : s);
    updateSchema(newSchema);
  };

  const addIncidentOption = (sectionId) => {
    const newSchema = schema.map(s => {
      if (s.id === sectionId) {
        const currentOptions = s.options || incidentOptions;
        return { ...s, options: [...currentOptions, "New Incident Option"] };
      }
      return s;
    });
    updateSchema(newSchema);
  };

  const removeIncidentOption = (sectionId, optionIndex) => {
    const newSchema = schema.map(s => {
      if (s.id === sectionId) {
        const currentOptions = [...(s.options || incidentOptions)];
        currentOptions.splice(optionIndex, 1);
        return { ...s, options: currentOptions };
      }
      return s;
    });
    updateSchema(newSchema);
  };

  const updateIncidentOption = (sectionId, optionIndex, newValue) => {
    const newSchema = schema.map(s => {
      if (s.id === sectionId) {
        const currentOptions = [...(s.options || incidentOptions)];
        currentOptions[optionIndex] = newValue;
        return { ...s, options: currentOptions };
      }
      return s;
    });
    updateSchema(newSchema);
  };

  const resetLayout = () => {
    updateSchema(defaultSchema);
    setShowResetModal(false);
  };

  const ConfirmationModal = () => {
    if (!showResetModal) return null;
    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", 
        backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", 
        alignItems: "center", justifyContent: "center", padding: 20
      }}>
        <div style={{
          background: "#fff", borderRadius: 20, width: "100%", maxWidth: 400, 
          padding: 32, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          textAlign: "center"
        }}>
          <div style={{ 
            width: 64, height: 64, background: "#fee2e2", borderRadius: "50%", 
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 32
          }}>⚠️</div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>Reset Form Layout?</h3>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 32 }}>
            This will permanently undo all your custom sections, reordering, colors, and fields. This action cannot be undone.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button 
              onClick={() => setShowResetModal(false)}
              style={{ 
                flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0",
                background: "#fff", color: "#64748b", fontWeight: 700, cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button 
              onClick={resetLayout}
              style={{ 
                flex: 1, padding: "12px", borderRadius: 12, border: "none",
                background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)"
              }}
            >
              Yes, Reset
            </button>
          </div>
        </div>
      </div>
    );
  };

  const rootClassName = pdfLayout ? "pdf-export-root concern-pdf-export" : undefined;

  return (
    <div
      className={rootClassName}
      style={styles.wrap}
      data-pdf-form-title={pdfLayout ? resolvedTitle : undefined}
    >
      <ConfirmationModal />
      
      {/* Top Admin Toolbar */}
      {!readOnly && (
        <div className="pdf-hide-on-export" style={{ 
          display: "flex", 
          justifyContent: "flex-end", 
          paddingBottom: 15, 
          marginBottom: 20, 
          borderBottom: "1px solid #f1f5f9" 
        }}>
          <button 
            onClick={() => setShowResetModal(true)}
            style={{
              padding: "8px 16px",
              background: "#fee2e2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 800,
              color: "#ef4444",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "0 2px 4px rgba(239, 68, 68, 0.05)"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.1)";
              e.currentTarget.style.background = "#fef2f2";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 4px rgba(239, 68, 68, 0.05)";
              e.currentTarget.style.background = "#fee2e2";
            }}
          >
            <span style={{ fontSize: 14 }}>🔄</span> RESET LAYOUT
          </button>
        </div>
      )}

      {/* Header with Title and Logo */}
      {readOnly || pdfLayout ? (
        <div className="pdf-header concern-report-header" data-pdf-block style={styles.reportHeader}>
          <div className="concern-header-logo-slot" style={styles.reportHeaderLogo}>
            <LogoUpload
              readOnly={readOnly}
              values={values}
              logoUrl={logoUrl}
              handleChange={handleChange}
              previewImg={previewImg}
              styles={styles}
              pdfLayout={pdfLayout}
            />
          </div>
          <div className="concern-header-title" style={styles.reportHeaderTitle}>
            <h1 style={styles.reportTitle}>{resolvedTitle}</h1>
          </div>
        </div>
      ) : (
        <div className="pdf-header" data-pdf-block style={styles.header}>
          <div>
            <input
              style={{
                ...styles.title,
                border: "none",
                borderBottom: "2px solid #1e3a8a",
                background: "transparent",
                width: "100%",
                maxWidth: 720,
                padding: "0 0 6px 0",
                outline: "none",
              }}
              placeholder={formTitle}
              value={values.report_heading || ""}
              onChange={(e) => handleChange("report_heading", e.target.value)}
            />
          </div>
          <div style={styles.logoWrapper}>
            <LogoUpload
              readOnly={readOnly}
              values={values}
              logoUrl={logoUrl}
              handleChange={handleChange}
              previewImg={previewImg}
              styles={styles}
              pdfLayout={pdfLayout}
            />
          </div>
        </div>
      )}

      {/* Dynamic Sections */}
      {schema.map((section) => (
        <div key={section.id} data-pdf-block style={styles.section}>
          <SectionHeading 
            section={section} 
            readOnly={readOnly} 
            onUpdate={updateSectionHeading}
            onRemove={removeSection}
            onMove={moveSection}
            onColorChange={updateSectionColor}
            styles={styles}
          />
          
          <div style={{ ...styles.row, ...styles.col2 }}>
            {section.fields.map((field) => (
              <FieldWrapper 
                key={field.id} 
                sectionId={section.id} 
                field={field} 
                readOnly={readOnly}
                onUpdateLabel={updateFieldLabel}
                onRemove={removeField}
                onMove={moveField}
                styles={styles}
              >
                {field.type === "date" ? (
                  readOnly ? (
                    <div style={styles.input}>{values[field.id] || "N/A"}</div>
                  ) : (
                    <input
                      style={styles.input}
                      type="date"
                      value={values[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                    />
                  )
                ) : field.type === "textarea" ? (
                  readOnly ? (
                    <div style={{ ...styles.textarea, whiteSpace: "pre-wrap", minHeight: "auto" }}>
                      {values[field.id] || "N/A"}
                    </div>
                  ) : (
                    <textarea 
                      style={styles.textarea} 
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      value={values[field.id] || ""} 
                      onChange={(e) => {
                        e.target.style.height = 'inherit';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                        handleChange(field.id, e.target.value);
                      }} 
                    />
                  )
                ) : field.type === "photo" ? (
                  <PhotoUpload 
                    fieldId={field.id} 
                    readOnly={readOnly} 
                    values={values} 
                    handleChange={handleChange}
                    previewImg={previewImg}
                    styles={styles}
                  />
                ) : (
                  readOnly ? (
                    <div style={styles.input}>{values[field.id] || "N/A"}</div>
                  ) : (
                    <input
                      style={styles.input}
                      type="text"
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      value={values[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                    />
                  )
                )}
              </FieldWrapper>
            ))}
          </div>

          {/* Special Section: Incidents Checklist */}
          {section.special === "incidents" && formType !== "positive" && (
            <>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12, display: readOnly ? "none" : "block" }}>{classificationTitle}</p>
              <div style={styles.checksGrid}>
                {(section.options || incidentOptions).map((opt, idx) => (
                  <div key={idx} style={{ ...styles.checkItem, position: "relative" }}>
                    <input
                      type="checkbox"
                      id={`chk-${idx}`}
                      checked={values.incidents?.includes(opt) || false}
                      onChange={() => handleCheckboxToggle("incidents", opt)}
                      disabled={readOnly}
                      style={{ marginTop: 4, flexShrink: 0, accentColor: "#1e3a8a" }}
                    />
                    {readOnly ? (
                      <label htmlFor={`chk-${idx}`} style={{...styles.checkLabel, fontWeight: values.incidents?.includes(opt) ? (pdfLayout ? 500 : 700) : 400}}>{opt}</label>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                        <input
                          style={{ ...styles.checkLabel, border: "none", background: "transparent", outline: "none", flex: 1 }}
                          value={opt}
                          onChange={(e) => updateIncidentOption(section.id, idx, e.target.value)}
                        />
                        {!readOnly && (
                          <button 
                            onClick={() => removeIncidentOption(section.id, idx)}
                            style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", fontSize: 10 }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!readOnly && (
                <button 
                  onClick={() => addIncidentOption(section.id)}
                  style={{ 
                    marginTop: 12, padding: "6px 12px", background: "#f8fafc", border: "1px dashed #cbd5e1", 
                    borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#1e3a8a", cursor: "pointer" 
                  }}
                >
                  + Add Incident Option
                </button>
              )}
              <div style={styles.otherRow}>
                <label style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 700, whiteSpace: "nowrap" }}>OTHER INCIDENT:</label>
                {readOnly ? (
                  <div style={styles.otherInput}>{values.incidents_other || "None"}</div>
                ) : (
                  <input
                    type="text"
                    style={styles.otherInput}
                    placeholder="Describe if not listed above"
                    value={values.incidents_other || ""}
                    onChange={(e) => handleChange("incidents_other", e.target.value)}
                  />
                )}
              </div>
            </>
          )}

          {!readOnly && !section.special && (
            <button 
              onClick={() => addField(section.id)}
              style={{ 
                marginTop: 12, padding: "8px 16px", background: "#f8fafc", border: "1px solid #e2e8f0", 
                borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#1e3a8a", cursor: "pointer" 
              }}
            >
              + Add Field
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <button
          className="pdf-hide-on-export"
          onClick={addSection}
          style={{ 
            width: "100%", padding: "12px", background: "#1e3a8a", color: "#fff", border: "none", 
            borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: "2rem" 
          }}
        >
          + Add New Section
        </button>
      )}

      {/* Signature */}
      <div
        data-pdf-block
        className="concern-signature-block"
        style={readOnly || pdfLayout ? styles.reportSignatureRow : { ...styles.footerRow, marginTop: "3rem", width: "100%" }}
      >
        <div style={readOnly || pdfLayout ? styles.reportSignatureCol : { width: "100%", maxWidth: 520 }}>
          <div style={{ ...styles.label, textAlign: readOnly || pdfLayout ? "right" : "left" }}>Signature</div>
          <div style={{ ...styles.sigBox, marginLeft: readOnly || pdfLayout ? "auto" : undefined }}>
            <SignatureCapture
              value={
                values.signature_preview ||
                (typeof values.signature === "string" ? values.signature : null) ||
                null
              }
              onChange={(url) => {
                if (url == null) {
                  handleChange("signature", null);
                  handleChange("signature_preview", null);
                } else {
                  handleChange("signature", url);
                  handleChange("signature_preview", null);
                }
              }}
              readOnly={readOnly}
              savedLibraryEnabled
              imageClassName={pdfLayout ? "pdf-signature-img" : undefined}
            />
          </div>
        </div>
      </div>

      {/* Footer with Date and Page Number */}
      {!pdfLayout && (
        <div style={styles.formFooter}>
          <span>Date: {values.report_date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span>Page 1 of 1</span>
        </div>
      )}

      <p className="pdf-hide-on-export" style={styles.note}>Review all information carefully before submitting this form.</p>
    </div>
  );
};

export default HealthSafetyConcernForm;