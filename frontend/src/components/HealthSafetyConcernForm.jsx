import React, { useState, useEffect } from "react";
import SignatureCapture from "./SignatureCapture";
import { fetchAssignableUsers } from "../services/api";

// --- STABLE HELPER COMPONENTS (Defined outside to prevent focus loss) ---

const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5 3l1-2h4l1 2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const PhotoUpload = ({ fieldId, readOnly, values, handleChange, previewImg, styles, accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" }) => {
  const preview = values[fieldId + "_preview"] || (typeof values[fieldId] === "string" ? values[fieldId] : null);
  const description = values[fieldId + "_description"] || "";
  const descriptionTrimmed = description.trim();
  const fileName =
    values[fieldId + "_name"] ||
    (values[fieldId] instanceof File ? values[fieldId].name : null);
  const isImagePreview =
    typeof preview === "string" &&
    (preview.startsWith("blob:") ||
      preview.startsWith("data:image") ||
      /^https?:\/\//i.test(preview) ||
      /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(preview));

  if (readOnly && !preview && !fileName) {
    return <p style={{ fontSize: 14, color: "#cbd5e1", fontStyle: "italic", marginTop: 10 }}>No file provided</p>;
  }

  return (
    <div className="pdf-upload-photo" style={styles.photoBox}>
      {preview && isImagePreview ? (
        <>
          <img src={preview} alt="preview" style={styles.photoBoxImg} />
          {readOnly ? (
            descriptionTrimmed ? (
              <p style={{ fontSize: 13, color: "#475569", margin: "10px 0 0", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                {descriptionTrimmed}
              </p>
            ) : null
          ) : (
            <textarea
              style={{ ...styles.textarea, marginTop: 10, minHeight: 56, fontSize: 13 }}
              placeholder="Describe this evidence (optional)"
              value={description}
              onChange={(e) => handleChange(fieldId + "_description", e.target.value)}
            />
          )}
          {!readOnly && (
            <button
              style={styles.removeBtn}
              onClick={() => {
                handleChange(fieldId, null);
                handleChange(fieldId + "_preview", null);
                handleChange(fieldId + "_description", null);
                handleChange(fieldId + "_name", null);
              }}
            >
              REMOVE
            </button>
          )}
        </>
      ) : preview || fileName ? (
        <>
          <p style={{ margin: 0, fontSize: 13, color: "#334155", fontWeight: 600, wordBreak: "break-all" }}>
            {fileName || "Uploaded file"}
          </p>
          {!readOnly && (
            <button
              style={{ ...styles.removeBtn, position: "static" }}
              onClick={() => {
                handleChange(fieldId, null);
                handleChange(fieldId + "_preview", null);
                handleChange(fieldId + "_description", null);
                handleChange(fieldId + "_name", null);
              }}
            >
              REMOVE
            </button>
          )}
        </>
      ) : (
        <>
          <CameraIcon />
          UPLOAD FILE
          {!readOnly && (
            <input
              type="file"
              accept={accept}
              style={styles.fileInput}
              onChange={(e) => previewImg(e.target.files[0], fieldId)}
            />
          )}
        </>
      )}
    </div>
  );
};

const UserSelectField = ({
  fieldId,
  label,
  readOnly,
  values,
  handleChange,
  styles,
}) => {
  const emailKey = `${fieldId}_email`;
  const userIdKey = `${fieldId}_user_id`;
  const selectedId = values[userIdKey] ? String(values[userIdKey]) : "";
  const selectedName = values[fieldId] || "";
  const selectedEmail = values[emailKey] || "";
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (readOnly) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchAssignableUsers()
      .then((res) => {
        if (cancelled) return;
        setUsers(Array.isArray(res?.users) ? res.users : []);
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the users list. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly]);

  if (readOnly) {
    const display =
      selectedName && selectedEmail
        ? `${selectedName} (${selectedEmail})`
        : selectedName || selectedEmail || "N/A";
    return <div style={styles.input}>{display}</div>;
  }

  const selectedInList = selectedId && users.some((u) => String(u.id) === selectedId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <select
        style={{ ...styles.input, cursor: "pointer", background: "#fff" }}
        value={selectedId}
        onChange={(e) => {
          const user = users.find((u) => String(u.id) === e.target.value);
          handleChange(userIdKey, user ? user.id : "");
          handleChange(fieldId, user ? user.name : "");
          handleChange(emailKey, user ? user.email : "");
        }}
      >
        <option value="">
          {loading ? "Loading users…" : `Select ${label.toLowerCase()}...`}
        </option>
        {/* Keep a previously saved selection visible even if that user is no longer listed */}
        {selectedId && !selectedInList ? (
          <option value={selectedId}>
            {selectedName || selectedEmail || "Previously selected user"}
          </option>
        ) : null}
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.email})
          </option>
        ))}
      </select>
      {selectedName ? (
        <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>
          This nonconformance will be assigned to {selectedName}.
        </span>
      ) : null}
      {error ? (
        <span style={{ fontSize: 12, color: "#dc2626", lineHeight: 1.4 }}>{error}</span>
      ) : null}
    </div>
  );
};

