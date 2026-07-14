export const MONITORING_SECTIONS = {
  ohs: {
    key: "ohs",
    title: "Occupational Health and Safety Monitoring",
    dashboardTitle: "Occupational Health and Safety",
    dashboardSubtitle: "Track safety indicators, targets, and year-to-date performance.",
    subtitle: "Select a form to fill, then review saved submissions on this page.",
    category: "Occupational Health and Safety Monitoring",
    dashboardPath: "/dashboard/occupational-health-safety-kpis",
    basePath: "/monitoring/ohs",
  },
  environmental: {
    key: "environmental",
    title: "Environmental Management Monitoring",
    dashboardTitle: "Environmental Management",
    dashboardSubtitle: "Track environmental indicators, waste, targets, and year-to-date performance.",
    subtitle: "Select a form to fill, then review saved submissions on this page.",
    category: "Environmental Management Monitoring",
    dashboardPath: "/dashboard/environmental-management-kpis",
    basePath: "/monitoring/environmental",
  },
  quality: {
    key: "quality",
    title: "Quality Management Monitoring",
    dashboardTitle: "Quality Management",
    dashboardSubtitle: "Track quality indicators, board attendance, targets, and year-to-date performance.",
    subtitle: "Select a form to fill, then review saved submissions on this page.",
    category: "Quality Management Monitoring",
    dashboardPath: "/dashboard/quality-management-kpis",
    basePath: "/monitoring/quality",
  },
  "food-safety": {
    key: "food-safety",
    title: "Food Safety Management Monitoring",
    dashboardTitle: "Food Safety Management",
    dashboardSubtitle: "Track food safety indicators, incidents, targets, and year-to-date performance.",
    subtitle: "Select a form to fill, then review saved submissions on this page.",
    category: "Food Safety Management Monitoring",
    dashboardPath: "/dashboard/food-safety-management",
    basePath: "/monitoring/food-safety",
  },
  lift: {
    key: "lift",
    title: "Lift Regulations Management Monitoring",
    dashboardTitle: "Lift Regulations Management",
    dashboardSubtitle:
      "Track LOLER, PUWER, compliance rates, defects, and year-to-date lift regulation performance.",
    subtitle: "Select a form to fill, then review saved submissions on this page.",
    category: "Lift Regulations Management Monitoring",
    dashboardPath: "/dashboard/lift-regulations-management-kpis",
    basePath: "/monitoring/lift",
  },
};

export function getMonitoringSection(sectionKey) {
  return MONITORING_SECTIONS[sectionKey] || null;
}

export const MONITORING_DASHBOARD_PATHS = Object.values(MONITORING_SECTIONS).map(
  (s) => s.dashboardPath
);

export const MONITORING_FORMS_PATHS = Object.values(MONITORING_SECTIONS).map(
  (s) => s.basePath
);
