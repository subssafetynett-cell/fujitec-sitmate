import React, { useState } from "react";

/** Section titles — use "Personnel" (staff), not "Personal". */
const REPORT_TITLE = "Weekly Health & Safety Supervisor Report";
const SECTION_PERSONNEL_AND_CONTACTS = "Personnel and Contacts";

const WeeklySupervisorInspectionForm = ({ values: externalValues, onChange, readOnly = false, logoUrl }) => {
  const [internalValues, setInternalValues] = useState({});
  const values = externalValues ?? internalValues;

  const handleChange = (fieldId, value) => {
    if (onChange) {
      onChange(fieldId, value);
    } else {
      setInternalValues((prev) => ({ ...prev, [fieldId]: value }));
    }
  };

  const previewImg = (file, fieldId) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    handleChange(fieldId, file);
    handleChange(fieldId + "_preview", url);
  };

  const statusOptions = [
    "Non-compliant",
    "Partially-compliant",
    "Compliant",
    "Not in use",
    "Not applicable"
  ];

  const scoreMap = {
    "Compliant": 3,
    "Partially-compliant": 2,
    "Non-compliant": 1,
    "Not in use": 0,
    "Not applicable": 0
  };

  const getStatusColor = (status) => {
    if (status === "Compliant") return "#008000"; // Green
    if (status === "Partially-compliant") return "#FFA500"; // Orange/Yellow
    if (status === "Non-compliant") return "#FF0000"; // Red
    return "#f3f4f6";
  };

  const renderSectionResults = (sectionTitle, items) => {
    if (!readOnly) return null;

    return (
      <div className="pdf-section" style={{ marginBottom: "3rem" }}>
        <div style={styles.sectionLabel}>{sectionTitle}</div>
        
        {/* Results Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ ...styles.tableHeader, width: "60%", textAlign: "left" }}>ITEM</th>
              <th style={{ ...styles.tableHeader, width: "15%", textAlign: "center" }}>SCORE</th>
              <th style={{ ...styles.tableHeader, width: "25%", textAlign: "center" }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const status = values[`${item.prefix}_status`];
              const score = scoreMap[status] ?? 0;
              return (
                <tr key={item.prefix}>
                  <td style={styles.tableCell}>{item.label}</td>
                  <td style={{ ...styles.tableCell, textAlign: "center" }}>{score}</td>
                  <td style={{ 
                    ...styles.tableCell, 
                    textAlign: "center", 
                    backgroundColor: getStatusColor(status),
                    color: (status === "Compliant" || status === "Non-compliant" || status === "Partially-compliant") ? "#fff" : "#000",
                    fontWeight: 600
                  }}>
                    {status || "N/A"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Detailed Notes and Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => {
            const notes = values[`${item.prefix}_notes`];
            const remedial = values[`${item.prefix}_remedial`];
            const file = values[`${item.prefix}_file`];
            const filePreview = values[`${item.prefix}_file_preview`];

            return (
              <React.Fragment key={item.prefix}>
                {notes && (
                  <div style={styles.resultBox}>
                    <div style={styles.resultLabel}>{item.label} notes</div>
                    <div style={styles.resultValue}>{notes}</div>
                  </div>
                )}
                {remedial && (
                  <div style={styles.resultBox}>
                    <div style={styles.resultLabel}>Responsible person for {item.label} remedial action</div>
                    <div style={styles.resultValue}>{remedial}</div>
                  </div>
                )}
                {(file || filePreview) && (
                  <div style={{ ...styles.resultBox, border: "1px solid #e5e7eb", padding: 16 }}>
                    <div style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 600, marginBottom: 8 }}>
                      Downloadable file link: <a href={filePreview || file} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>{item.label} uploaded file</a>
                    </div>
                    <img 
                      src={filePreview || file} 
                      alt="Attachment" 
                      style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 4, display: "block" }} 
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

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
    section: { marginBottom: "3rem" },
    sectionLabel: {
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "#1e3a8a",
      borderBottom: "2px solid #1e3a8a",
      marginBottom: "1.5rem",
      padding: "8px 0",
      display: "block",
      width: "100%",
      textAlign: "center",
    },
    row: { display: "grid", gap: 24, marginBottom: 24 },
    col2: { gridTemplateColumns: "1fr 1fr" },
    field: { display: "flex", flexDirection: "column", gap: 8 },
    label: { fontSize: 11, color: "#1e3a8a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" },
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
      minHeight: readOnly ? "24px" : 80,
      outline: "none",
      width: "100%",
      lineHeight: "1.6",
    },
    itemBox: {
      border: "1px solid #f1f5f9",
      padding: 24,
      borderRadius: 16,
      marginBottom: 32,
      background: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
    },
    itemTitle: {
      fontSize: 16,
      fontWeight: 700,
      color: "#1e3a8a",
      marginBottom: 16,
    },
    radioGrid: {
      display: "flex",
      flexWrap: "wrap",
      gap: "10px 24px",
      marginBottom: 20,
    },
    radioItem: { display: "flex", alignItems: "center", gap: 8 },
    radioLabel: { fontSize: 14, color: "#374151", cursor: "pointer" },
    fileInput: {
      fontSize: 13,
      marginTop: 8,
      color: "#64748b",
    },
    footerRow: {
      marginTop: "6rem",
      paddingTop: "2.5rem",
      paddingBottom: "2.5rem",
      borderTop: "1.5px solid #f3f4f6",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      color: "#64748b",
      fontSize: 11,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    },
    tableHeader: {
      fontSize: 12,
      fontWeight: 700,
      color: "#0000FF", // Blue headers as per image
      padding: "12px 8px",
      border: "1px solid #e5e7eb",
      background: "#fff",
    },
    tableCell: {
      fontSize: 14,
      padding: "10px 12px",
      border: "1px solid #e5e7eb",
      verticalAlign: "middle",
    },
    resultBox: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      border: "1px solid #e5e7eb",
      borderRadius: 4,
      overflow: "hidden",
    },
    resultLabel: {
      padding: "10px 12px",
      background: "#fff",
      fontSize: 14,
      fontWeight: 600,
      color: "#111827",
      borderRight: "1px solid #e5e7eb",
    },
    resultValue: {
      padding: "10px 12px",
      background: "#fff",
      fontSize: 14,
      color: "#374151",
    }
  };

  const renderOverallSummary = () => {
    if (!readOnly) return null;

    const sections = [
      { label: "WELFARE AND ENVIRONMENT", items: ["washing", "waste", "lighting"] },
      { label: "HOUSE KEEPING", items: ["storage", "lift_shaft"] },
      { label: "FIRST AID AND ACCIDENTS", items: ["first_aid", "first_aiders", "near_miss"] },
      { label: "PERSONAL PROTECTIVE EQUIPMENT", items: ["ppe_register", "ppe_inspected", "ppe_worn"] },
      { label: "LIFTING EQUIPMENT AND TOOLS", items: ["lifting_tested", "weekly_records", "pat_testing", "lifting_order"] },
      { label: "ENTRANCE PROTECTION AND LIFT PITS", items: ["entrance_protection", "lift_pits"] },
      { label: "SAFE WORKING PRACTICES", items: ["safe_working", "rams_compliance", "install_requirements", "accident_reporting"] }
    ];

    const results = sections.map(sec => {
      let totalScore = 0;
      let count = 0;
      sec.items.forEach(prefix => {
        const status = values[`${prefix}_status`];
        if (status) {
          totalScore += (scoreMap[status] ?? 0);
          count++;
        }
      });
      const avg = count > 0 ? (totalScore / count) : 0;
      let status = "N/A";
      if (avg >= 2.5) status = "Compliant";
      else if (avg >= 1.5) status = "Partially - compliant";
      else if (avg > 0) status = "Non - compliant";

      return { label: sec.label, score: avg.toFixed(1), status };
    });

    const totalPossible = sections.length * 3;
    const totalActual = results.reduce((sum, r) => sum + parseFloat(r.score), 0);
    const percentage = ((totalActual / totalPossible) * 100).toFixed(1);

    return (
      <div className="pdf-section" style={{ marginTop: "4rem", marginBottom: "4rem" }}>
        <div style={styles.sectionLabel}>OVERALL SUMMARY</div>
        
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 40 }}>
          <thead>
            <tr>
              <th style={{ ...styles.tableHeader, width: "50%", textAlign: "left" }}>ITEM</th>
              <th style={{ ...styles.tableHeader, width: "25%", textAlign: "center" }}>OVERALL SCORE</th>
              <th style={{ ...styles.tableHeader, width: "25%", textAlign: "center" }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {results.map((res) => (
              <tr key={res.label}>
                <td style={styles.tableCell}>{res.label}</td>
                <td style={{ ...styles.tableCell, textAlign: "center" }}>{res.score}</td>
                <td style={{ 
                  ...styles.tableCell, 
                  textAlign: "center", 
                  backgroundColor: getStatusColor(res.status.replace(/ - /g, "-")),
                  color: "#fff",
                  fontWeight: 600
                }}>
                  {res.status}
                </td>
              </tr>
            ))}
            <tr style={{ backgroundColor: "#f9fafb" }}>
              <td style={{ ...styles.tableCell, fontWeight: 800 }}>SITE RATING</td>
              <td style={{ ...styles.tableCell, textAlign: "center", fontWeight: 800 }}>{totalActual.toFixed(1)}</td>
              <td style={{ 
                ...styles.tableCell, 
                textAlign: "center", 
                backgroundColor: "#004d00",
                color: "#fff",
                fontWeight: 800
              }}>
                {percentage} %
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bar Chart */}
        <div style={{ textAlign: "center", marginBottom: 30, marginTop: 40, color: "#1e3a8a", fontWeight: 700, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          OVERALL SCORE VS AUDIT CATEGORY
        </div>
        <div style={{ 
          height: 380, 
          width: "100%", 
          borderLeft: "2px solid #e5e7eb",
          borderBottom: "2px solid #e5e7eb",
          position: "relative",
          background: "#ffffff", // Use solid white for capture
          padding: "20px 0 120px 40px", // More room at bottom
          boxSizing: "border-box"
        }}>
          {/* Y-Axis Labels */}
          <div style={{ position: "absolute", left: -35, top: 20, bottom: 120, display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 11, color: "#64748b", fontWeight: 600 }}>
            <span>3.0</span>
            <span>2.5</span>
            <span>2.0</span>
            <span>1.5</span>
            <span>1.0</span>
            <span>0.5</span>
            <span>0.0</span>
          </div>
          
          <div style={{ display: "flex", height: "100%", alignItems: "flex-end", justifyContent: "space-around" }}>
            {results.map((res) => {
              const scoreNum = parseFloat(res.score);
              const heightPerc = (scoreNum / 3) * 100;
              return (
                <div key={res.label} style={{ position: "relative", width: "12%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
                  <div style={{ 
                    width: "80%", 
                    height: `${heightPerc}%`, 
                    backgroundColor: getStatusColor(res.status.replace(/ - /g, "-")),
                    borderRadius: "4px 4px 0 0",
                    border: "1px solid rgba(0,0,0,0.05)"
                  }}></div>
                  <div style={{ 
                    position: "absolute", 
                    bottom: -90, 
                    fontSize: 8, 
                    fontWeight: 700, 
                    color: "#1e293b", 
                    textAlign: "center",
                    width: 90,
                    transform: "rotate(-30deg)",
                    transformOrigin: "top center",
                    lineHeight: "1.2",
                    wordWrap: "break-word"
                  }}>
                    {res.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#1e3a8a", fontWeight: 700, textTransform: "uppercase" }}>
          Audit category
        </div>
      </div>
    );
  };

  const renderStatusRadio = (fieldId) => (
    <div style={styles.radioGrid}>
      {statusOptions.map((opt) => (
        <div key={opt} style={styles.radioItem}>
          <input
            type="radio"
            id={`${fieldId}-${opt}`}
            name={fieldId}
            value={opt}
            checked={values[fieldId] === opt}
            onChange={(e) => handleChange(fieldId, e.target.value)}
            disabled={readOnly}
            style={{ accentColor: "#1e3a8a" }}
          />
          <label htmlFor={`${fieldId}-${opt}`} style={styles.radioLabel}>{opt}</label>
        </div>
      ))}
    </div>
  );

  const renderItem = (title, prefix) => (
    <div style={styles.itemBox}>
      <div style={styles.itemTitle}>{title}</div>
      
      <div style={styles.field}>
        <label style={styles.label}>Status</label>
        {renderStatusRadio(`${prefix}_status`)}
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Notes</label>
        {readOnly ? (
          <div style={styles.textarea}>{values[`${prefix}_notes`] || "N/A"}</div>
        ) : (
          <textarea
            style={styles.textarea}
            placeholder="Add any relevant notes here..."
            value={values[`${prefix}_notes`] || ""}
            onChange={(e) => handleChange(`${prefix}_notes`, e.target.value)}
          />
        )}
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Upload File / Photo</label>
        {!readOnly ? (
          <input
            type="file"
            style={styles.fileInput}
            onChange={(e) => previewImg(e.target.files[0], `${prefix}_file`)}
          />
        ) : (
          <div style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic", marginTop: 4 }}>
            {values[`${prefix}_file`] ? "File uploaded" : "No file provided"}
          </div>
        )}
        {(values[`${prefix}_file_preview`] || (typeof values[`${prefix}_file`] === 'string' && values[`${prefix}_file`])) && (
           <img 
            src={values[`${prefix}_file_preview`] || values[`${prefix}_file`]} 
            alt="Upload preview" 
            style={{ maxWidth: "100%", maxHeight: 200, marginTop: 12, borderRadius: 8, objectFit: "contain" }} 
           />
        )}
      </div>

      <div style={{ ...styles.row, ...styles.col2, marginTop: 24 }}>
        <div style={styles.field}>
          <label style={styles.label}>Remedial action</label>
          {readOnly ? (
            <div style={styles.input}>{values[`${prefix}_remedial`] || "N/A"}</div>
          ) : (
            <input
              style={styles.input}
              placeholder="Action to be taken"
              value={values[`${prefix}_remedial`] || ""}
              onChange={(e) => handleChange(`${prefix}_remedial`, e.target.value)}
            />
          )}
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Responsible client</label>
          {readOnly ? (
            <div style={styles.input}>{values[`${prefix}_responsible`] || "N/A"}</div>
          ) : (
            <input
              style={styles.input}
              placeholder="Client name"
              value={values[`${prefix}_responsible`] || ""}
              onChange={(e) => handleChange(`${prefix}_responsible`, e.target.value)}
            />
          )}
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Remedial action deadline</label>
        {readOnly ? (
          <div style={styles.input}>{values[`${prefix}_deadline`] || "N/A"}</div>
        ) : (
          <input
            type="datetime-local"
            style={styles.input}
            value={values[`${prefix}_deadline`] || ""}
            onChange={(e) => handleChange(`${prefix}_deadline`, e.target.value)}
          />
        )}
      </div>
    </div>
  );

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.logoWrapper}>
          <div 
            style={styles.logoBox}
            onClick={() => !readOnly && document.getElementById("logoUpload").click()}
          >
            {values.logo_preview || values.logoUrl ? (
              <img 
                src={values.logo_preview || values.logoUrl} 
                alt="Company Logo" 
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} 
              />
            ) : (
              <div style={{ textAlign: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: 20 }}>+</div>
                <div style={{ fontSize: 10 }}>Upload Logo</div>
              </div>
            )}
            {!readOnly && (
              <input
                id="logoUpload"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    handleChange("logo_preview", url);
                    handleChange("logoUrl", url); // Backwards compatibility
                  }
                }}
              />
            )}
          </div>
        </div>
        <h1 style={styles.title}>{REPORT_TITLE}</h1>
      </div>

      {/* 1. Personnel & Contacts */}
      <div className="pdf-section" style={styles.section}>
        <div style={styles.sectionLabel}>{SECTION_PERSONNEL_AND_CONTACTS}</div>
        <div style={{ ...styles.row, ...styles.col2 }}>
          <div style={styles.field}>
            <label style={styles.label}>Name of Principal Contractor</label>
            {readOnly ? <div style={styles.input}>{values.principal_contractor || "N/A"}</div> : <input style={styles.input} value={values.principal_contractor || ""} onChange={(e) => handleChange("principal_contractor", e.target.value)} />}
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Audit site identifier</label>
            {readOnly ? <div style={styles.input}>{values.audit_site_identifier || "N/A"}</div> : <input style={styles.input} value={values.audit_site_identifier || ""} onChange={(e) => handleChange("audit_site_identifier", e.target.value)} />}
          </div>
        </div>
        <div style={{ ...styles.row, ...styles.col2 }}>
          <div style={styles.field}>
            <label style={styles.label}>Project Name</label>
            {readOnly ? <div style={styles.input}>{values.project_name || "N/A"}</div> : <input style={styles.input} value={values.project_name || ""} onChange={(e) => handleChange("project_name", e.target.value)} />}
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Manager</label>
            {readOnly ? <div style={styles.input}>{values.manager || "N/A"}</div> : <input style={styles.input} value={values.manager || ""} onChange={(e) => handleChange("manager", e.target.value)} />}
          </div>
        </div>
        <div style={{ ...styles.row, ...styles.col2 }}>
          <div style={styles.field}>
            <label style={styles.label}>Supervisor</label>
            {readOnly ? <div style={styles.input}>{values.supervisor || "N/A"}</div> : <input style={styles.input} value={values.supervisor || ""} onChange={(e) => handleChange("supervisor", e.target.value)} />}
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Engineer(s)</label>
            {readOnly ? <div style={styles.input}>{values.engineers || "N/A"}</div> : <input style={styles.input} value={values.engineers || ""} onChange={(e) => handleChange("engineers", e.target.value)} />}
          </div>
        </div>
        <div style={{ ...styles.row, ...styles.col2 }}>
          <div style={styles.field}>
            <label style={styles.label}>Principal Contractor Contact</label>
            {readOnly ? <div style={styles.input}>{values.pc_contact || "N/A"}</div> : <input style={styles.input} value={values.pc_contact || ""} onChange={(e) => handleChange("pc_contact", e.target.value)} />}
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Site Address</label>
            {readOnly ? <div style={styles.input}>{values.site_address || "N/A"}</div> : <input style={styles.input} value={values.site_address || ""} onChange={(e) => handleChange("site_address", e.target.value)} />}
          </div>
        </div>
      </div>

      {/* 2. Welfare and Environment */}
      {readOnly ? renderSectionResults("WELFARE AND ENVIRONMENT", [
        { label: "Washing and toilet facilities adequate", prefix: "washing" },
        { label: "Provision for waste materials", prefix: "waste" },
        { label: "Adequate lighting", prefix: "lighting" }
      ]) : (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>WELFARE AND ENVIRONMENT</div>
          {renderItem("Washing and toilet facilities adequate", "washing")}
          {renderItem("Provision for waste materials", "waste")}
          {renderItem("Adequate lighting", "lighting")}
        </div>
      )}

      {/* 3. House Keeping */}
      {readOnly ? renderSectionResults("HOUSE KEEPING", [
        { label: "Good house keeping within designated storage area", prefix: "storage" },
        { label: "Good house keeping within lift shaft", prefix: "lift_shaft" }
      ]) : (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>HOUSE KEEPING</div>
          {renderItem("Good house keeping within designated storage area", "storage")}
          {renderItem("Good house keeping within lift shaft", "lift_shaft")}
        </div>
      )}

      {/* 4. First Aid and Accidents */}
      {readOnly ? renderSectionResults("FIRST AID AND ACCIDENTS", [
        { label: "First aid facilities", prefix: "first_aid" },
        { label: "Number of first aiders and names", prefix: "first_aiders" },
        { label: "Near-miss incidents", prefix: "near_miss" }
      ]) : (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>FIRST AID AND ACCIDENTS</div>
          {renderItem("First aid facilities", "first_aid")}
          {renderItem("Number of first aiders and names", "first_aiders")}
          {renderItem("Near-miss incidents", "near_miss")}
        </div>
      )}

      {/* 5. Personal Protective Equipment */}
      {readOnly ? renderSectionResults("PERSONAL PROTECTIVE EQUIPMENT", [
        { label: "PPE register completed", prefix: "ppe_register" },
        { label: "PPE inspected and in good order", prefix: "ppe_inspected" },
        { label: "PPE correctly worn and correctly stored", prefix: "ppe_worn" }
      ]) : (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>PERSONAL PROTECTIVE EQUIPMENT</div>
          {renderItem("PPE register completed", "ppe_register")}
          {renderItem("PPE inspected and in good order", "ppe_inspected")}
          {renderItem("PPE correctly worn and correctly stored", "ppe_worn")}
        </div>
      )}

      {/* 6. Lifting Equipment and Tools */}
      {readOnly ? renderSectionResults("LIFTING EQUIPMENT AND TOOLS", [
        { label: "Lifting beams and equipment tested", prefix: "lifting_tested" },
        { label: "Weekly inspection records completed", prefix: "weekly_records" },
        { label: "All tools subject to PAT in last 3 months", prefix: "pat_testing" },
        { label: "Lifting equipment and tools in good order", prefix: "lifting_order" }
      ]) : (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>LIFTING EQUIPMENT AND TOOLS</div>
          {renderItem("Lifting beams and equipment tested", "lifting_tested")}
          {renderItem("Weekly inspection records completed", "weekly_records")}
          {renderItem("All tools subject to PAT in last 3 months", "pat_testing")}
          {renderItem("Lifting equipment and tools in good order", "lifting_order")}
        </div>
      )}

      {/* 7. Entrance Protection and Lift Pits */}
      {readOnly ? renderSectionResults("ENTRANCE PROTECTION AND LIFT PITS", [
        { label: "Lift shaft entrance in place", prefix: "entrance_protection" },
        { label: "Lift pits cleaned and water-proof", prefix: "lift_pits" }
      ]) : (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>ENTRANCE PROTECTION AND LIFT PITS</div>
          {renderItem("Lift shaft entrance in place", "entrance_protection")}
          {renderItem("Lift pits cleaned and water-proof", "lift_pits")}
        </div>
      )}

      {/* 8. Safe Working Practices */}
      {readOnly ? renderSectionResults("SAFE WORKING PRACTICES", [
        { label: "Operatives working safely", prefix: "safe_working" },
        { label: "Operatives working to RAMS", prefix: "rams_compliance" },
        { label: "Completed installations meet requirements", prefix: "install_requirements" },
        { label: "Operatives aware of accident reporting procedure", prefix: "accident_reporting" }
      ]) : (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>SAFE WORKING PRACTICES</div>
          {renderItem("Operatives working safely", "safe_working")}
          {renderItem("Operatives working to RAMS", "rams_compliance")}
          {renderItem("Completed installations meet requirements", "install_requirements")}
          {renderItem("Operatives aware of accident reporting procedure", "accident_reporting")}
        </div>
      )}

      {/* 9. Other Site Issues */}
      {readOnly ? renderSectionResults("OTHER SITE HEALTH AND SAFETY ISSUES", [
        { label: "Other health and safety issues", prefix: "other_issues" }
      ]) : (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>OTHER SITE HEALTH AND SAFETY ISSUES</div>
          {renderItem("Other health and safety issues", "other_issues")}
        </div>
      )}

      {renderOverallSummary()}

      <div style={styles.footerRow}>
        <span>Date: {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );
};

export default WeeklySupervisorInspectionForm;
