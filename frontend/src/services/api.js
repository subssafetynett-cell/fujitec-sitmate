// src/api.js
import axios from "axios";
import { getBackendOrigin } from "../utils/backendOrigin.js";
import {
  getStoredToken,
  isTokenExpired,
  handleSessionExpired,
} from "../utils/authSession.js";

/** Default for JSON API calls (lists, saves, auth). */
const DEFAULT_TIMEOUT_MS = 15000;

/** Large file uploads (site pack documents → Cloudinary) need longer. */
export const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

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
  return /\/auth\/(login|signup|forgot-password|reset-password)(\/|$|\?)/.test(url);
}

api.interceptors.request.use(
  (config) => {
    const origin = getBackendOrigin().replace(/\/$/, "");
    config.baseURL = `${origin}/api`;
    const token = getStoredToken();
    const url = config.url || "";

    if (token && !isPublicAuthRequest(url)) {
      if (isTokenExpired(token)) {
        handleSessionExpired("expired");
        return Promise.reject(new axios.CanceledError("Session expired"));
      }
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
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

export const fetchDocuments = async (siteId, category) => {
  const response = await api.get(`/documents`, {
    params: { siteId, category }
  });
  return response.data;
};

export const fetchDocumentCounts = async (siteId) => {
  const response = await api.get(`/documents/counts`, {
    params: { siteId }
  });
  return response.data;
};

export const deleteDocument = async (id) => {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
};

/** Fetch document bytes for inline preview (local /uploads/ files and API redirects). */
export const fetchDocumentPreviewBlob = async (id) => {
  const response = await api.get(`/documents/${id}/view`, {
    responseType: "blob",
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return response.data;
};

/** Fetch document bytes for download with correct filename from Content-Disposition. */
export const fetchDocumentDownloadBlob = async (id) => {
  const response = await api.get(`/documents/${id}/download`, {
    responseType: "blob",
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return response;
};
