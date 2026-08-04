/**
 * Shared SHEQ domain types used by the frontend.
 * Runtime data is fetched from the backend API.
 */

export type Status = string;

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

export type SitePackCategoryId =
  | "friday-pack-forms"
  | "rams"
  | "drawings"
  | "installation-manuals"
  | "training-certificates"
  | "equipment-certificates"
  | "general-uploads";

export type SitePackDocument = {
  id: string;
  siteId: string;
  category: SitePackCategoryId;
  folderId?: string | null;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  source?: "upload" | "filled-form";
  templateId?: string;
  templateName?: string;
  kind?: string;
  formData?: Record<string, string>;
  documentNo?: string;
  code?: string;
  approvedBy?: string;
  fileUrl?: string;
  cloudinaryPublicId?: string;
  cloudinaryResourceType?: string;
};

export type SitePackFolder = {
  id: string;
  siteId: string;
  category: SitePackCategoryId;
  name: string;
  createdAt: string;
};

export type SitePackCategorySummary = {
  id: SitePackCategoryId;
  label: string;
  count: number;
  folderCount?: number;
};

export type SitePackSummary = {
  siteId: string;
  categories: SitePackCategorySummary[];
  folders: SitePackFolder[];
  documents: SitePackDocument[];
  total: number;
};

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
  category:
    | "ISO 9001"
    | "ISO 14001"
    | "ISO 45001"
    | "Lift Regulations"
    | "Environmental"
    | "Quality"
    | "Health & Safety"
    | "Concern"
    | "SHEQ Forms"
    | "Custom";
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

export type NcStatus =
  | "Pending Admin Approval"
  | "Rejected"
  | "Assigned"
  | "Draft"
  | "In Progress"
  | "Pending Admin Review"
  | "Reopened"
  | "Closed"
  // legacy seed stages (still accepted in UI)
  | "Open"
  | "Investigating"
  | "Corrective Action"
  | "Verification";

export type NcEvidence = {
  name: string;
  url: string;
  mimeType?: string;
};

export type NcTimelineEntry = {
  id: string;
  action: string;
  userId: string;
  userName: string;
  role: string;
  comments?: string;
  createdAt: string;
};

export type NcResponse = {
  correction: string;
  rootCause: string;
  correctiveAction: string;
  evidence: NcEvidence[];
  updatedAt: string;
};

export type NonConformance = {
  id: string;
  title: string;
  description?: string;
  company?: string;
  site: string;
  department: string;
  auditRef?: string;
  priority?: "Low" | "Medium" | "High" | "Critical";
  status?: NcStatus;
  stage: NcStatus;
  reporterId?: string;
  reporterName?: string;
  responsiblePersonId?: string;
  responsiblePersonName?: string;
  dueDate?: string;
  owner: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  raised: string;
  due?: string;
  source: string;
  rejectionReason?: string;
  adminReviewComments?: string;
  evidence?: NcEvidence[];
  formData?: Record<string, string>;
  templateId?: string;
  templateName?: string;
  kind?: TemplateKind;
  response?: NcResponse;
  timeline?: NcTimelineEntry[];
  closedAt?: string;
  createdAt?: string;
  createdBy?: string;
};

export type Concern = {
  id: string;
  title: string;
  category:
    | "Occupational Health & Safety"
    | "Environmental"
    | "Quality"
    | "Good Practice"
    | "Near Miss"
    | "Unsafe Act"
    | "Unsafe Condition"
    | "Improvement Suggestion";
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

export type FormFieldType = {
  key: string;
  label: string;
  group: string;
};

export type FieldType = string;

export type Company = {
  name: string;
  industry: string;
  country: string;
  plan: string;
  users: number;
};

export type CompanyOption = {
  id: string;
  name: string;
  industry: string;
  country: string;
  logo: string;
  status: "Active" | "Inactive";
  createdAt: string;
};

export type Overview = {
  companies: number;
  users: number;
  activeUsers: number;
  sites: number;
  audits: number;
  scheduledAudits: number;
  completedAudits: number;
  openNonConformances: number;
  closedNonConformances: number;
  openConcerns: number;
  closedConcerns: number;
  templates: number;
  performanceScore: number;
  compliance: number;
};

export type Activity = {
  who: string;
  what: string;
  when: string;
  type: string;
};

export type Notification = {
  id?: string;
  title: string;
  detail: string;
  when: string;
  unread: boolean;
  type?: string;
  referenceType?: string;
  referenceId?: string;
};

export type MonthlyAudit = {
  month: string;
  scheduled: number;
  completed: number;
};

export type DisciplineTrend = {
  month: string;
  safety: number;
  environment: number;
  quality: number;
};

export type NcTrend = {
  month: string;
  raised: number;
  closed: number;
  concerns: number;
};

export type SitePerformance = {
  name: string;
  score: number;
};

export type NcByDepartment = {
  name: string;
  open: number;
  closed: number;
};

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

export type SheqPayload = {
  company: Company;
  companies: CompanyOption[];
  overview: Overview;
  monthlyAudits: MonthlyAudit[];
  disciplineTrend: DisciplineTrend[];
  ncTrend: NcTrend[];
  sites: Site[];
  sitePerformance: SitePerformance[];
  audits: Audit[];
  templates: Template[];
  nonConformances: NonConformance[];
  ncStages: readonly string[];
  ncWorkflow: string[];
  ncByDepartment: NcByDepartment[];
  concerns: Concern[];
  concernWorkflow: string[];
  sheqForms: SheqFormRecord[];
  kpiGroups: KpiGroup[];
  kpiMonths: string[];
  activities: Activity[];
  notifications: Notification[];
  upcomingAudits: Audit[];
  formFieldTypes: FormFieldType[];
  users: User[];
};
