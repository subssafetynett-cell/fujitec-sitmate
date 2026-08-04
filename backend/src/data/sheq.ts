/**
 * Seed data for the SHEQ Harmony API.
 * Single source of truth for dashboards, modules and charts.
 * Served by the SHEQ Harmony REST API.
 */

export type Status = string;

export const company = {
  name: "Northgate Industrial Group",
  industry: "Engineering & Facilities",
  country: "United Kingdom",
  plan: "Enterprise",
  users: 248,
};

export type OrgCompany = {
  id: string;
  name: string;
  industry: string;
  country: string;
  logo: string;
  status: "Active" | "Inactive";
  createdAt: string;
};

export const companies: OrgCompany[] = [];

export const overview = {
  companies: 0,
  users: 0,
  activeUsers: 0,
  sites: 0,
  audits: 412,
  scheduledAudits: 38,
  completedAudits: 351,
  openNonConformances: 27,
  closedNonConformances: 184,
  openConcerns: 19,
  closedConcerns: 236,
  templates: 64,
  performanceScore: 87,
  compliance: 92,
};

export const monthlyAudits = [
  { month: "Jan", scheduled: 32, completed: 28 },
  { month: "Feb", scheduled: 35, completed: 31 },
  { month: "Mar", scheduled: 41, completed: 36 },
  { month: "Apr", scheduled: 38, completed: 35 },
  { month: "May", scheduled: 44, completed: 41 },
  { month: "Jun", scheduled: 47, completed: 39 },
  { month: "Jul", scheduled: 43, completed: 40 },
  { month: "Aug", scheduled: 45, completed: 43 },
  { month: "Sep", scheduled: 49, completed: 44 },
  { month: "Oct", scheduled: 52, completed: 48 },
  { month: "Nov", scheduled: 48, completed: 45 },
  { month: "Dec", scheduled: 39, completed: 34 },
];

export const disciplineTrend = [
  { month: "Jul", safety: 82, environment: 74, quality: 88 },
  { month: "Aug", safety: 84, environment: 77, quality: 87 },
  { month: "Sep", safety: 86, environment: 79, quality: 90 },
  { month: "Oct", safety: 85, environment: 83, quality: 91 },
  { month: "Nov", safety: 89, environment: 85, quality: 93 },
  { month: "Dec", safety: 91, environment: 88, quality: 94 },
];

export const ncTrend = [
  { month: "Jul", raised: 22, closed: 16, concerns: 18 },
  { month: "Aug", raised: 19, closed: 21, concerns: 15 },
  { month: "Sep", raised: 25, closed: 20, concerns: 22 },
  { month: "Oct", raised: 17, closed: 24, concerns: 14 },
  { month: "Nov", raised: 14, closed: 19, concerns: 12 },
  { month: "Dec", raised: 11, closed: 17, concerns: 9 },
];

export type Site = {
  id: string;
  name: string;
  address: string;
  city: string;
  /** Display string of managers (comma-separated). */
  manager: string;
  /** One or more site managers. */
  managers: string[];
  employees: number;
  compliance: number;
  openNcs: number;
  status: "Active" | "Inactive" | "Onboarding" | "Suspended";
  packItems: number;
  packExpiring: number;
};

export const sites: Site[] = [];

export const sitePerformance: { name: string; score: number }[] = [];

export type Audit = {
  id: string;
  title: string;
  site: string;
  auditor: string;
  category: "Health & Safety" | "Environmental" | "Quality" | "Lift Regulations";
  standard: string;
  due: string;
  status: "Scheduled" | "In Progress" | "Awaiting Review" | "Completed" | "Overdue";
  score: number | null;
  findings: number;
};

