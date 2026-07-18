import React, { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { downloadKpiReportPdf, downloadKpiReportWord, KPI_REPORT_EXPORT_MOUNT_STYLE, KPI_REPORT_EXPORT_WIDTH } from "../utils/kpiReportExporter";
import FoodSafetyMonthlyStatistics from "./FoodSafetyMonthlyStatistics";
import FoodSafetyScorecard from "./FoodSafetyScorecard";
import FoodSafetyChartsDashboard from "./FoodSafetyChartsDashboard";
import FoodSafetyReportDocument from "./FoodSafetyReportDocument";
import KpiTrackingLegend from "./dashboard/KpiTrackingLegend";
import KpiReportDownloadBar from "./dashboard/KpiReportDownloadBar";
import { getActingClient } from "../utils/actingClient";
import { useKpiDashboardPersistence } from "../hooks/useKpiDashboardPersistence";
import {
  createDefaultFsStatRows,
  createEmptyIncidentSnapshot,
  isFsStatRow,
  normalizeIncidentSnapshot,
  shouldSeedDefaultFsKpis,
} from "../utils/foodSafetyDashboardUtils";

const STORAGE_PREFIXES = {
  stats: "site-mate:fs-monthly-stats:",
  incidents: "site-mate:fs-incidents:",
  targets: "site-mate:fs-scorecard-targets:",
  meta: "site-mate:fs-dashboard-meta:",
  snapshot: "site-mate:fs-incidents:",
};

export default function FoodSafetyDashboard() {
  const { currentUser } = useAuth();
  const reportRef = useRef(null);

  const {
    statRows,
    setStatRows,
    snapshot: incidents,
    setSnapshot: setIncidents,
    targets,
    updateTarget,
    lastSavedAt,
    hydrated,
    saving,
    saveNow,
  } = useKpiDashboardPersistence({
    section: "food-safety",
    currentUser,
    storagePrefixes: STORAGE_PREFIXES,
    createDefaultStatRows: createDefaultFsStatRows,
    shouldSeedStatRows: shouldSeedDefaultFsKpis,
    createEmptySnapshot: createEmptyIncidentSnapshot,
    normalizeSnapshot: normalizeIncidentSnapshot,
    hasSnapshot: true,
  });

  const [downloading, setDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const organisationName =
    getActingClient()?.name ||
    currentUser?.companyname ||
    currentUser?.company ||
    "";

  const updateIndicator = useCallback((rowId, value) => {
    setStatRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, indicator: value } : row))
    );
  }, [setStatRows]);

  const hasReportData = useMemo(() => statRows.some(isFsStatRow), [statRows]);

  const handleSave = async () => {
    if (!hasReportData) {
      setSnackbar({
        open: true,
        message: "Add at least one indicator or monthly value before saving.",
        severity: "warning",
      });
      return;
    }

    try {
      await saveNow();
      setSnackbar({ open: true, message: "Dashboard saved successfully.", severity: "success" });
    } catch (err) {
      console.error("Food safety save failed:", err);
      setSnackbar({
        open: true,
        message: "Could not save dashboard. Please try again.",
        severity: "error",
      });
    }
  };

  const runReportDownload = async (format) => {
    if (!hasReportData) {
      setSnackbar({
        open: true,
        message: "Add at least one indicator or monthly value before downloading the report.",
        severity: "warning",
      });
      return;
    }

    setDownloading(true);
    setDownloadFormat(format);

    try {
      await saveNow();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const year = new Date().getFullYear();
      const fileName = `Food_Safety_Report_${year}`;
      if (format === "pdf") {
        await downloadKpiReportPdf(reportRef, fileName);
      } else {
        await downloadKpiReportWord(reportRef, fileName);
      }

      setSnackbar({
        open: true,
        message: `${format === "pdf" ? "PDF" : "Word"} report downloaded successfully.`,
        severity: "success",
      });
    } catch (err) {
      console.error("Food safety report download failed:", err);
      setSnackbar({
        open: true,
        message: `${format === "pdf" ? "PDF" : "Word"} download failed. Please try again.`,
        severity: "error",
      });
    } finally {
      setDownloading(false);
      setDownloadFormat(null);
    }
  };

  const handleDownloadPdf = () => runReportDownload("pdf");
  const handleDownloadWord = () => runReportDownload("word");

  const lastSavedLabel = lastSavedAt
    ? `Last saved ${new Date(lastSavedAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : null;

  if (!hydrated) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "64px 16px" }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid #E5E7EB",
            borderTopColor: "#E89F17",
            animation: "kpi-spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes kpi-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <KpiTrackingLegend />
      <FoodSafetyMonthlyStatistics
        rows={statRows}
        onRowsChange={setStatRows}
        incidents={incidents}
        onIncidentsChange={setIncidents}
      />
      <FoodSafetyScorecard
        statRows={statRows}
        targets={targets}
        onUpdateTarget={updateTarget}
        onUpdateIndicator={updateIndicator}
      />
      <FoodSafetyChartsDashboard statRows={statRows} incidents={incidents} targets={targets} />

      <KpiReportDownloadBar
        saving={saving}
        downloading={downloading}
        downloadFormat={downloadFormat}
        lastSavedLabel={lastSavedLabel}
        onSave={handleSave}
        onDownloadPdf={handleDownloadPdf}
        onDownloadWord={handleDownloadWord}
        saveColor="#ea580c"
        saveHoverColor="#c2410c"
        accentColor="#ea580c"
        helpText="Changes auto-save to your organisation. Use Save to confirm immediately, or download PDF/Word reports."
      />

      <div aria-hidden="true" style={KPI_REPORT_EXPORT_MOUNT_STYLE}>
        <div
          ref={reportRef}
          className="pdf-export-root kpi-report-export"
          style={{ width: KPI_REPORT_EXPORT_WIDTH, background: "#fff" }}
        >
          <FoodSafetyReportDocument
            statRows={statRows}
            incidents={incidents}
            targets={targets}
            organisationName={organisationName}
            savedAt={lastSavedAt}
          />
          <FoodSafetyChartsDashboard exportMode statRows={statRows} incidents={incidents} targets={targets} />
        </div>
      </div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
