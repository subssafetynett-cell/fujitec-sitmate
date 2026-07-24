// src/api.js
import axios from "axios";
import { getBackendOrigin } from "../utils/backendOrigin.js";
import {
  getStoredToken,
  isTokenExpired,
  handleSessionExpired,
} from "../utils/authSession.js";
import { shouldSendActingClientHeader, getActingClient } from "../utils/actingClient.js";
import { resolveEffectiveRole } from "../utils/resolveEffectiveRole.js";
import {
  buildApiCacheKey,
  putApiGetCache,
  getApiGetCache,
  shouldCacheGetUrl,
  isFormResponsesListUrl,
  isFormResponseDetailUrl,
  isBrowserOffline,
} from "../utils/offlineStore.js";
import { queueOfflineWriteFromConfig } from "../utils/offlineFormWrite.js";
import {
  getOfflineDraftByAnyId,
  listOfflineDrafts,
  draftToDetailRow,
  draftToListRow,
  mergeDraftsIntoListPayload,
} from "../utils/offlineFormDrafts.js";

/** User/client lists on hosted tenants with large datasets. */
export const LIST_FETCH_TIMEOUT_MS = 60_000;

/** Default for JSON API calls (lists, saves, auth). */
const DEFAULT_TIMEOUT_MS = 15000;

/** Large file uploads (site pack documents → Cloudinary) need longer. */
export const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

/** SHEQ and other image-heavy form saves (large JSON bodies on slow networks). */
export const FORM_RESPONSE_SAVE_TIMEOUT_MS = UPLOAD_TIMEOUT_MS;

/** Large saved forms (SHEQ with images) can exceed the default JSON timeout. */
export const FORM_RESPONSE_LOAD_TIMEOUT_MS = 2 * 60 * 1000;

const api = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
});

const MAX_UPLOAD_MB = 50;

function isGatewayOrTransientFailure(status) {
  return status === 502 || status === 503 || status === 504;
}

function isNetworkFailure(error) {
  if (isBrowserOffline()) return true;
  const status = error?.response?.status;
  // Bad gateway / upstream down — allow offline queue + cache fallback.
  if (isGatewayOrTransientFailure(status)) return true;
  if (error?.response) return false;
  const code = error?.code || "";
  const msg = String(error?.message || "");
  return (
    code === "ERR_NETWORK" ||
    code === "ECONNABORTED" ||
    /network error|failed to fetch|load failed|offline/i.test(msg)
  );
}

export function formatUploadError(error) {
  if (error?.isOfflineQueued || error?.code === "OFFLINE_QUEUED") {
    return "Upload saved offline — it will sync when you're back online.";
  }
  if (error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "")) {
    return "Upload timed out. Large files can take a minute or more—please wait and try again, or use a smaller file.";
  }

  const status = error?.response?.status;
  const serverMsg = error?.response?.data?.message;
  if (serverMsg) return serverMsg;

  if (status === 413 || /file too large|limit file size|maximum.*size/i.test(error?.message || "")) {
    return `File is too large. The maximum upload size is ${MAX_UPLOAD_MB} MB. Please choose a smaller file.`;
  }

  return error?.message || "Upload failed. Please try again.";
}

function isPublicAuthRequest(url = "") {
  return /\/auth\/(login|signup|forgot-password|reset-password|verify-email|resend-verification)(\/|$|\?)/.test(url);
}

function formResponsePath(url = "") {
  return String(url).split("?")[0];
}

function isFormResponseWriteUrl(url = "") {
  const path = formResponsePath(url);
  return (
    /\/forms\/[^/]+\/responses\/?$/.test(path) ||
    /\/forms\/responses\/[^/]+\/?$/.test(path)
  );
}

function isFormResponseLoadUrl(url = "") {
  return /\/forms\/responses\/[^/]+\/?$/.test(formResponsePath(url));
}

export function formatFormSaveError(error) {
  if (error?.isOfflineQueued || error?.code === "OFFLINE_QUEUED") {
    return "Saved offline — will sync when you're back online.";
  }
  if (error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "")) {
    return "Save timed out. Large forms with photos can take a minute on slower connections — please wait and try again.";
  }
  return error?.response?.data?.message || error?.message || "Failed to save the form.";
}

function syntheticAxiosResponse(config, data, status = 200) {
  return {
    data,
    status,
    statusText: status === 200 ? "OK" : String(status),
    headers: {},
    config,
    request: null,
  };
}