export const audits: Audit[] = [
  { id: "AUD-1042", title: "Annual ISO 45001 Surveillance", site: "Riverside Plant", auditor: "Priya Raman", category: "Health & Safety", standard: "ISO 45001", due: "2026-08-04", status: "Scheduled", score: null, findings: 0 },
  { id: "AUD-1041", title: "Lift Thorough Examination", site: "Southbank Towers", auditor: "Marcus Bell", category: "Lift Regulations", standard: "LOLER 1998", due: "2026-08-02", status: "In Progress", score: null, findings: 2 },
  { id: "AUD-1039", title: "Waste Segregation Inspection", site: "Harbour Logistics", auditor: "Ana Ferreira", category: "Environmental", standard: "ISO 14001", due: "2026-07-29", status: "Overdue", score: null, findings: 4 },
  { id: "AUD-1036", title: "Supplier Quality Audit — Kessler", site: "Northgate HQ", auditor: "Tom Okafor", category: "Quality", standard: "ISO 9001", due: "2026-07-26", status: "Awaiting Review", score: 88, findings: 3 },
  { id: "AUD-1034", title: "Monthly Site Safety Walk", site: "Eastfield Depot", auditor: "Jack Wilding", category: "Health & Safety", standard: "Internal", due: "2026-07-22", status: "Completed", score: 94, findings: 1 },
  { id: "AUD-1031", title: "Energy & Emissions Review", site: "Clyde Works", auditor: "Erin Docherty", category: "Environmental", standard: "ISO 14001", due: "2026-07-18", status: "Completed", score: 81, findings: 5 },
  { id: "AUD-1028", title: "Calibration Records Check", site: "Riverside Plant", auditor: "Tom Okafor", category: "Quality", standard: "ISO 9001", due: "2026-07-15", status: "Completed", score: 97, findings: 0 },
  { id: "AUD-1024", title: "Emergency Lighting Test", site: "Southbank Towers", auditor: "Marcus Bell", category: "Health & Safety", standard: "Internal", due: "2026-07-11", status: "Completed", score: 90, findings: 2 },
];

export type TemplateKind =
  | "standard"
  | "toolbox-talk"
  | "rams-briefing"
  | "safe-start"
  | "audit-action"
  | "puwer"
  | "loler"
  | "site-sheq"
  | "site-induction"
  | "ohs-concern"
  | "quality-concern"
  | "good-practice"
  | "sustainability-concern"
  | "sheq-service-report"
  | "sheq-installation-report"
  | "alimak-weekly-check";

export type Template = {
  id: string;
  name: string;
  category: "ISO 9001" | "ISO 14001" | "ISO 45001" | "Lift Regulations" | "Environmental" | "Quality" | "Health & Safety" | "Concern" | "SHEQ Forms" | "Custom";
  fields: number;
  version: string;
  updated: string;
  uses: number;
  status: "Published" | "Draft" | "Archived";
  kind?: TemplateKind;
  code?: string;
  logoLeft?: string;
  logoRight?: string;
  documentNo?: string;
  approvedBy?: string;
  description?: string;
};

