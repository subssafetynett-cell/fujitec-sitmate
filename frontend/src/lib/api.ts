import type {
  CompanyOption,
  Concern,
  NcEvidence,
  NonConformance,
  Notification,
  SheqFormRecord,
  SheqPayload,
  Site,
  SitePackCategoryId,
  SitePackDocument,
  SitePackFolder,
  SitePackSummary,
  Template,
  User,
  UserRole,
} from "@/data/sheq";
import { getAuthToken } from "@/lib/auth";

const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined)?.replace(/\/$/, "") || "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed: ${response.statusText}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function fetchSheqData() {
  return request<SheqPayload>("/api/sheq");
}

export type AuthResponse = {
  token: string;
  user: User;
  expiresAt: string;
};

export function login(input: { email: string; password: string }) {
  return request<AuthResponse>("/api/sheq/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signup(input: {
  name: string;
  email: string;
  mobile?: string;
  company: string;
  password: string;
}) {
  return request<AuthResponse>("/api/sheq/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchAuthMe() {
  return request<{ user: User }>("/api/sheq/auth/me");
}

export function logout() {
  return request<void>("/api/sheq/auth/logout", { method: "POST" });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  return request<{ ok: boolean }>("/api/sheq/auth/password", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function fetchCompanies() {
  return request<CompanyOption[]>("/api/sheq/companies");
}

export function inviteUser(input: {
  name: string;
  email: string;
  mobile: string;
  company: string;
  password: string;
  role: UserRole;
}) {
  return request<User>("/api/sheq/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateUser(
  id: string,
  input: {
    name: string;
    email: string;
    mobile: string;
    company: string;
    password?: string;
    role: UserRole;
    status?: User["status"];
  },
) {
  return request<User>(`/api/sheq/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteUser(id: string) {
  return request<void>(`/api/sheq/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function createCompany(input: {
  name: string;
  industry: string;
  country: string;
  logo?: string;
  status?: CompanyOption["status"];
}) {
  return request<CompanyOption>("/api/sheq/companies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCompany(
  id: string,
  input: {
    name: string;
    industry: string;
    country: string;
    logo?: string;
    status?: CompanyOption["status"];
  },
) {
  return request<CompanyOption>(`/api/sheq/companies/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function setCompanyStatus(id: string, status: CompanyOption["status"]) {
  return request<CompanyOption>(
    `/api/sheq/companies/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export function deleteCompany(id: string) {
  return request<void>(`/api/sheq/companies/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function createSite(input: {
  name: string;
  address: string;
  status: Site["status"];
  managers: string[];
}) {
  return request<Site>("/api/sheq/sites", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSite(
  id: string,
  input: {
    name: string;
    address: string;
    status: Site["status"];
    managers: string[];
  },
) {
  return request<Site>(`/api/sheq/sites/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function setSiteStatus(id: string, status: Site["status"]) {
  return request<Site>(`/api/sheq/sites/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteSite(id: string) {
  return request<void>(`/api/sheq/sites/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function fetchSitePack(siteId: string) {
  return request<SitePackSummary>(`/api/sheq/sites/${siteId}/pack`);
}

export function uploadSitePackDocument(input: {
  siteId: string;
  category: SitePackCategoryId;
  name: string;
  mimeType?: string;
  dataUrl: string;
  folderId?: string | null;
}) {
  return request<SitePackDocument>(`/api/sheq/sites/${input.siteId}/pack`, {
    method: "POST",
    body: JSON.stringify({
      category: input.category,
      name: input.name,
      mimeType: input.mimeType,
      dataUrl: input.dataUrl,
      folderId: input.folderId,
    }),
  });
}

export function createSitePackFolder(input: {
  siteId: string;
  name: string;
  category?: SitePackCategoryId;
}) {
  return request<SitePackFolder>(`/api/sheq/sites/${input.siteId}/pack/folders`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      category: input.category ?? "friday-pack-forms",
    }),
  });
}

export function deleteSitePackFolder(siteId: string, folderId: string) {
  return request<void>(`/api/sheq/sites/${siteId}/pack/folders/${folderId}`, {
    method: "DELETE",
  });
}

export function saveFilledSitePackForm(input: {
  siteId: string;
  folderId: string;
  templateId: string;
  templateName: string;
  kind?: string;
  title: string;
  formData?: Record<string, string>;
  documentNo?: string;
  code?: string;
  approvedBy?: string;
}) {
  return request<SitePackDocument>(`/api/sheq/sites/${input.siteId}/pack/forms`, {
    method: "POST",
    body: JSON.stringify({
      folderId: input.folderId,
      templateId: input.templateId,
      templateName: input.templateName,
      kind: input.kind,
      title: input.title,
      formData: input.formData,
      documentNo: input.documentNo,
      code: input.code,
      approvedBy: input.approvedBy,
    }),
  });
}

export function updateFilledSitePackForm(
  siteId: string,
  docId: string,
  input: { title: string; formData?: Record<string, string> },
) {
  return request<SitePackDocument>(`/api/sheq/sites/${siteId}/pack/forms/${docId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function fetchFilledSitePackForm(siteId: string, docId: string) {
  return request<SitePackDocument>(`/api/sheq/sites/${siteId}/pack/forms/${docId}`);
}

export function deleteSitePackDocument(siteId: string, docId: string) {
  return request<void>(`/api/sheq/sites/${siteId}/pack/${docId}`, {
    method: "DELETE",
  });
}

export function sitePackDownloadUrl(siteId: string, docId: string) {
  return `${API_URL}/api/sheq/sites/${siteId}/pack/${docId}/download`;
}

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  bytes: number;
  format: string;
  resourceType: string;
  width?: number;
  height?: number;
};

export function fetchUploadStatus() {
  return request<{ configured: boolean; provider: "cloudinary" | "local" }>(
    "/api/sheq/uploads/status",
  );
}

export function uploadAsset(input: {
  dataUrl: string;
  folder?: string;
  filename?: string;
  resourceType?: "image" | "raw" | "auto" | "video";
}) {
  return request<CloudinaryUploadResult>("/api/sheq/uploads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createToolboxTalkTemplate(input: {
  name?: string;
  logoLeft?: string;
  logoRight?: string;
  documentNo?: string;
  approvedBy?: string;
  status?: Template["status"];
}) {
  return request<Template>("/api/sheq/templates/toolbox-talk", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createConcern(input: {
  templateId: string;
  title?: string;
  formData?: Record<string, string>;
  anonymous?: boolean;
  reporter?: string;
}) {
  return request<Concern>("/api/sheq/concerns", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateConcern(
  id: string,
  input: {
    templateId?: string;
    title?: string;
    formData?: Record<string, string>;
    anonymous?: boolean;
    reporter?: string;
  },
) {
  return request<Concern>(`/api/sheq/concerns/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteConcern(id: string) {
  return request<void>(`/api/sheq/concerns/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function concernDownloadUrl(id: string) {
  return `${API_URL}/api/sheq/concerns/${encodeURIComponent(id)}/download`;
}

export function createSheqForm(input: {
  templateId: string;
  title?: string;
  formData?: Record<string, string>;
  status?: SheqFormRecord["status"];
}) {
  return request<SheqFormRecord>("/api/sheq/sheq-forms", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSheqForm(
  id: string,
  input: {
    templateId?: string;
    title?: string;
    formData?: Record<string, string>;
    status?: SheqFormRecord["status"];
  },
) {
  return request<SheqFormRecord>(`/api/sheq/sheq-forms/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteSheqForm(id: string) {
  return request<void>(`/api/sheq/sheq-forms/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function sheqFormDownloadUrl(id: string) {
  return `${API_URL}/api/sheq/sheq-forms/${encodeURIComponent(id)}/download`;
}

export function fetchNonConformances() {
  return request<{
    items: NonConformance[];
    stages: string[];
    workflow: string[];
    byDepartment: { department: string; open: number; closed: number }[];
    dashboard: unknown;
  }>("/api/sheq/non-conformances");
}

export function fetchNonConformance(id: string) {
  return request<NonConformance>(`/api/sheq/non-conformances/${encodeURIComponent(id)}`);
}

export function createNonConformance(input: {
  templateId: string;
  title?: string;
  formData?: Record<string, string>;
  responsiblePersonId: string;
  dueDate?: string;
  priority?: string;
  auditRef?: string;
  description?: string;
  evidence?: NcEvidence[];
}) {
  return request<NonConformance>("/api/sheq/non-conformances", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateNonConformance(
  id: string,
  input: {
    title?: string;
    formData?: Record<string, string>;
    responsiblePersonId?: string;
    dueDate?: string;
    priority?: string;
    description?: string;
    evidence?: NcEvidence[];
  },
) {
  return request<NonConformance>(`/api/sheq/non-conformances/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function approveNonConformance(id: string, comments?: string) {
  return request<NonConformance>(
    `/api/sheq/non-conformances/${encodeURIComponent(id)}/approve`,
    { method: "POST", body: JSON.stringify({ comments }) },
  );
}

export function rejectNonConformance(id: string, reason: string) {
  return request<NonConformance>(
    `/api/sheq/non-conformances/${encodeURIComponent(id)}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export function saveNcResponse(
  id: string,
  input: {
    correction: string;
    rootCause: string;
    correctiveAction: string;
    evidence?: NcEvidence[];
    submit: boolean;
  },
) {
  return request<NonConformance>(
    `/api/sheq/non-conformances/${encodeURIComponent(id)}/response`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function approveNcResponse(id: string, comments?: string) {
  return request<NonConformance>(
    `/api/sheq/non-conformances/${encodeURIComponent(id)}/review-approve`,
    { method: "POST", body: JSON.stringify({ comments }) },
  );
}

export function rejectNcResponse(id: string, comments: string) {
  return request<NonConformance>(
    `/api/sheq/non-conformances/${encodeURIComponent(id)}/review-reject`,
    { method: "POST", body: JSON.stringify({ comments }) },
  );
}

export function fetchNotifications() {
  return request<{ items: Array<Notification & { message?: string; isRead?: boolean; createdAt?: string }>; unread: number }>(
    "/api/sheq/notifications",
  );
}

export function markNotificationRead(id: string) {
  return request(`/api/sheq/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead() {
  return request<{ updated: number }>("/api/sheq/notifications/read-all", {
    method: "POST",
  });
}

export function fetchHealth() {
  return request<{ status: string; service: string; timestamp: string }>("/api/health");
}

export type KpiStatMonthValues = Record<
  "Jan" | "Feb" | "Mar" | "Apr" | "May" | "Jun" | "Jul" | "Aug" | "Sep" | "Oct" | "Nov" | "Dec",
  string
>;

export type KpiStatRow = {
  id: string;
  indicator: string;
  months: KpiStatMonthValues;
  target: string;
  unit: string;
  higherIsBetter: boolean;
};

export type KpiStatYearData = {
  discipline: string;
  year: number;
  rows: KpiStatRow[];
  updatedAt: string;
};

/** @deprecated Use KpiStatRow */
export type OhsRow = KpiStatRow;
/** @deprecated Use KpiStatYearData */
export type OhsYearData = KpiStatYearData;
/** @deprecated Use KpiStatMonthValues */
export type OhsMonthValues = KpiStatMonthValues;

export function fetchKpiStatYears(discipline: string) {
  return request<{ years: number[] }>(`/api/sheq/kpi-stats/${discipline}/years`);
}

export function fetchKpiStatYear(discipline: string, year: number) {
  return request<KpiStatYearData>(`/api/sheq/kpi-stats/${discipline}?year=${year}`);
}

export function saveKpiStatYear(discipline: string, year: number, rows: KpiStatRow[]) {
  return request<KpiStatYearData>(`/api/sheq/kpi-stats/${discipline}`, {
    method: "PUT",
    body: JSON.stringify({ year, rows }),
  });
}

export function fetchOhsYears() {
  return fetchKpiStatYears("health-safety");
}

export function fetchOhsYear(year: number) {
  return fetchKpiStatYear("health-safety", year);
}

export function saveOhsYear(year: number, rows: KpiStatRow[]) {
  return saveKpiStatYear("health-safety", year, rows);
}
