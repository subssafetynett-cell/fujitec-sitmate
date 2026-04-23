import React, { useState } from "react";

const HealthSafetyConcernForm = ({ values: externalValues, onChange, readOnly = false, formType = "health_safety" }) => {
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

  const styles = {
    wrap: {
      fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
      width: "100%",
      margin: "0 auto",
      padding: readOnly ? "0 0 60px 0" : "2rem 1.5rem",
      color: "#0f0f0f",
      background: "#fff",
      position: "relative",
    },
    header: {
      display: "flex",
      flexDirection: "column",
      alignItems: readOnly ? "center" : "flex-start",
      textAlign: readOnly ? "center" : "left",
      marginBottom: "3rem",
      position: "relative",
      minHeight: readOnly ? 80 : "auto",
      justifyContent: "center",
    },
    logoWrapper: {
      position: readOnly ? "absolute" : "static",
      top: 0,
      right: 0,
      marginTop: readOnly ? 0 : 10,
    },
    logoBox: {
      width: 150,
      height: 70,
      border: readOnly ? "none" : "1.5px dashed #d1d5db",
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: readOnly ? "transparent" : "#f9fafb",
      position: "relative",
      overflow: "hidden",
    },
    title: {
      fontSize: 32,
      fontWeight: 800,
      color: "#1e3a8a",
      margin: 0,
      letterSpacing: "-0.025em",
      textTransform: "uppercase",
      width: readOnly ? "70%" : "auto",
    },
    subtitle: {
      fontSize: 14,
      color: "#64748b",
      marginTop: 8,
      fontWeight: 400,
      display: readOnly ? "none" : "block",
    },
    section: { marginBottom: "3rem" },
    sectionLabel: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "#ffffff",
      background: "linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%)",
      marginBottom: "1.5rem",
      padding: "12px 20px",
      borderRadius: 8,
      display: "block",
      width: "100%",
    },
    row: { display: "grid", gap: 24, marginBottom: 24 },
    col2: { gridTemplateColumns: "1fr 1fr" },
    col3: { gridTemplateColumns: "1fr 1fr 1fr" },
    field: { display: "flex", flexDirection: "column", gap: 8 },
    label: { fontSize: 11, color: "#1e3a8a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 },
    input: {
      fontSize: 15,
      color: "#111827",
      background: readOnly ? "transparent" : "#f9fafb",
      border: "none",
      borderBottom: readOnly ? "none" : "1px solid #e5e7eb",
      borderRadius: readOnly ? 0 : 10,
      padding: readOnly ? "2px 0 6px 0" : "12px 16px",
      fontFamily: "inherit",
      outline: "none",
      width: "100%",
      minHeight: readOnly ? "24px" : "44px",
      lineHeight: "1.5",
      wordBreak: "break-word",
    },
    textarea: {
      fontSize: 15,
      color: "#111827",
      background: readOnly ? "transparent" : "#f9fafb",
      border: "none",
      borderBottom: readOnly ? "none" : "1px solid #e5e7eb",
      borderRadius: readOnly ? 0 : 10,
      padding: readOnly ? "2px 0 6px 0" : "12px 16px",
      fontFamily: "inherit",
      resize: "none",
      minHeight: readOnly ? "24px" : 100,
      outline: "none",
      width: "100%",
      lineHeight: "1.6",
      wordBreak: "break-word",
    },
    checksGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: "12px 24px",
    },
    checkItem: { display: "flex", alignItems: "flex-start", gap: 12, padding: "4px 0" },
    checkLabel: { fontSize: 13, color: "#374151", lineHeight: 1.5, cursor: "pointer" },
    photoBox: {
      border: readOnly ? "none" : "1px solid #e5e7eb",
      borderRadius: 12,
      minHeight: readOnly ? 160 : 120,
      display: "flex",
      alignItems: "center",
      justifyContent: readOnly ? "flex-start" : "center",
      background: readOnly ? "transparent" : "#f9fafb",
      color: "#9ca3af",
      fontSize: 13,
      gap: 10,
      position: "relative",
      overflow: "hidden",
      marginTop: 8,
    },
    photoBoxImg: { 
      maxHeight: readOnly ? "320px" : "100%", 
      maxWidth: "100%", 
      objectFit: "contain",
      borderRadius: readOnly ? 8 : 0
    },
    fileInput: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      cursor: "pointer",
      width: "100%",
      height: "100%",
    },
    divider: { height: "1px", background: "#f3f4f6", margin: "3.5rem 0" },
    sigBox: {
      border: readOnly ? "none" : "1px solid #e5e7eb",
      borderBottom: readOnly ? "2px solid #1e3a8a" : "1px solid #e5e7eb",
      borderRadius: readOnly ? 0 : 10,
      height: 100,
      width: 320,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#9ca3af",
      fontSize: 13,
      background: readOnly ? "transparent" : "#fcfcfc",
      position: "relative",
      overflow: "hidden",
    },
    footerRow: { display: "flex", alignItems: "flex-end", gap: 24, justifyContent: "flex-end" },
    otherRow: { display: "flex", alignItems: "center", gap: 12, marginTop: 20 },
    otherInput: {
      flex: 1,
      fontSize: 14,
      background: "transparent",
      border: "none",
      borderBottom: "1.5px solid #e5e7eb",
      padding: "6px 0",
      color: "#111827",
      fontFamily: "inherit",
      outline: "none",
      borderRadius: 0,
      minHeight: "26px",
    },
    note: { 
      fontSize: 12, 
      color: "#9ca3af", 
      textAlign: "center", 
      marginTop: "5rem",
      display: readOnly ? "none" : "block"
    },
    removeBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      background: "rgba(255,255,255,0.9)",
      border: "1px solid #e5e7eb",
      borderRadius: 6,
      cursor: "pointer",
      padding: "4px 10px",
      fontSize: 11,
      color: "#374151",
      fontWeight: 600,
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    },
    formFooter: {
      marginTop: "6rem",
      paddingTop: "2rem",
      borderTop: "1px solid #f3f4f6",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      color: "#9ca3af",
      fontSize: 12,
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    }
  };

  const CameraIcon = () => (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 3l1-2h4l1 2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );

  const PhotoUpload = ({ fieldId }) => {
    const preview = values[fieldId + "_preview"] || (typeof values[fieldId] === "string" ? values[fieldId] : null);
    
    if (readOnly && !preview) return <p style={{fontSize: 14, color: "#cbd5e1", fontStyle: "italic", marginTop: 10}}>No photo provided</p>;

    return (
      <div style={styles.photoBox}>
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

  const LogoUpload = () => {
    const preview = values["company_logo_preview"] || (typeof values["company_logo"] === "string" ? values["company_logo"] : null);
    if (readOnly && !preview) return null;

    return (
      <div style={styles.logoBox}>
        {preview ? (
          <>
            <img src={preview} alt="Company Logo" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
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

  return (
    <div style={styles.wrap}>
      {/* Header with Title and Logo */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{formTitle}</h1>
          <p style={styles.subtitle}>Official record of safety and environmental concerns.</p>
        </div>
        <div style={styles.logoWrapper}>
          <LogoUpload />
        </div>
      </div>

      {/* 1. Project Details */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>1 · Project details</div>
        <div style={{ ...styles.row, ...styles.col2 }}>
          <div style={styles.field}>
            <label style={styles.label}>Project name</label>
            {readOnly ? (
              <div style={styles.input}>{values.project_name || "N/A"}</div>
            ) : (
              <input style={styles.input} type="text" placeholder="e.g. Riverside Tower Block B" value={values.project_name || ""} onChange={(e) => handleChange("project_name", e.target.value)} />
            )}
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Customer name</label>
            {readOnly ? (
              <div style={styles.input}>{values.customer_name || "N/A"}</div>
            ) : (
              <input style={styles.input} type="text" placeholder="e.g. Acme Properties Ltd" value={values.customer_name || ""} onChange={(e) => handleChange("customer_name", e.target.value)} />
            )}
          </div>
        </div>
      </div>

      {/* 2. Management & Contacts */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>2 · Management & contacts</div>
        <div style={{ ...styles.row, ...styles.col2 }}>
          <div style={styles.field}>
            <label style={styles.label}>Manager</label>
            {readOnly ? (
              <div style={styles.input}>{values.fujitec_manager || "N/A"}</div>
            ) : (
              <input style={styles.input} type="text" placeholder="Full name" value={values.fujitec_manager || ""} onChange={(e) => handleChange("fujitec_manager", e.target.value)} />
            )}
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Supervisor</label>
            {readOnly ? (
              <div style={styles.input}>{values.fujitec_supervisor || "N/A"}</div>
            ) : (
              <input style={styles.input} type="text" placeholder="Full name" value={values.fujitec_supervisor || ""} onChange={(e) => handleChange("fujitec_supervisor", e.target.value)} />
            )}
          </div>
        </div>
        <div style={{ ...styles.row, ...styles.col2 }}>
          <div style={styles.field}>
            <label style={styles.label}>Responsible engineer(s)</label>
            {readOnly ? (
              <div style={styles.input}>{values.responsible_person || "N/A"}</div>
            ) : (
              <input style={styles.input} type="text" placeholder="Full name(s)" value={values.responsible_person || ""} onChange={(e) => handleChange("responsible_person", e.target.value)} />
            )}
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Site contact</label>
            {readOnly ? (
              <div style={styles.input}>{values.site_contact || "N/A"}</div>
            ) : (
              <input style={styles.input} type="text" placeholder="Full name" value={values.site_contact || ""} onChange={(e) => handleChange("site_contact", e.target.value)} />
            )}
          </div>
        </div>
      </div>

      {/* 3. Location Details */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>3 · Location details</div>
        <div style={{ ...styles.row, ...styles.col2 }}>
          <div style={styles.field}>
            <label style={styles.label}>Full address</label>
            {readOnly ? (
              <div style={{ ...styles.textarea, whiteSpace: "pre-wrap", minHeight: "auto" }}>
                {values.full_address || "N/A"}
              </div>
            ) : (
              <textarea 
                style={styles.textarea} 
                placeholder="Street, city, postcode" 
                value={values.full_address || ""} 
                onChange={(e) => {
                  e.target.style.height = 'inherit';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  handleChange("full_address", e.target.value);
                }} 
              />
            )}
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Exact location of incident</label>
            {readOnly ? (
              <div style={{ ...styles.textarea, whiteSpace: "pre-wrap", minHeight: "auto" }}>
                {values.exact_location || "N/A"}
              </div>
            ) : (
              <textarea 
                style={styles.textarea} 
                placeholder="e.g. Lift shaft B, 3rd floor landing" 
                value={values.exact_location || ""} 
                onChange={(e) => {
                  e.target.style.height = 'inherit';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  handleChange("exact_location", e.target.value);
                }} 
              />
            )}
          </div>
        </div>
      </div>

      {/* 4. Incident Classification */}
      {formType !== "positive" && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>4 · Incident classification — select all that apply</div>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12, display: readOnly ? "none" : "block" }}>{classificationTitle}</p>
          <div style={styles.checksGrid}>
            {incidentOptions.map((opt, idx) => (
              <div key={idx} style={styles.checkItem}>
                <input
                  type="checkbox"
                  id={`chk-${idx}`}
                  checked={values.incidents?.includes(opt) || false}
                  onChange={() => handleCheckboxToggle("incidents", opt)}
                  disabled={readOnly}
                  style={{ marginTop: 4, flexShrink: 0, accentColor: "#1e3a8a" }}
                />
                <label htmlFor={`chk-${idx}`} style={{...styles.checkLabel, fontWeight: values.incidents?.includes(opt) ? 700 : 400}}>{opt}</label>
              </div>
            ))}
          </div>
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
        </div>
      )}

      {/* 5. Observations & Suggestions */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>
          {formType === "positive" ? "4" : "5"} · Observations & suggestions
        </div>
        <div style={{ ...styles.row, ...styles.col2 }}>
          <div style={styles.field}>
            <label style={styles.label}>Observation details</label>
            {readOnly ? (
              <div style={{ ...styles.textarea, whiteSpace: "pre-wrap", minHeight: "auto" }}>
                {values.observation_details || "N/A"}
              </div>
            ) : (
              <textarea 
                style={styles.textarea} 
                placeholder="Describe what you observed in detail…" 
                value={values.observation_details || ""} 
                onChange={(e) => {
                  e.target.style.height = 'inherit';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  handleChange("observation_details", e.target.value);
                }} 
              />
            )}
            <label style={{ ...styles.label, marginTop: 16 }}>Observation photo</label>
            <PhotoUpload fieldId="observation_photo" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Corrective action proposed</label>
            {readOnly ? (
              <div style={{ ...styles.textarea, whiteSpace: "pre-wrap", minHeight: "auto" }}>
                {values.corrective_action || "N/A"}
              </div>
            ) : (
              <textarea 
                style={styles.textarea} 
                placeholder="Describe the recommended corrective action…" 
                value={values.corrective_action || ""} 
                onChange={(e) => {
                  e.target.style.height = 'inherit';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  handleChange("corrective_action", e.target.value);
                }} 
              />
            )}
            <label style={{ ...styles.label, marginTop: 16 }}>Supporting photo</label>
            <PhotoUpload fieldId="suggestion_photo" />
          </div>
        </div>
      </div>

      {/* Signature */}
      <div style={{ ...styles.footerRow, marginTop: "3rem" }}>
        <label style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 700, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.05em" }}>Signature</label>
        <div style={styles.sigBox}>
          {values.signature_preview || values.signature ? (
            <img src={values.signature_preview || values.signature} alt="Signature" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
          ) : (
            <>
              UPLOAD SIGNATURE IMAGE
              {!readOnly && (
                <input
                  type="file"
                  accept="image/*"
                  style={styles.fileInput}
                  onChange={(e) => previewImg(e.target.files[0], "signature")}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer with Date and Page Number */}
      <div style={styles.formFooter}>
        <span>Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <span>Page 1 of 1</span>
      </div>

      <p style={styles.note}>Review all information carefully before submitting this form.</p>
    </div>
  );
};

export default HealthSafetyConcernForm;