export const templates: Template[] = [
  {
    id: "TPL-20",
    name: "Tool Box Talk Register",
    code: "CL-F-20",
    category: "Health & Safety",
    fields: 16,
    version: "Rev 0",
    updated: "2023-05-01",
    uses: 228,
    status: "Published",
    kind: "toolbox-talk",
    documentNo: "",
    approvedBy: "",
    description: "Tool box talk attendance register with presenter, topic, signatures and consultation notes.",
  },
  {
    id: "TPL-21",
    name: "RAMS Briefing Register",
    code: "CL-F-21",
    category: "Health & Safety",
    fields: 18,
    version: "Rev 0",
    updated: "2023-05-01",
    uses: 146,
    status: "Published",
    kind: "rams-briefing",
    documentNo: "",
    approvedBy: "",
    description: "Risk Assessment & Method Statement briefing register for inductees and inductors.",
  },
  {
    id: "TPL-22",
    name: "Daily Safe Start Briefing Sheet",
    code: "CL-F-22",
    category: "Health & Safety",
    fields: 24,
    version: "Rev 0",
    updated: "2023-05-01",
    uses: 312,
    status: "Published",
    kind: "safe-start",
    documentNo: "",
    approvedBy: "",
    description: "Start Right daily safety briefing with hazards, controls and attendance.",
  },
  {
    id: "TPL-23",
    name: "Audit Action Form",
    code: "CL-F-23",
    category: "Quality",
    fields: 12,
    version: "Rev 0",
    updated: "2023-05-01",
    uses: 88,
    status: "Published",
    kind: "audit-action",
    documentNo: "",
    approvedBy: "",
    description: "Observation, proposed action, follow-up and audit summary form.",
  },
  {
    id: "TPL-39",
    name: "PUWER Inspection Form",
    code: "CL-F-39",
    category: "Lift Regulations",
    fields: 16,
    version: "Rev 0",
    updated: "2023-05-01",
    uses: 204,
    status: "Published",
    kind: "puwer",
    documentNo: "",
    approvedBy: "",
    description: "Plant and equipment PUWER inspection register with PAT and defect tracking.",
  },
  {
    id: "TPL-40",
    name: "LOLER Inspection Form",
    code: "CL-F-40",
    category: "Lift Regulations",
    fields: 14,
    version: "Rev 0",
    updated: "2023-05-01",
    uses: 191,
    status: "Published",
    kind: "loler",
    documentNo: "",
    approvedBy: "",
    description: "LOLER thorough examination and safe-to-use inspection form.",
  },
  {
    id: "TPL-55",
    name: "Site SHEQ Inspection Form",
    code: "CL-F-55",
    category: "Health & Safety",
    fields: 42,
    version: "Rev 01",
    updated: "2023-05-01",
    uses: 97,
    status: "Published",
    kind: "site-sheq",
    documentNo: "",
    approvedBy: "",
    description: "Management site inspection report with ST1–ST20 scoring and actions.",
  },
  {
    id: "TPL-57",
    name: "Site Induction Register",
    code: "CL-F-57",
    category: "Health & Safety",
    fields: 20,
    version: "Rev 0",
    updated: "2023-05-01",
    uses: 265,
    status: "Published",
    kind: "site-induction",
    documentNo: "",
    approvedBy: "",
    description: "Site induction attendance register with competency card details.",
  },
  {
    id: "TPL-58",
    name: "Occupational Health and Safety Concern",
    code: "OHS-CN",
    category: "Concern",
    fields: 28,
    version: "Rev 0",
    updated: "2026-08-02",
    uses: 0,
    status: "Published",
    kind: "ohs-concern",
    documentNo: "",
    approvedBy: "",
    description:
      "Health and safety concern report covering project details, location, incident classification, observations, nonconformance and assignee response.",
  },
  {
    id: "TPL-59",
    name: "Quality Concern",
    code: "QC-CN",
    category: "Concern",
    fields: 28,
    version: "Rev 0",
    updated: "2026-08-02",
    uses: 0,
    status: "Published",
    kind: "quality-concern",
    documentNo: "",
    approvedBy: "",
    description:
      "Quality concern report covering project details, location, incident classification, observations, nonconformance and assignee response.",
  },
  {
    id: "TPL-60",
    name: "Good Practice",
    code: "GP-CN",
    category: "Concern",
    fields: 28,
    version: "Rev 0",
    updated: "2026-08-02",
    uses: 0,
    status: "Published",
    kind: "good-practice",
    documentNo: "",
    approvedBy: "",
    description:
      "Positive observation / good practice report covering project details, location, classification, observations and follow-up actions.",
  },
  {
    id: "TPL-61",
    name: "Sustainability Concern",
    code: "SUS-CN",
    category: "Concern",
    fields: 28,
    version: "Rev 0",
    updated: "2026-08-02",
    uses: 0,
    status: "Published",
    kind: "sustainability-concern",
    documentNo: "",
    approvedBy: "",
    description:
      "Sustainability and environmental concern report covering waste, spillages, emissions, hazardous materials and related classifications.",
  },
  {
    id: "TPL-62",
    name: "SHEQ Service Report",
    code: "SHEQ-INSP-01",
    category: "SHEQ Forms",
    fields: 42,
    version: "Rev 0",
    updated: "2026-08-02",
    uses: 0,
    status: "Published",
    kind: "sheq-service-report",
    documentNo: "SHEQ-INSP-01",
    approvedBy: "Management",
    description:
      "SHEQ service report with project details, H&S status, scoring summary and sectional performance analytics.",
  },
  {
    id: "TPL-63",
    name: "SHEQ Installation Service Report",
    code: "SHEQ-INST-01",
    category: "SHEQ Forms",
    fields: 44,
    version: "Rev 0",
    updated: "2026-08-02",
    uses: 0,
    status: "Published",
    kind: "sheq-installation-report",
    documentNo: "SHEQ-INST-01",
    approvedBy: "Management",
    description:
      "SHEQ installation service report with project details, installation scoring, compliance analytics and handover notes.",
  },
  {
    id: "TPL-64",
    name: "Alimak Weekly Check",
    code: "CL-F-64",
    category: "Lift Regulations",
    fields: 120,
    version: "Rev 0",
    updated: "2026-08-04",
    uses: 0,
    status: "Published",
    kind: "alimak-weekly-check",
    documentNo: "CL-F-64",
    approvedBy: "Management",
    description:
      "Alimak weekly hoist check with project details, Mon–Sun checklist items and daily signatures.",
  },
];

