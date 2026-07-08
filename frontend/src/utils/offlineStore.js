/**
 * IndexedDB helpers for offline API GET cache and pending write queue.
 */

const DB_NAME = "sitemate-offline";
const DB_VERSION = 1;
const STORE_GET = "apiGetCache";
const STORE_QUEUE = "offlineQueue";

const MAX_GET_ENTRIES = 200;
const MAX_GET_BODY_CHARS = 2_500_000; // skip caching huge payloads (embedded images)

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_GET)) {
        const store = db.createObjectStore(STORE_GET, { keyPath: "key" });
        store.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const store = db.createObjectStore(STORE_QUEUE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
  });
}

export function isBrowserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function stableParams(params) {
  if (!params || typeof params !== "object") return "";
  try {
    const entries = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, String(v)])
      .sort(([a], [b]) => a.localeCompare(b));
    return new URLSearchParams(entries).toString();
  } catch {
    return "";
  }
}

/** Cache key scoped by auth token fragment so users don't share offline data. */
export function buildApiCacheKey({ method = "get", url = "", params, token }) {
  const path = String(url).split("?")[0];
  const query = stableParams(params) || (String(url).includes("?") ? String(url).split("?")[1] : "");
  const tokenHint = token ? String(token).slice(-24) : "anon";
  return `${method.toLowerCase()}|${path}|${query}|${tokenHint}`;
}

export async function putApiGetCache(key, payload) {
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_GET_BODY_CHARS) return;
    const db = await openDb();
    const tx = db.transaction(STORE_GET, "readwrite");
    const store = tx.objectStore(STORE_GET);
    store.put({ key, payload, updatedAt: Date.now() });
    await txDone(tx);
    await trimGetCache(db);
    db.close();
  } catch {
    /* ignore quota / private mode */
  }
}

export async function getApiGetCache(key) {
  try {
    const db = await openDb();
    const entry = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_GET, "readonly");
      const req = tx.objectStore(STORE_GET).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return entry?.payload ?? null;
  } catch {
    return null;
  }
}

async function trimGetCache(db) {
  const tx = db.transaction(STORE_GET, "readwrite");
  const store = tx.objectStore(STORE_GET);
  const index = store.index("updatedAt");
  const all = await new Promise((resolve, reject) => {
    const req = index.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  if (all.length <= MAX_GET_ENTRIES) {
    await txDone(tx);
    return;
  }
  all
    .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
    .slice(0, all.length - MAX_GET_ENTRIES)
    .forEach((row) => store.delete(row.key));
  await txDone(tx);
}

/** Paths that must never be served from offline cache (auth / sensitive mutations only via network). */
export function shouldCacheGetUrl(url = "") {
  const path = String(url).split("?")[0];
  if (/\/auth\//.test(path)) return false;
  if (/\/documents\/[^/]+\/(view|download)/.test(path)) return false;
  return true;
}

export function shouldQueueWriteUrl(url = "", method = "post") {
  const m = String(method).toLowerCase();
  if (!["post", "put", "patch"].includes(m)) return false;
  const path = String(url).split("?")[0];
  return (
    /\/forms\/[^/]+\/responses\/?$/.test(path) ||
    /\/forms\/responses\/[^/]+\/?$/.test(path) ||
    /\/documents\/upload\/?$/.test(path)
  );
}

/**
 * Serialize axios config body for IndexedDB (JSON or FormData → files as ArrayBuffer).
 */
export async function serializeRequestBody(data) {
  if (data == null) return { kind: "empty" };
  if (typeof FormData !== "undefined" && data instanceof FormData) {
    const parts = [];
    for (const [name, value] of data.entries()) {
      if (typeof File !== "undefined" && value instanceof File) {
        const buffer = await value.arrayBuffer();
        parts.push({
          name,
          kind: "file",
          fileName: value.name,
          fileType: value.type,
          lastModified: value.lastModified,
          buffer,
        });
      } else {
        parts.push({ name, kind: "text", value: String(value) });
      }
    }
    return { kind: "formData", parts };
  }
  if (typeof data === "string") return { kind: "text", value: data };
  try {
    return { kind: "json", value: JSON.parse(JSON.stringify(data)) };
  } catch {
    return { kind: "json", value: null };
  }
}

export function deserializeRequestBody(serialized) {
  if (!serialized || serialized.kind === "empty") return undefined;
  if (serialized.kind === "text") return serialized.value;
  if (serialized.kind === "json") return serialized.value;
  if (serialized.kind === "formData") {
    const fd = new FormData();
    for (const part of serialized.parts || []) {
      if (part.kind === "file") {
        const blob = new Blob([part.buffer], { type: part.fileType || "application/octet-stream" });
        const file = new File([blob], part.fileName || "file", {
          type: part.fileType || "application/octet-stream",
          lastModified: part.lastModified || Date.now(),
        });
        fd.append(part.name, file);
      } else {
        fd.append(part.name, part.value);
      }
    }
    return fd;
  }
  return undefined;
}

export async function enqueueOfflineWrite(entry) {
  const db = await openDb();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  const record = {
    ...entry,
    createdAt: Date.now(),
    status: "pending",
  };
  const id = await new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_QUEUE).add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  notifyQueueChanged();
  return id;
}

export async function listOfflineQueue() {
  try {
    const db = await openDb();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, "readonly");
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } catch {
    return [];
  }
}

export async function removeOfflineQueueItem(id) {
  const db = await openDb();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  tx.objectStore(STORE_QUEUE).delete(id);
  await txDone(tx);
  db.close();
  notifyQueueChanged();
}

export async function countOfflineQueue() {
  const rows = await listOfflineQueue();
  return rows.length;
}

const listeners = new Set();

export function subscribeOfflineQueue(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyQueueChanged() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function createOfflineAxiosError(message = "Saved offline — will sync when online") {
  const err = new Error(message);
  err.code = "OFFLINE_QUEUED";
  err.isOfflineQueued = true;
  return err;
}
