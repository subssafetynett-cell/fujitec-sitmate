import React, { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { downloadKpiReportPdf, downloadKpiReportWord, KPI_REPORT_EXPORT_MOUNT_STYLE, KPI_REPORT_EXPORT_WIDTH } from "../utils/kpiReportExporter";
import QualityMonthlyStatistics from "./QualityMonthlyStatistics";
import QualityScorecard from "./QualityScorecard";
import QualityChartsDashboard from "./QualityChartsDashboard";
import QualityReportDocument from "./QualityReportDocument";
import KpiTrackingLegend from "./dashboard/KpiTrackingLegend";
import KpiReportDownloadBar from "./dashboard/KpiReportDownloadBar";
import { getActingClient } from "../utils/actingClient";
import { useKpiDashboardPersistence } from "../hooks/useKpiDashboardPersistence";
import {
  createDefaultQualityStatRows,
  createEmptyAttendanceSnapshot,
  isQualityStatRow,
  normalizeAttendanceSnapshot,
  shouldSeedDefaultQualityKpis,
} from "../utils/qualityDashboardUtils";

const STORAGE_PREFIXES = {
  stats: "site-mate:quality-monthly-stats:",
  attendance: "site-mate:quality-attendance:",
  targets: "site-mate:quality-scorecard-targets:",
  meta: "site-mate:quality-dashboard-meta:",
  snapshot: "site-mate:quality-attendance:",
};

export default function QualityDashboard() {
  const { currentUser } = useAuth();
  const reportRef = useRef(null);

  const {
    statRows,
    setStatRows,
    snapshot: attendance,
    setSnapshot: setAttendance,
    targets,
    updateTarget,
    lastSavedAt,
    hydrated,
    saving,
    saveNow,
  } = useKpiDashboardPersistence({
    section: "quality",
    currentUser,
    storagePrefixes: STORAGE_PREFIXES,
    createDefaultStatRows: createDefaultQualityStatRows,
    shouldSeedStatRows: shouldSeedDefaultQualityKpis,
    createEmptySnapshot: createEmptyAttendanceSnapshot,
    normalizeSnapshot: normalizeAttendanceSnapshot,
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

  const hasReportData = useMemo(() => statRows.some(isQualityStatRow), [statRows]);

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
      console.error("Quality save failed:", err);
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
      const fileName = `Quality_Report_${year}`;
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
      console.error("Quality report download failed:", err);
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
      <QualityMonthlyStatistics
        rows={statRows}
        onRowsChange={setStatRows}
        attendance={attendance}
        onAttendanceChange={setAttendance}
      />
      <QualityScorecard
        statRows={statRows}
        targets={targets}
        attendance={attendance}
        onUpdateTarget={updateTarget}
        onUpdateIndicator={updateIndicator}
      />
      <QualityChartsDashboard statRows={statRows} attendance={attendance} targets={targets} />

      <KpiReportDownloadBar
        saving={saving}
        downloading={downloading}
        downloadFormat={downloadFormat}
        lastSavedLabel={lastSavedLabel}
        onSave={handleSave}
        onDownloadPdf={handleDownloadPdf}
        onDownloadWord={handleDownloadWord}
        saveColor="#7c3aed"
        saveHoverColor="#6d28d9"
        accentColor="#7c3aed"
        helpText="Changes auto-save to your organisation. Use Save to confirm immediately, or download PDF/Word reports."
      />

      <div aria-hidden="true" style={KPI_REPORT_EXPORT_MOUNT_STYLE}>
        <div
          ref={reportRef}
          className="pdf-export-root kpi-report-export"
          style={{ width: KPI_REPORT_EXPORT_WIDTH, background: "#fff" }}
        >
          <QualityReportDocument
            statRows={statRows}
            attendance={attendance}
            targets={targets}
            organisationName={organisationName}
            savedAt={lastSavedAt}
          />
          <QualityChartsDashboard exportMode statRows={statRows} attendance={attendance} targets={targets} />
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