export type SheqFormRecord = {
  id: string;
  title: string;
  site: string;
  client: string;
  status: "Draft" | "Submitted" | "Closed";
  hsStatus?: "GREEN" | "AMBER" | "RED" | "";
  raised: string;
  templateId?: string;
  templateName?: string;
  kind?: TemplateKind;
  formData?: Record<string, string>;
  /** Authenticated user who created the form. */
  createdById?: string;
  createdByName?: string;
  /** Company of the creator (for tenant scoping). */
  company?: string;
};

export type NonConformance = {
  id: string;
  title: string;
  site: string;
  department: string;
  owner: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  stage: "Open" | "Assigned" | "Investigating" | "Corrective Action" | "Verification" | "Closed";
  raised: string;
  due: string;
  source: string;
};

export const nonConformances: NonConformance[] = [
  { id: "NC-3081", title: "Guard removed from bandsaw", site: "Riverside Plant", department: "Fabrication", owner: "Tom Okafor", severity: "Critical", stage: "Corrective Action", raised: "2026-07-24", due: "2026-08-05", source: "Safety walk" },
  { id: "NC-3079", title: "Hazardous waste stored uncovered", site: "Harbour Logistics", department: "Logistics", owner: "Ana Ferreira", severity: "High", stage: "Investigating", raised: "2026-07-22", due: "2026-08-02", source: "ISO 14001 audit" },
  { id: "NC-3076", title: "Calibration certificate expired", site: "Riverside Plant", department: "Quality", owner: "Sofia Lange", severity: "Medium", stage: "Verification", raised: "2026-07-19", due: "2026-07-31", source: "ISO 9001 audit" },
  { id: "NC-3074", title: "Lift emergency phone not answering", site: "Southbank Towers", department: "Facilities", owner: "Marcus Bell", severity: "High", stage: "Assigned", raised: "2026-07-18", due: "2026-07-30", source: "LOLER inspection" },
  { id: "NC-3071", title: "Missing PPE signage at entry", site: "Eastfield Depot", department: "Operations", owner: "Jack Wilding", severity: "Low", stage: "Open", raised: "2026-07-16", due: "2026-08-08", source: "Employee report" },
  { id: "NC-3068", title: "Contractor induction records incomplete", site: "Clyde Works", department: "HR", owner: "Erin Docherty", severity: "Medium", stage: "Corrective Action", raised: "2026-07-12", due: "2026-07-29", source: "Internal audit" },
  { id: "NC-3061", title: "Spill kit contents depleted", site: "Harbour Logistics", department: "Logistics", owner: "Ana Ferreira", severity: "Medium", stage: "Closed", raised: "2026-06-28", due: "2026-07-10", source: "Inspection" },
  { id: "NC-3055", title: "Incorrect torque values in work instruction", site: "Northgate HQ", department: "Engineering", owner: "Priya Raman", severity: "High", stage: "Closed", raised: "2026-06-15", due: "2026-06-30", source: "Customer complaint" },
];

export const ncStages = ["Open", "Assigned", "Investigating", "Corrective Action", "Verification", "Closed"] as const;

export const ncWorkflow = [
  "Raise Non-Conformance",
  "Assign Responsible Person",
  "Root Cause Analysis",
  "Correction",
  "Corrective Action",
  "Evidence Upload",
  "Verification",
  "Approval",
  "Close",
];

export const ncByDepartment = [
  { name: "Fabrication", open: 8, closed: 41 },
  { name: "Logistics", open: 6, closed: 33 },
  { name: "Facilities", open: 5, closed: 28 },
  { name: "Quality", open: 4, closed: 39 },
  { name: "Engineering", open: 3, closed: 26 },
  { name: "HR", open: 1, closed: 17 },
];

export type Concern = {
  id: string;
  title: string;
  category: "Occupational Health & Safety" | "Environmental" | "Quality" | "Good Practice" | "Near Miss" | "Unsafe Act" | "Unsafe Condition" | "Improvement Suggestion";
  site: string;
  reporter: string;
  anonymous: boolean;
  priority: "Low" | "Medium" | "High";
  status: "Reported" | "Assigned" | "Action Underway" | "Verification" | "Closed";
  raised: string;
  templateId?: string;
  templateName?: string;
  kind?: TemplateKind;
  formData?: Record<string, string>;
};

