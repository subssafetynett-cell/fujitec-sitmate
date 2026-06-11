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

/** Default for JSON API calls (lists, saves, auth). */
const DEFAULT_TIMEOUT_MS = 15000;

/** Large file uploads (site pack documents → Cloudinary) need longer. */
export const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

/** SHEQ and other image-heavy form saves (large JSON bodies on slow networks). */
export const FORM_RESPONSE_SAVE_TIMEOUT_MS = UPLOAD_TIMEOUT_MS;

const api = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
});

const MAX_UPLOAD_MB = 50;

export function formatUploadError(error) {
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

function isFormResponseWriteUrl(url = "") {
  return /\/forms\/[^/]+\/responses(\/|$|\?)/.test(url) || /\/forms\/responses\/[^/]+/.test(url);
}

export function formatFormSaveError(error) {
  if (error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "")) {
    return "Save timed out. Large forms with photos can take a minute on slower connections — please wait and try again.";
  }
  return error?.response?.data?.message || error?.message || "Failed to save the form.";
}

api.interceptors.request.use(
  (config) => {
    const origin = getBackendOrigin().replace(/\/$/, "");
    config.baseURL = `${origin}/api`;
    const token = getStoredToken();
    const url = config.url || "";

    if (isFormResponseWriteUrl(url)) {
      config.timeout = Math.max(config.timeout || 0, FORM_RESPONSE_SAVE_TIMEOUT_MS);
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
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const url = error.config?.url || "";

    if (status === 401 && !isPublicAuthRequest(url)) {
      handleSessionExpired("unauthorized");
    }

    return Promise.reject(error);
  }
);

export default api;

// Site Management APIs
export const fetchSites = async (search = "") => {
  const response = await api.get(`/sites?search=${encodeURIComponent(search)}`);
  return response.data;
};

export const createSite = async (siteData) => {
  const response = await api.post("/sites", siteData);
  return response.data;
};

export const updateSite = async (id, siteData) => {
  const response = await api.put(`/sites/${id}`, siteData);
  return response.data;
};

export const deleteSite = async (id) => {
  const response = await api.delete(`/sites/${id}`);
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

export const fetchDocuments = async (siteId, category, subfolderId) => {
  const params = { siteId, category };
  if (subfolderId) params.subfolderId = subfolderId;
  const response = await api.get(`/documents`, { params });
  return response.data;
};

export const fetchDocumentCounts = async (siteId, subfolderId) => {
  const params = { siteId };
  if (subfolderId) params.subfolderId = subfolderId;
  const response = await api.get(`/documents/counts`, { params });
  return response.data;
};

export const fetchSiteSubfolders = async (siteId) => {
  const response = await api.get(`/sites/${siteId}/subfolders`);
  return response.data;
};

export const createSiteSubfolder = async (siteId, name) => {
  const response = await api.post(`/sites/${siteId}/subfolders`, { name });
  return response.data;
};

export const deleteSiteSubfolder = async (siteId, subfolderId) => {
  const response = await api.delete(`/sites/${siteId}/subfolders/${subfolderId}`);
  return response.data;
};

/** Large saved forms (SHEQ with images) can exceed the default JSON timeout. */
export const FORM_RESPONSE_LOAD_TIMEOUT_MS = 2 * 60 * 1000;

export const fetchFormResponseById = async (id, { timeout = FORM_RESPONSE_LOAD_TIMEOUT_MS } = {}) => {
  const response = await api.get(`/forms/responses/${id}`, { timeout });
  const payload = response?.data;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid response from server");
  }
  return payload;
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
export const fetchDocumentDownloadBlob = async (id) => {
  const response = await api.get(`/documents/${id}/download`, {
    responseType: "blob",
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return response;
};