api.interceptors.request.use(
  async (config) => {
    const origin = getBackendOrigin().replace(/\/$/, "");
    config.baseURL = `${origin}/api`;
    const token = getStoredToken();
    const url = config.url || "";
    const method = (config.method || "get").toLowerCase();

    if (isFormResponseWriteUrl(url)) {
      config.timeout = FORM_RESPONSE_SAVE_TIMEOUT_MS;
    } else if (isFormResponseLoadUrl(url) && method === "get") {
      config.timeout = Math.max(config.timeout || 0, FORM_RESPONSE_LOAD_TIMEOUT_MS);
    }

    if (token && !isPublicAuthRequest(url)) {
      if (isTokenExpired(token)) {
        handleSessionExpired("expired");
        return Promise.reject(new axios.CanceledError("Session expired"));
      }
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;

      try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (
          user &&
          resolveEffectiveRole(user) === "superadmin" &&
          shouldSendActingClientHeader(user)
        ) {
          const acting = getActingClient();
          if (acting?.id) {
            config.headers["X-Acting-Client-Id"] = acting.id;
          }
        }
      } catch {
        /* ignore */
      }
    }

    // Prefer local drafts only when offline, or when a pending (unsynced) draft exists.
    // Synced drafts must not shadow the full server payload (signatures/images).
    if (method === "get" && isFormResponseDetailUrl(url)) {
      const id = url.split("?")[0].split("/").pop();
      try {
        const draft = await getOfflineDraftByAnyId(id);
        if (draft) {
          const pending =
            draft.syncStatus === "pending" ||
            draft.syncStatus === "error" ||
            draft.syncStatus === "queued";
          if (isBrowserOffline() || pending) {
            const adapterResponse = syntheticAxiosResponse(config, {
              success: true,
              data: draftToDetailRow(draft),
            });
            config.adapter = async () => adapterResponse;
            return config;
          }
        }
      } catch {
        /* fall through to network */
      }
    }

    // When offline, serve GET from IndexedDB immediately (avoid long axios timeouts).
    if (method === "get" && isBrowserOffline() && shouldCacheGetUrl(url)) {
      const cacheKey = buildApiCacheKey({
        method: "get",
        url,
        params: config.params,
        token,
      });
      try {
        const cached = await getApiGetCache(cacheKey);
        if (cached != null) {
          let payload = cached;
          if (isFormResponsesListUrl(url)) {
            payload = await mergeDraftsIntoListPayload(cached, config.params);
          }
          const adapterResponse = syntheticAxiosResponse(config, payload);
          config.adapter = async () => adapterResponse;
          return config;
        }
        // Form list with no cache: return pending offline drafts only.
        if (isFormResponsesListUrl(url)) {
          const drafts = await listOfflineDrafts(config.params);
          const adapterResponse = syntheticAxiosResponse(config, {
            success: true,
            data: drafts.map(draftToListRow),
            offlineDraftsOnly: true,
          });
          config.adapter = async () => adapterResponse;
          return config;
        }
      } catch {
        /* fall through */
      }
      return Promise.reject(
        Object.assign(new Error("You're offline and this data hasn't been loaded yet. Open it once online to cache it."), {
          code: "ERR_OFFLINE_NO_CACHE",
          config,
          isAxiosError: true,
          toJSON: () => ({}),
        })
      );
    }

    // When offline, queue writes immediately (forms, uploads, template forms).
    if (!config.__offlineReplay && isBrowserOffline() && method !== "get" && method !== "head") {
      try {
        const payload = await queueOfflineWriteFromConfig(config);
        const adapterResponse = syntheticAxiosResponse(config, payload);
        config.adapter = async () => adapterResponse;
        return config;
      } catch (queueErr) {
        console.warn("[offline] failed to queue write before request", queueErr);
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  async (response) => {
    const method = (response.config?.method || "get").toLowerCase();
    const url = response.config?.url || "";
    if (method === "get" && shouldCacheGetUrl(url) && response.status >= 200 && response.status < 300) {
      const token = getStoredToken();
      const key = buildApiCacheKey({
        method: "get",
        url,
        params: response.config?.params,
        token,
      });
      putApiGetCache(key, response.data).catch(() => {});
    }
    if (method === "get" && isFormResponsesListUrl(url) && response.data) {
      response.data = await mergeDraftsIntoListPayload(response.data, response.config?.params);
    }
    return response;
  },
  async (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const config = error.config || {};
    const status = error.response?.status;
    const url = config.url || "";
    const method = (config.method || "get").toLowerCase();

    if (status === 401 && !isPublicAuthRequest(url)) {
      handleSessionExpired("unauthorized");
      return Promise.reject(error);
    }

    // Serve last successful GET from IndexedDB when the network fails.
    if (method === "get" && shouldCacheGetUrl(url) && isNetworkFailure(error)) {
      const token = getStoredToken();
      const key = buildApiCacheKey({
        method: "get",
        url,
        params: config.params,
        token,
      });
      const cached = await getApiGetCache(key);
      if (cached != null) {
        let payload = cached;
        if (isFormResponsesListUrl(url)) {
          payload = await mergeDraftsIntoListPayload(cached, config.params);
        }
        return syntheticAxiosResponse(config, payload);
      }
      if (isFormResponsesListUrl(url)) {
        const drafts = await listOfflineDrafts(config.params);
        return syntheticAxiosResponse(config, {
          success: true,
          data: drafts.map(draftToListRow),
          offlineDraftsOnly: true,
        });
      }
      if (isFormResponseDetailUrl(url)) {
        const id = url.split("?")[0].split("/").pop();
        const draft = await getOfflineDraftByAnyId(id);
        // Prefer pending drafts or any draft when truly offline — never shadow
        // the server with a stale synced draft that may omit later media.
        if (
          draft &&
          (isBrowserOffline() ||
            draft.syncStatus === "pending" ||
            draft.syncStatus === "error" ||
            draft.syncStatus === "queued")
        ) {
          return syntheticAxiosResponse(config, {
            success: true,
            data: draftToDetailRow(draft),
          });
        }
      }
    }

    // Queue writes on network failure (forms sync in background when online).
    if (!config.__offlineReplay && method !== "get" && method !== "head" && isNetworkFailure(error)) {
      try {
        const payload = await queueOfflineWriteFromConfig(config);
        return syntheticAxiosResponse(config, payload);
      } catch (queueErr) {
        console.warn("[offline] failed to queue write", queueErr);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Site Management APIs
export const fetchSites = async (
  search = "",
  { timeout = LIST_FETCH_TIMEOUT_MS, page, limit, activeOnly = false } = {}
) => {
  const params = {};
  if (search) params.search = search;
  if (page != null) params.page = page;
  if (limit != null) params.limit = limit;
  if (activeOnly) params.activeOnly = true;
  const response = await api.get("/sites", { params, timeout });
  return response.data;
};

/** Normalize list responses (paginated object or legacy array). */
export function normalizeSitesList(data) {
  if (Array.isArray(data)) {
    return { sites: data, total: data.length };
  }
  const sites = Array.isArray(data?.sites) ? data.sites : [];
  return {
    sites,
    total: Number(data?.total) || sites.length,
    page: data?.page,
    limit: data?.limit,
  };
}

export const createSite = async (siteData, { timeout = LIST_FETCH_TIMEOUT_MS } = {}) => {
  const response = await api.post("/sites", siteData, { timeout });
  return response.data;
};

export const updateSite = async (id, siteData, { timeout = LIST_FETCH_TIMEOUT_MS } = {}) => {
  const response = await api.put(`/sites/${id}`, siteData, { timeout });
  return response.data;
};

export const deleteSite = async (id, { timeout = LIST_FETCH_TIMEOUT_MS } = {}) => {
  const response = await api.delete(`/sites/${id}`, { timeout });
  return response.data;
};

export const fetchSiteManagers = async () => {
  const response = await api.get("/sites/managers");
  return response.data;
};

// Sitepack Document APIs
export const uploadDocument = async (formData, { onUploadProgress } = {}) => {
  const response = await api.post("/documents/upload", formData, {
    timeout: UPLOAD_TIMEOUT_MS,
    onUploadProgress,
    // Do not set Content-Type — axios adds multipart boundary automatically.
  });
  return response.data;
};

/** True when a write was accepted into the offline sync queue. */
export function isOfflineQueuedResponse(payload) {
  return Boolean(payload?.offlineQueued);
}

export const fetchDocuments = async (
  siteId,
  category,
  subfolderId,
  { timeout = LIST_FETCH_TIMEOUT_MS } = {}
) => {
  const params = { siteId, category };
  if (subfolderId) params.subfolderId = subfolderId;
  const response = await api.get(`/documents`, { params, timeout });
  return response.data;
};

export const fetchDocumentCounts = async (
  siteId,
  subfolderId,
  { timeout = LIST_FETCH_TIMEOUT_MS } = {}
) => {
  const params = { siteId };
  if (subfolderId) params.subfolderId = subfolderId;
  const response = await api.get(`/documents/counts`, { params, timeout });
  return response.data;
};

export const fetchSiteSubfolders = async (siteId, { monitoringSection, scope } = {}) => {
  const params = {};
  if (scope) params.scope = scope;
  if (monitoringSection) params.monitoringSection = monitoringSection;
  const response = await api.get(`/sites/${siteId}/subfolders`, { params });
  return response.data;
};

export const createSiteSubfolder = async (siteId, name, { monitoringSection } = {}) => {
  const body = { name };
  if (monitoringSection) body.monitoringSection = monitoringSection;
  const response = await api.post(`/sites/${siteId}/subfolders`, body);
  return response.data;
};

export const deleteSiteSubfolder = async (siteId, subfolderId) => {
  const response = await api.delete(`/sites/${siteId}/subfolders/${subfolderId}`);
  return response.data;
};

export const updateSiteSubfolder = async (siteId, subfolderId, name) => {
  const response = await api.patch(`/sites/${siteId}/subfolders/${subfolderId}`, { name });
  return response.data;
};

/** Pass to api.post/put for form response writes (belt-and-suspenders with the request interceptor). */
export function formResponseSaveConfig(extra = {}) {
  return { ...extra, timeout: FORM_RESPONSE_SAVE_TIMEOUT_MS };
}

export const fetchFormResponseById = async (id, { timeout = FORM_RESPONSE_LOAD_TIMEOUT_MS } = {}) => {
  const response = await api.get(`/forms/responses/${id}`, { timeout });
  const payload = response?.data;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid response from server");
  }
  return payload;
};

/** List endpoint without embedded photos (fast table / picker views). */
export const fetchFormResponsesList = async (params = {}, { timeout = 60_000 } = {}) => {
  const response = await api.get("/forms/responses", {
    params: { ...params, compact: true },
    timeout,
  });
  return response.data;
};

/** Fetch all pages when callers need a full in-memory list (e.g. client-side filters). */
export const fetchAllFormResponsesList = async (
  params = {},
  { pageSize = 100, maxPages = 50, timeout = 60_000 } = {}
) => {
  const all = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const res = await fetchFormResponsesList({ ...params, page, limit: pageSize }, { timeout });
    if (!res?.success) {
      return res;
    }
    all.push(...(res.data || []));
    if (res.pagination) {
      hasMore = Boolean(res.pagination.hasMore);
      page += 1;
    } else {
      hasMore = false;
    }
  }

  return { success: true, data: all };
};

/** Dashboard aggregates — allow extra time on large tenants. */
export const fetchDashboardStats = async ({ timeout = 90_000 } = {}) => {
  const response = await api.get("/dashboard/stats", { timeout });
  return response.data;
};

export const fetchSectionDashboardStats = async (section, { timeout = 60_000 } = {}) => {
  const response = await api.get(`/dashboard/section-stats/${section}`, { timeout });
  return response.data;
};

export const fetchUsersList = async (
  clientId,
  {
    timeout = LIST_FETCH_TIMEOUT_MS,
    page = 0,
    limit = 10,
    search = "",
    company = "",
    status = "all",
    role = "all",
  } = {}
) => {
  const url = clientId ? `/clients/${clientId}/users` : "/users";
  const response = await api.get(url, {
    timeout,
    params: {
      page,
      limit,
      ...(search ? { search } : {}),
      ...(company ? { company } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(role && role !== "all" ? { role } : {}),
    },
  });
  return response.data;
};

export const fetchClientsList = async ({ timeout = LIST_FETCH_TIMEOUT_MS } = {}) => {
  const response = await api.get("/clients", { timeout });
  return response.data;
};

export const deleteDocument = async (id) => {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
};

/** Fetch document bytes for inline preview (proxied through API for reliable PDF viewing). */
export const fetchDocumentPreviewBlob = async (id) => {
  const response = await api.get(`/documents/${id}/view`, {
    responseType: "blob",
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return response;
};

/** Fetch document bytes for download with correct filename from Content-Disposition. */
/** Resolve a user in the current company by email (form responsible-person fields). */
export const resolveUserByEmail = async (email) => {
  const response = await api.get("/users/resolve-by-email", {
    params: { email: String(email || "").trim() },
  });
  return response.data;
};

/** List active users in the current company for responsible-person dropdowns. */
export const fetchAssignableUsers = async () => {
  const response = await api.get("/users/assignable");
  return response.data;
};

export const fetchActionTrackerItems = async () => {
  const response = await api.get("/action-tracker/actions");
  return response.data;
};

export const fetchActionTrackerItemByResponse = async (formResponseId) => {
  const response = await api.get(
    `/action-tracker/actions/by-response/${formResponseId}`
  );
  return response.data;
};

export const fetchActionTrackerItem = async (id) => {
  const response = await api.get(`/action-tracker/actions/${id}`);
  return response.data;
};

export const updateActionTrackerItem = async (id, payload) => {
  // Payloads can carry base64 evidence images; allow the long save timeout.
  const response = await api.put(`/action-tracker/actions/${id}`, payload, {
    timeout: FORM_RESPONSE_SAVE_TIMEOUT_MS,
  });
  return response.data;
};

export const updateActionTrackerRegisterStatus = async (id, registerStatus) => {
  const response = await api.patch(`/action-tracker/actions/${id}/register-status`, {
    registerStatus,
  });
  return response.data;
};

export const sendActionTrackerItem = async (id, payload = {}) => {
  // Payloads can carry base64 evidence images; allow the long save timeout.
  const response = await api.post(`/action-tracker/actions/${id}/send`, payload, {
    timeout: FORM_RESPONSE_SAVE_TIMEOUT_MS,
  });
  return response.data;
};

export const reviewActionTrackerItem = async (
  id,
  decision,
  rejectionReason = ""
) => {
  const response = await api.post(`/action-tracker/actions/${id}/review`, {
    decision,
    rejectionReason,
  });
  return response.data;
};

export const createNonconformance = async (payload) => {
  const response = await api.post("/nc", payload);
  return response.data;
};

export const fetchNonconformances = async (params = {}) => {
  const response = await api.get("/nc", { params });
  return response.data;
};

export const fetchNonconformance = async (id) => {
  const response = await api.get(`/nc/${id}`);
  return response.data;
};

export const saveNonconformanceResponse = async (id, payload) => {
  const response = await api.patch(`/nc/${id}/response`, payload, {
    timeout: FORM_RESPONSE_SAVE_TIMEOUT_MS,
  });
  return response.data;
};

export const uploadNonconformanceAttachments = async (id, responseId, files) => {
  const formData = new FormData();
  formData.append("responseId", responseId);
  files.forEach((file) => formData.append("files", file));
  const response = await api.post(`/nc/${id}/attachments`, formData, {
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return response.data;
};

export const acceptNonconformance = async (id) => {
  const response = await api.post(`/nc/${id}/accept`);
  return response.data;
};

export const rejectNonconformance = async (id, reason) => {
  const response = await api.post(`/nc/${id}/reject`, { reason });
  return response.data;
};

export const reopenNonconformance = async (id, reason) => {
  const response = await api.post(`/nc/${id}/reopen`, { reason });
  return response.data;
};

export const fetchNcAssignableUsers = async (id) => {
  const response = await api.get(`/nc/${id}/assignable-users`);
  return response.data;
};

export const reassignNonconformance = async (id, assigneeId, reason) => {
  const response = await api.patch(`/nc/${id}/reassign`, { assigneeId, reason });
  return response.data;
};

export const forceNonconformanceStatus = async (id, status, reason) => {
  const response = await api.patch(`/nc/${id}/force-status`, { status, reason });
  return response.data;
};

export const fetchNonconformanceHistory = async (id) => {
  const response = await api.get(`/nc/${id}/history`);
  return response.data;
};

export const fetchNotifications = async (limit = 20) => {
  const response = await api.get("/notifications", { params: { limit } });
  return response.data;
};

export const fetchUnreadNotificationCount = async () => {
  const response = await api.get("/notifications/unread-count");
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await api.patch("/notifications/read-all");
  return response.data;
};

export const fetchDocumentDownloadBlob = async (id) => {
  const response = await api.get(`/documents/${id}/download`, {
    responseType: "blob",
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return response;
};