export const concerns: Concern[] = [
  { id: "CN-882", title: "Forklift reversing without banksman", category: "Unsafe Act", site: "Harbour Logistics", reporter: "Anonymous", anonymous: true, priority: "High", status: "Assigned", raised: "2026-07-28" },
  { id: "CN-880", title: "Pallet stack leaning near walkway", category: "Unsafe Condition", site: "Riverside Plant", reporter: "D. Mwangi", anonymous: false, priority: "Medium", status: "Action Underway", raised: "2026-07-27" },
  { id: "CN-877", title: "Coolant drum leaking into drain", category: "Environmental", site: "Clyde Works", reporter: "E. Docherty", anonymous: false, priority: "High", status: "Reported", raised: "2026-07-26" },
  { id: "CN-874", title: "Near miss — dropped scaffold clamp", category: "Near Miss", site: "Southbank Towers", reporter: "Anonymous", anonymous: true, priority: "High", status: "Verification", raised: "2026-07-24" },
  { id: "CN-869", title: "Suggest QR check-in for visitors", category: "Improvement Suggestion", site: "Northgate HQ", reporter: "L. Novak", anonymous: false, priority: "Low", status: "Closed", raised: "2026-07-20" },
  { id: "CN-864", title: "Great housekeeping in paint bay", category: "Good Practice", site: "Riverside Plant", reporter: "T. Okafor", anonymous: false, priority: "Low", status: "Closed", raised: "2026-07-17" },
];

export const concernWorkflow = [
  "Employee reports concern",
  "Manager notified",
  "Assign responsible person",
  "Corrective action",
  "Evidence uploaded",
  "Verification",
  "Closed",
];

export type Kpi = {
  name: string;
  value: number;
  unit: string;
  target: number;
  higherIsBetter: boolean;
  trend: number;
  history: number[];
};

export type KpiGroup = {
  slug: string;
  label: string;
  short: string;
  score: number;
  kpis: Kpi[];
};

const h = (...n: number[]) => n;