const SectionHeading = ({ section, styles }) => {
  if (!section.heading) return null;
  return (
    <div style={styles.sectionLabel}>
      {section.number ? `${section.number} · ` : ""}
      {section.heading}
    </div>
  );
};

const FieldWrapper = ({
  field,
  children,
  styles,
  fullWidth = false,
  editable = false,
  onLabelChange,
  onRemove,
}) => (
  <div style={{ ...styles.field, position: "relative", ...(fullWidth ? { gridColumn: "1 / -1" } : null) }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      {editable ? (
        <input
          style={{ ...styles.label, flex: 1 }}
          value={field.label}
          onChange={(e) => onLabelChange(field.id, e.target.value)}
          placeholder="Field label"
        />
      ) : (
        <label style={styles.label}>{field.label}</label>
      )}
      {editable && (
        <button
          type="button"
          onClick={() => onRemove(field.id)}
          title="Delete field"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#ef4444",
            fontSize: 14,
            lineHeight: 1,
            padding: "0 4px",
            flexShrink: 0,
          }}
        >
          🗑️
        </button>
      )}
    </div>
    {children}
  </div>
);

// --- MAIN COMPONENT ---

const HealthSafetyConcernForm = ({
  values: externalValues,
  onChange,
  readOnly = false,
  formType = "health_safety",
  pdfLayout = false,
  assignedResponseMode = false,
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
    handleChange(fieldId, file);
    handleChange(fieldId + "_name", file.name || "");
    if (typeof file.type === "string" && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      handleChange(fieldId + "_preview", url);
    } else {
      handleChange(fieldId + "_preview", null);
    }
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
      : "Health and Safety Concern";

  const resolvedTitle = values.report_heading?.trim() || formTitle;
  const signatureValue =
    values.signature_preview ||
    (typeof values.signature === "string" ? values.signature : null) ||
    null;
  const styles = {
    wrap: {
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      width: "100%",
      maxWidth: pdfLayout ? "100%" : 980,
      margin: "0 auto",
      padding: pdfLayout ? 0 : readOnly ? "0 0 32px 0" : "2.5rem 2rem",
      color: "#1e293b",
      background: "#ffffff",
      position: "relative",
      borderRadius: readOnly ? 0 : "16px",
      boxShadow: readOnly ? "none" : "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
    },
    header: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: "2.5rem",
      paddingBottom: "1.25rem",
      borderBottom: "2px solid #f1f5f9",
      textAlign: "center",
    },
    reportHeader: {
      marginBottom: pdfLayout ? "0.75rem" : "2.5rem",
      paddingBottom: pdfLayout ? "0.5rem" : "1.25rem",
      borderBottom: pdfLayout ? "none" : "2px solid #f1f5f9",
      textAlign: "center",
    },
    reportHeaderTitle: {
      textAlign: "center",
      width: "100%",
      boxSizing: "border-box",
    },
    title: {
      fontSize: 28,
      fontWeight: pdfLayout ? 600 : 800,
      color: "#0f172a",
      margin: 0,
      letterSpacing: "-0.02em",
      textTransform: "none",
      width: "100%",
      textAlign: "center",
      lineHeight: 1.3,
    },
    reportTitle: {
      fontSize: pdfLayout ? 26 : 28,
      fontWeight: pdfLayout ? 600 : 800,
      color: "#0f172a",
      margin: 0,
      letterSpacing: "-0.02em",
      textTransform: "none",
      textAlign: "center",
      lineHeight: 1.3,
      width: "100%",
    },
    section: { 
      marginBottom: pdfLayout ? "0.65rem" : "2.5rem",
      padding: readOnly ? 0 : pdfLayout ? 0 : "1.5rem",
      background: readOnly ? "transparent" : "#fff",
      borderRadius: 12,
      border: readOnly ? "none" : "1px solid #f1f5f9"
    },
    sectionLabel: {
      fontSize: pdfLayout ? 17 : 13,
      fontWeight: pdfLayout ? 800 : 700,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      color: pdfLayout ? "#191970" : "#0f172a",
      background: "transparent",
      marginBottom: pdfLayout ? "0.35rem" : "1.5rem",
      padding: pdfLayout ? "4px 0 6px" : readOnly ? "8px 0 10px" : "8px 0 10px",
      borderRadius: 0,
      display: "block",
      width: "100%",
      boxSizing: "border-box",
      border: "none",
      borderBottom: pdfLayout ? "none" : "1px solid #e2e8f0",
      outline: "none",
      fontFamily: "inherit",
    },
    row: { display: "grid", gap: 20, marginBottom: 16 },
    col2: { gridTemplateColumns: "1fr 1fr" },
    col3: { gridTemplateColumns: "1fr 1fr 1fr" },
    field: { display: "flex", flexDirection: "column", gap: 8 },
    label: { 
      fontSize: 12, 
      color: pdfLayout ? "#334155" : "#475569", 
      fontWeight: 700, 
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
      fontSize: pdfLayout ? 11 : 14,
      color: "#1e293b",
      background: readOnly ? "transparent" : "#ffffff",
      border: readOnly ? "none" : "1px solid #e2e8f0",
      borderRadius: readOnly ? 0 : 10,
      padding: readOnly ? (pdfLayout ? "2px 0" : "4px 0") : "12px 14px",
      fontFamily: "inherit",
      resize: "none",
      minHeight: readOnly ? (pdfLayout ? "18px" : "24px") : 100,
      outline: "none",
      width: "100%",
      lineHeight: "1.6",
      wordBreak: "break-word",
      transition: "all 0.2s ease",
    },
    checksGrid: {
      display: "grid",
      gridTemplateColumns: pdfLayout ? "1fr 1fr 1fr" : "1fr 1fr",
      gap: pdfLayout ? "4px 12px" : "10px 24px",
      padding: readOnly ? 0 : pdfLayout ? 0 : "8px",
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
  };

  if (assignedResponseMode) {
    const responseFields = [
      {
        id: "noncon_response_correction",
        evidenceId: "noncon_response_correction_evidence",
        label: "What correction has been done to eliminate the nonconformity?",
      },
      {
        id: "noncon_response_root_cause",
        evidenceId: "noncon_response_root_cause_evidence",
        label: "What is the root cause?",
      },
      {
        id: "noncon_response_corrective_action",
        evidenceId: "noncon_response_corrective_action_evidence",
        label: "What corrective action has been taken to eliminate the root cause?",
      },
    ];
    const summary = [
      ["Project name", values.project_name],
      ["Customer", values.customer_name],
      ["Location", values.exact_location || values.full_address],
      ["Observation / concern", values.observation_details],
      ["Required correction action", values.noncon_action],
      ["Responsible person", values.noncon_responsible],
    ];

    return (
      <div style={styles.wrap}>
        <div style={styles.header}>
          <h1 style={styles.title}>Nonconformance response</h1>
        </div>

        {values.noncon_rejection_reason ? (
          <div
            style={{
              border: "2px solid #ef4444",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 12,
              padding: "16px 18px",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              Response rejected — this nonconformance has been reopened
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>
              {values.noncon_rejection_reason}
            </div>
          </div>
        ) : null}

        <div style={{ ...styles.section, border: "2px solid #ef4444" }}>
          <div style={styles.sectionLabel}>Nonconformance summary</div>
          <div style={{ ...styles.row, ...styles.col2 }}>
            {summary.map(([label, value]) => (
              <div key={label} style={styles.field}>
                <label style={styles.label}>{label}</label>
                <div style={{ ...styles.input, whiteSpace: "pre-wrap" }}>
                  {value || "N/A"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>Your response to the reporter</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {responseFields.map((field) => (
              <div key={field.id} style={styles.field}>
                <label style={styles.label}>{field.label}</label>
                <textarea
                  style={{ ...styles.textarea, minHeight: 110 }}
                  value={values[field.id] || ""}
                  placeholder="Enter your response..."
                  onChange={(event) => handleChange(field.id, event.target.value)}
                />
                <label style={{ ...styles.label, marginTop: 6 }}>
                  Evidence upload
                </label>
                <PhotoUpload
                  fieldId={field.evidenceId}
                  readOnly={false}
                  values={values}
                  handleChange={handleChange}
                  previewImg={previewImg}
                  styles={styles}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // All concern forms (health & safety, sustainability, quality) share the same
  // field layout; only the incident classification options differ per form type.
  const sharedConcernDefaultSchema = [
    {
      id: "project_details",
      heading: "Project details",
      number: "1",
      fields: [
        { id: "report_date", label: "Report date", type: "date" },
        { id: "customer_reference", label: "Customer reference", type: "text" },
        { id: "project_name", label: "Project name", type: "text" },
        { id: "customer_name", label: "Customer name", type: "text" },
      ],
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
      ],
    },
    {
      id: "location",
      heading: "Location details",
      number: "3",
      fields: [
        { id: "full_address", label: "Full address", type: "textarea", fullWidth: true },
        { id: "exact_location", label: "Exact location of incident", type: "textarea", fullWidth: true },
      ],
    },
    {
      id: "classification",
      heading: "Incident classification",
      number: "4",
      fields: [],
      special: "incidents",
      options: incidentOptions,
    },
    {
      id: "observations",
      heading: "Observations & suggestions",
      number: "5",
      fields: [
        { id: "observation_details", label: "Observation details", type: "textarea", fullWidth: true },
        { id: "observation_photo", label: "Observation photo", type: "photo", fullWidth: true },
        { id: "corrective_action", label: "Corrective action proposed", type: "textarea", fullWidth: true },
        { id: "suggestion_photo", label: "Supporting photo", type: "photo", fullWidth: true },
      ],
    },
    {
      id: "nonconformance",
      heading: "Nonconformance",
      number: "6",
      fields: [
        { id: "noncon_action", label: "Correction action", type: "textarea", fullWidth: true },
        { id: "noncon_responsible", label: "Responsible person", type: "user_email" },
        { id: "noncon_date", label: "Date completed", type: "date" },
        { id: "noncon_photo", label: "Nonconformance photo", type: "photo", fullWidth: true },
      ],
    },
  ];

  const defaultSchema = sharedConcernDefaultSchema;

  const [schema, setSchema] = useState(() =>
    Array.isArray(values.form_schema) && values.form_schema.length
      ? values.form_schema
      : defaultSchema
  );

  // Re-sync when a different saved record is loaded (form_schema reference changes).
  useEffect(() => {
    if (Array.isArray(values.form_schema) && values.form_schema.length) {
      setSchema(values.form_schema);
    }
  }, [values.form_schema]);

  const updateSchema = (nextSchema) => {
    setSchema(nextSchema);
    handleChange("form_schema", nextSchema);
  };

  const updateFieldLabel = (sectionId, fieldId, label) => {
    updateSchema(
      schema.map((s) =>
        s.id === sectionId
          ? { ...s, fields: (s.fields || []).map((f) => (f.id === fieldId ? { ...f, label } : f)) }
          : s
      )
    );
  };

  const removeField = (sectionId, fieldId) => {
    updateSchema(
      schema.map((s) =>
        s.id === sectionId
          ? { ...s, fields: (s.fields || []).filter((f) => f.id !== fieldId) }
          : s
      )
    );
  };

  const rootClassName = pdfLayout ? "pdf-export-root concern-pdf-export" : undefined;

  return (
    <div
      className={rootClassName}
      style={styles.wrap}
      data-pdf-form-title={pdfLayout ? resolvedTitle : undefined}
    >
      <div
        className={readOnly || pdfLayout ? "pdf-header concern-report-header" : "pdf-header"}
        data-pdf-block
        style={readOnly || pdfLayout ? styles.reportHeader : styles.header}
      >
        {readOnly || pdfLayout ? (
          <div className="concern-header-title" style={styles.reportHeaderTitle}>
            <h1 style={styles.reportTitle}>{resolvedTitle}</h1>
          </div>
        ) : (
          <input
            style={{
              ...styles.title,
              border: "none",
              borderBottom: "2px solid #e2e8f0",
              background: "transparent",
              maxWidth: 720,
              padding: "0 0 8px 0",
              outline: "none",
            }}
            placeholder={formTitle}
            value={values.report_heading ?? ""}
            onChange={(e) => handleChange("report_heading", e.target.value)}
          />
        )}
      </div>

      {schema.map((section) => {
        // Red border box around Nonconformance in the on-screen view only (never in exports).
        const highlightNoncon =
          section.id === "nonconformance" && readOnly && !pdfLayout;
        return (
        <div
          key={section.id}
          data-pdf-block
          style={{
            ...styles.section,
            ...(highlightNoncon
              ? { border: "2px solid #ef4444", borderRadius: 12, padding: "1.25rem" }
              : null),
          }}
        >
          <SectionHeading section={section} styles={styles} />

          <div style={{ ...styles.row, ...styles.col2 }}>
            {(section.fields || []).map((field) => (
              <FieldWrapper
                key={field.id}
                field={field}
                styles={styles}
                fullWidth={Boolean(field.fullWidth)}
                editable={!readOnly && !pdfLayout}
                onLabelChange={(fieldId, label) => updateFieldLabel(section.id, fieldId, label)}
                onRemove={(fieldId) => removeField(section.id, fieldId)}
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
                        e.target.style.height = "inherit";
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
                ) : field.type === "user_email" || field.id === "noncon_responsible" ? (
                  <UserSelectField
                    fieldId={field.id}
                    label={field.label}
                    readOnly={readOnly}
                    values={values}
                    handleChange={handleChange}
                    styles={styles}
                  />
                ) : readOnly ? (
                  <div style={styles.input}>{values[field.id] || "N/A"}</div>
                ) : (
                  <input
                    style={styles.input}
                    type="text"
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                    value={values[field.id] || ""}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                  />
                )}
              </FieldWrapper>
            ))}
          </div>

          {section.special === "incidents" &&
            formType !== "positive" &&
            (readOnly || pdfLayout ? (
              (() => {
                const selectedIncidents = Array.isArray(values.incidents)
                  ? values.incidents.filter(Boolean)
                  : [];
                const otherIncident = String(values.incidents_other || "").trim();
                const allIncidents = [...selectedIncidents, ...(otherIncident ? [otherIncident] : [])];
                return (
                  <div style={styles.input}>
                    {allIncidents.length ? allIncidents.join(", ") : "None selected"}
                  </div>
                );
              })()
            ) : (
              <>
                <p
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                    marginBottom: 12,
                  }}
                >
                  {classificationTitle}
                </p>
                <div style={styles.checksGrid}>
                  {incidentOptions.map((opt, idx) => (
                    <div key={opt} style={styles.checkItem}>
                      <input
                        type="checkbox"
                        id={`chk-${section.id}-${idx}`}
                        checked={Boolean(values.incidents?.includes(opt))}
                        onChange={() => handleCheckboxToggle("incidents", opt)}
                        style={{ marginTop: 4, flexShrink: 0, accentColor: "#1e3a8a" }}
                      />
                      <label htmlFor={`chk-${section.id}-${idx}`} style={styles.checkLabel}>
                        {opt}
                      </label>
                    </div>
                  ))}
                </div>
                <div style={styles.otherRow}>
                  <label
                    style={{
                      fontSize: 13,
                      color: "#1e3a8a",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Other:
                  </label>
                  <input
                    type="text"
                    style={styles.otherInput}
                    placeholder="Enter other incident type"
                    value={values.incidents_other || ""}
                    onChange={(e) => handleChange("incidents_other", e.target.value)}
                  />
                </div>
              </>
            ))}
        </div>
        );
      })}

      {values.noncon_response_status === "sent" && (
        <div data-pdf-block style={styles.section}>
          <div style={styles.sectionLabel}>Assignee nonconformance response</div>
          {[
            {
              id: "noncon_response_correction",
              evidenceId: "noncon_response_correction_evidence",
              label: "What correction has been done to eliminate the nonconformity?",
            },
            {
              id: "noncon_response_root_cause",
              evidenceId: "noncon_response_root_cause_evidence",
              label: "What is the root cause?",
            },
            {
              id: "noncon_response_corrective_action",
              evidenceId: "noncon_response_corrective_action_evidence",
              label: "What corrective action has been taken to eliminate the root cause?",
            },
          ].map((field) => (
            <div key={field.id} style={{ ...styles.field, marginBottom: 22 }}>
              <label style={styles.label}>{field.label}</label>
              <div style={{ ...styles.textarea, minHeight: "auto", whiteSpace: "pre-wrap" }}>
                {values[field.id] || "N/A"}
              </div>
              <label style={{ ...styles.label, marginTop: 6 }}>Evidence</label>
              <PhotoUpload
                fieldId={field.evidenceId}
                readOnly
                values={values}
                handleChange={handleChange}
                previewImg={previewImg}
                styles={styles}
              />
            </div>
          ))}
        </div>
      )}

      {(!pdfLayout || signatureValue) && (
        <div
          data-pdf-block
          className="concern-signature-block"
          style={
            readOnly || pdfLayout
              ? styles.reportSignatureRow
              : { ...styles.footerRow, marginTop: "3rem", width: "100%" }
          }
        >
          <div style={readOnly || pdfLayout ? styles.reportSignatureCol : { width: "100%", maxWidth: 520 }}>
            <div style={{ ...styles.label, textAlign: readOnly || pdfLayout ? "right" : "left" }}>
              Signature
            </div>
            <div style={{ ...styles.sigBox, marginLeft: readOnly || pdfLayout ? "auto" : undefined }}>
              <SignatureCapture
                value={signatureValue}
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
      )}

      {!pdfLayout && (
        <div style={styles.formFooter}>
          <span>
            Date:{" "}
            {values.report_date ||
              new Date().toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
          </span>
          <span>Page 1 of 1</span>
        </div>
      )}

      <p className="pdf-hide-on-export" style={styles.note}>
        Review all information carefully before submitting this form.
      </p>
    </div>
  );
};

export default HealthSafetyConcernForm;