export const kpiGroups: KpiGroup[] = [
  {
    slug: "health-safety",
    label: "Occupational Health & Safety",
    short: "Occupational Health & Safety",
    score: 91,
    kpis: [
      { name: "Lost Time Injury Frequency Rate", value: 0.42, unit: "", target: 0.5, higherIsBetter: false, trend: -12, history: h(0.71, 0.68, 0.6, 0.55, 0.48, 0.42) },
      { name: "Near Misses Reported", value: 64, unit: "", target: 50, higherIsBetter: true, trend: 18, history: h(38, 42, 47, 51, 58, 64) },
      { name: "Incident Rate", value: 1.8, unit: "per 100", target: 2.0, higherIsBetter: false, trend: -8, history: h(2.6, 2.4, 2.2, 2.1, 1.9, 1.8) },
      { name: "Training Completion", value: 94, unit: "%", target: 95, higherIsBetter: true, trend: 4, history: h(84, 86, 88, 90, 92, 94) },
      { name: "PPE Compliance", value: 97, unit: "%", target: 98, higherIsBetter: true, trend: 2, history: h(92, 93, 94, 95, 96, 97) },
      { name: "Risk Assessments Completed", value: 148, unit: "", target: 140, higherIsBetter: true, trend: 9, history: h(112, 118, 126, 133, 141, 148) },
      { name: "Inspections Completed", value: 212, unit: "", target: 200, higherIsBetter: true, trend: 6, history: h(174, 182, 190, 197, 205, 212) },
      { name: "Safety Observations", value: 386, unit: "", target: 350, higherIsBetter: true, trend: 11, history: h(288, 305, 322, 344, 366, 386) },
      { name: "Corrective Actions Closed", value: 89, unit: "%", target: 90, higherIsBetter: true, trend: 5, history: h(72, 76, 80, 83, 86, 89) },
      { name: "First Aid Cases", value: 7, unit: "", target: 10, higherIsBetter: false, trend: -22, history: h(14, 13, 11, 10, 9, 7) },
    ],
  },
  {
    slug: "environmental",
    label: "Environmental Management",
    short: "Environmental",
    score: 88,
    kpis: [
      { name: "Waste Generated", value: 128, unit: "t", target: 140, higherIsBetter: false, trend: -6, history: h(158, 152, 146, 139, 133, 128) },
      { name: "Waste Recycled", value: 74, unit: "%", target: 70, higherIsBetter: true, trend: 8, history: h(58, 61, 65, 68, 71, 74) },
      { name: "Energy Consumption", value: 412, unit: "MWh", target: 430, higherIsBetter: false, trend: -4, history: h(468, 456, 442, 431, 421, 412) },
      { name: "Water Consumption", value: 2840, unit: "m³", target: 3000, higherIsBetter: false, trend: -5, history: h(3320, 3210, 3120, 3010, 2930, 2840) },
      { name: "Carbon Emissions", value: 184, unit: "tCO₂e", target: 200, higherIsBetter: false, trend: -9, history: h(238, 226, 214, 203, 193, 184) },
      { name: "Fuel Usage", value: 38, unit: "kL", target: 40, higherIsBetter: false, trend: -3, history: h(46, 44, 43, 41, 39, 38) },
      { name: "Environmental Incidents", value: 2, unit: "", target: 0, higherIsBetter: false, trend: -50, history: h(7, 6, 5, 4, 4, 2) },
      { name: "Compliance Score", value: 93, unit: "%", target: 95, higherIsBetter: true, trend: 3, history: h(84, 86, 88, 90, 91, 93) },
      { name: "Recycling Rate", value: 71, unit: "%", target: 75, higherIsBetter: true, trend: 6, history: h(55, 59, 62, 66, 69, 71) },
      { name: "Environmental Audits", value: 24, unit: "", target: 20, higherIsBetter: true, trend: 12, history: h(14, 16, 18, 20, 22, 24) },
    ],
  },
  {
    slug: "quality",
    label: "Quality Management",
    short: "Quality",
    score: 94,
    kpis: [
      { name: "Customer Complaints", value: 6, unit: "", target: 8, higherIsBetter: false, trend: -25, history: h(14, 12, 11, 9, 8, 6) },
      { name: "Internal Audit Score", value: 92, unit: "%", target: 90, higherIsBetter: true, trend: 4, history: h(83, 85, 87, 89, 90, 92) },
      { name: "Supplier Performance", value: 88, unit: "%", target: 90, higherIsBetter: true, trend: 2, history: h(80, 82, 84, 85, 87, 88) },
      { name: "Defects", value: 31, unit: "ppm", target: 40, higherIsBetter: false, trend: -14, history: h(52, 48, 44, 39, 35, 31) },
      { name: "Corrective Actions", value: 42, unit: "", target: 40, higherIsBetter: true, trend: 7, history: h(28, 31, 34, 37, 40, 42) },
      { name: "On-Time Delivery", value: 96, unit: "%", target: 95, higherIsBetter: true, trend: 3, history: h(89, 90, 92, 93, 95, 96) },
      { name: "Customer Satisfaction", value: 4.6, unit: "/5", target: 4.5, higherIsBetter: true, trend: 5, history: h(4.1, 4.2, 4.3, 4.4, 4.5, 4.6) },
      { name: "Quality Objectives Met", value: 87, unit: "%", target: 90, higherIsBetter: true, trend: 6, history: h(70, 74, 78, 82, 85, 87) },
      { name: "Quality Incidents", value: 4, unit: "", target: 5, higherIsBetter: false, trend: -20, history: h(9, 8, 7, 6, 5, 4) },
      { name: "CAPA Completion", value: 91, unit: "%", target: 92, higherIsBetter: true, trend: 4, history: h(78, 81, 84, 87, 89, 91) },
    ],
  },
  {
    slug: "lift-regulations",
    label: "Lift Regulations",
    short: "Lift Regs",
    score: 85,
    kpis: [
      { name: "Lift Inspections", value: 118, unit: "", target: 120, higherIsBetter: true, trend: 5, history: h(94, 99, 104, 109, 114, 118) },
      { name: "Lift Defects", value: 13, unit: "", target: 10, higherIsBetter: false, trend: -18, history: h(24, 21, 19, 17, 15, 13) },
      { name: "Service Compliance", value: 96, unit: "%", target: 98, higherIsBetter: true, trend: 2, history: h(90, 91, 93, 94, 95, 96) },
      { name: "Emergency Testing", value: 89, unit: "%", target: 95, higherIsBetter: true, trend: 6, history: h(72, 76, 80, 84, 86, 89) },
      { name: "Breakdowns", value: 9, unit: "", target: 8, higherIsBetter: false, trend: -10, history: h(16, 15, 13, 12, 10, 9) },
      { name: "Maintenance Completion", value: 93, unit: "%", target: 95, higherIsBetter: true, trend: 3, history: h(85, 87, 89, 90, 92, 93) },
      { name: "Inspection Pass Rate", value: 91, unit: "%", target: 92, higherIsBetter: true, trend: 4, history: h(82, 84, 86, 88, 90, 91) },
      { name: "Outstanding Repairs", value: 5, unit: "", target: 3, higherIsBetter: false, trend: -28, history: h(12, 11, 9, 8, 6, 5) },
      { name: "Engineer Visits", value: 64, unit: "", target: 60, higherIsBetter: true, trend: 8, history: h(48, 51, 54, 58, 61, 64) },
      { name: "Overall Compliance", value: 94, unit: "%", target: 96, higherIsBetter: true, trend: 3, history: h(86, 88, 89, 91, 92, 94) },
    ],
  },
];

export const kpiMonths = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type UserRole = "Super Admin" | "Company Admin" | "Supervisor" | "Site Manager";

export type User = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  company: string;
  role: UserRole;
  site: string;
  department: string;
  status: "Active" | "Invited" | "Suspended";
  lastActive: string;
};

export const users: User[] = [];

export const activities = [
  { who: "Priya Raman", what: "closed NC-3055 after verification", when: "12 min ago", type: "nc" },
  { who: "Ana Ferreira", what: "uploaded evidence to NC-3079", when: "48 min ago", type: "evidence" },
  { who: "Marcus Bell", what: "started Lift Thorough Examination at Southbank Towers", when: "2 h ago", type: "audit" },
  { who: "Anonymous", what: "reported concern CN-882 — forklift reversing without banksman", when: "4 h ago", type: "concern" },
  { who: "Tom Okafor", what: "published SHEQ Service Form v4.2", when: "Yesterday", type: "template" },
  { who: "Erin Docherty", what: "completed Energy & Emissions Review (81%)", when: "Yesterday", type: "audit" },
];

export const notifications = [
  { title: "NC-3081 escalated to Critical", detail: "Riverside Plant · Fabrication", when: "8 min ago", unread: true },
  { title: "Audit AUD-1039 is overdue", detail: "Harbour Logistics · ISO 14001", when: "1 h ago", unread: true },
  { title: "3 site pack documents expire this week", detail: "Harbour Logistics", when: "3 h ago", unread: true },
  { title: "Concern CN-874 awaiting verification", detail: "Southbank Towers", when: "Yesterday", unread: false },
];

export const upcomingAudits = audits
  .filter((a) => a.status === "Scheduled" || a.status === "In Progress" || a.status === "Overdue")
  .slice(0, 5);

export const formFieldTypes = [
  { key: "text", label: "Text", group: "Basic" },
  { key: "textarea", label: "Textarea", group: "Basic" },
  { key: "number", label: "Number", group: "Basic" },
  { key: "email", label: "Email", group: "Basic" },
  { key: "phone", label: "Phone", group: "Basic" },
  { key: "date", label: "Date", group: "Basic" },
  { key: "time", label: "Time", group: "Basic" },
  { key: "dropdown", label: "Dropdown", group: "Choice" },
  { key: "checkbox", label: "Checkbox", group: "Choice" },
  { key: "radio", label: "Radio Button", group: "Choice" },
  { key: "file", label: "File Upload", group: "Media" },
  { key: "image", label: "Image Upload", group: "Media" },
  { key: "signature", label: "Signature", group: "Media" },
  { key: "location", label: "Location", group: "Capture" },
  { key: "qr", label: "QR Scanner", group: "Capture" },
  { key: "barcode", label: "Barcode", group: "Capture" },
  { key: "heading", label: "Section Heading", group: "Layout" },
  { key: "divider", label: "Divider", group: "Layout" },
  { key: "richtext", label: "Rich Text", group: "Layout" },
] as const;

export type FieldType = (typeof formFieldTypes)[number]["key"];
