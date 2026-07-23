/**
 * IndexedDB helpers for offline API GET cache, form drafts queue, and template forms.
 */

const DB_NAME = "sitemate-offline";
/** Bump when stores/indexes change — also used to repair incomplete prior upgrades. */
const DB_VERSION = 3;
const STORE_GET = "apiGetCache";
const STORE_QUEUE = "offlineQueue";
const STORE_DRAFTS = "formDrafts";
const STORE_TEMPLATES = "templateForms";
const STORE_ID_MAP = "idMap";

const REQUIRED_STORES = [
  STORE_GET,
  STORE_QUEUE,
  STORE_DRAFTS,
  STORE_TEMPLATES,
  STORE_ID_MAP,
];

const MAX_GET_ENTRIES = 200;
const MAX_GET_BODY_CHARS = 2_500_000;
const OFFLINE_SYNC_TAG = "sitemate-offline-flush";

function ensureOfflineSchema(db, oldVersion, upgradeTx) {
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
    store.createIndex("localResponseId", "localResponseId");
  } else if (oldVersion < 2 && upgradeTx) {
    const store = upgradeTx.objectStore(STORE_QUEUE);
    if (!store.indexNames.contains("localResponseId")) {
      store.createIndex("localResponseId", "localResponseId");
    }
  } else if (upgradeTx && db.objectStoreNames.contains(STORE_QUEUE)) {
    const store = upgradeTx.objectStore(STORE_QUEUE);
    if (!store.indexNames.contains("localResponseId")) {
      store.createIndex("localResponseId", "localResponseId");
    }
  }
  if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
    const store = db.createObjectStore(STORE_DRAFTS, { keyPath: "localId" });
    store.createIndex("serverId", "serverId");
    store.createIndex("updatedAt", "updatedAt");
  }
  if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
    db.createObjectStore(STORE_TEMPLATES, { keyPath: "title" });
  }
  if (!db.objectStoreNames.contains(STORE_ID_MAP)) {
    db.createObjectStore(STORE_ID_MAP, { keyPath: "localId" });
  }
}

function missingOfflineStores(db) {
  return REQUIRED_STORES.filter((name) => !db.objectStoreNames.contains(name));
}

function openOfflineDbAtVersion(version) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion || 0;
      ensureOfflineSchema(db, oldVersion, event.target.transaction);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    req.onblocked = () => {
      console.warn("[offline] IndexedDB open blocked — close other tabs using Site Mate");
    };
  });
}

/**
 * Open the offline DB, repairing schema if a prior deploy left stores missing
 * at the current version (which skips onupgradeneeded).
 */
export async function openOfflineDb() {
  let db = await openOfflineDbAtVersion(DB_VERSION);
  let missing = missingOfflineStores(db);
  if (missing.length === 0) return db;

  console.warn("[offline] repairing IndexedDB, missing stores:", missing.join(", "));
  const repairVersion = Math.max(db.version, DB_VERSION) + 1;
  db.close();
  db = await openOfflineDbAtVersion(repairVersion);
  missing = missingOfflineStores(db);
  if (missing.length > 0) {
    db.close();
    throw new Error(`IndexedDB still missing stores: ${missing.join(", ")}`);
  }
  return db;
}

function openDb() {
  return openOfflineDb();
}

export function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
  });
}

export function isBrowserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function isOfflineLocalId(id) {
  return /^offline-(res|form)-/i.test(String(id || ""));
}

export function createLocalResponseId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `offline-res-${crypto.randomUUID()}`;
  }
  return `offline-res-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createLocalFormId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `offline-form-${crypto.randomUUID()}`;
  }
  return `offline-form-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    tx.objectStore(STORE_GET).put({ key, payload, updatedAt: Date.now() });
    await txDone(tx);
    await trimGetCache(db);
    db.close();
  } catch {
    /* ignore */
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

export function shouldCacheGetUrl(url = "") {
  const path = String(url).split("?")[0];
  if (/\/auth\//.test(path)) return false;
  if (/\/documents\/[^/]+\/(view|download)/.test(path)) return false;
  return true;
}

export function isFormResponsesListUrl(url = "") {
  const path = String(url).split("?")[0];
  return path === "/forms/responses" || path.endsWith("/forms/responses");
}

export function isFormResponseDetailUrl(url = "") {
  return /\/forms\/responses\/[^/]+\/?$/.test(String(url).split("?")[0]);
}

export function parseFormResponseWrite(url = "", method = "post") {
  const path = String(url).split("?")[0];
  const m = String(method).toLowerCase();
  let match = path.match(/\/forms\/responses\/([^/]+)\/?$/);
  if (match && m === "put") {
    return { type: "update", responseId: match[1] };
  }
  match = path.match(/\/forms\/([^/]+)\/responses\/?$/);
  if (match && m === "post") {
    return { type: "create", formId: match[1] };
  }
  return null;
}

export function isFormTemplateCreateUrl(url = "", method = "post") {
  const path = String(url).split("?")[0];
  return String(method).toLowerCase() === "post" && /\/forms\/?$/.test(path);
}

export function shouldQueueWriteUrl(url = "", method = "post") {
  const m = String(method).toLowerCase();
  if (!["post", "put", "patch"].includes(m)) return false;
  const path = String(url).split("?")[0];
  return (
    parseFormResponseWrite(url, method) != null ||
    isFormTemplateCreateUrl(url, method) ||
    /\/documents\/upload\/?$/.test(path)
  );
}

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

// ─── Template form offline map (title → formId) ─────────────────────────────

export async function getOfflineTemplateFormId(title) {
  try {
    const db = await openDb();
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, "readonly");
      const req = tx.objectStore(STORE_TEMPLATES).get(String(title));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return row?.formId || null;
  } catch (err) {
    console.warn("[offline] template lookup failed", err?.message || err);
    return null;
  }
}

export async function putOfflineTemplateForm(title, formId, { pending = false } = {}) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_TEMPLATES, "readwrite");
    tx.objectStore(STORE_TEMPLATES).put({
      title: String(title),
      formId,
      pending,
      updatedAt: Date.now(),
    });
    await txDone(tx);
    db.close();
  } catch (err) {
    console.warn("[offline] template cache write failed", err?.message || err);
  }
}

/** Drop a stale title→formId mapping (e.g. after DB reset / form deleted). */
export async function clearOfflineTemplateForm(title) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_TEMPLATES, "readwrite");
    tx.objectStore(STORE_TEMPLATES).delete(String(title));
    await txDone(tx);
    db.close();
  } catch (err) {
    console.warn("[offline] template cache clear failed", err?.message || err);
  }
}

// ─── ID remap (local → server) ───────────────────────────────────────────────

export async function putIdRemap(localId, serverId, kind = "response") {
  const db = await openDb();
  const tx = db.transaction(STORE_ID_MAP, "readwrite");
  tx.objectStore(STORE_ID_MAP).put({ localId, serverId, kind, updatedAt: Date.now() });
  await txDone(tx);
  db.close();
}

export async function getIdRemap(localId) {
  const db = await openDb();
  const row = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ID_MAP, "readonly");
    const req = tx.objectStore(STORE_ID_MAP).get(String(localId));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return row?.serverId || null;
}

export async function loadAllIdRemaps() {
  const db = await openDb();
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ID_MAP, "readonly");
    const req = tx.objectStore(STORE_ID_MAP).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  const formMap = {};
  const responseMap = {};
  for (const row of rows) {
    if (row.kind === "form") formMap[row.localId] = row.serverId;
    else responseMap[row.localId] = row.serverId;
  }
  return { formMap, responseMap };
}

// ─── Offline write queue ───────────────────────────────────────────────────────

async function findQueueByLocalResponseId(localResponseId) {
  if (!localResponseId) return null;
  const db = await openDb();
  const row = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, "readonly");
    const req = tx.objectStore(STORE_QUEUE).index("localResponseId").get(localResponseId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return row;
}

async function findQueueByLocalFormId(localFormId) {
  if (!localFormId) return null;
  const items = await listOfflineQueue();
  return items.find((i) => i.localFormId === localFormId) || null;
}

export async function enqueueOfflineWrite(entry) {
  const db = await openDb();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  const record = {
    ...entry,
    createdAt: entry.createdAt || Date.now(),
    updatedAt: Date.now(),
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
  await registerBackgroundSync();
  return id;
}

/** Coalesce form saves: one queue row per offline draft. */
export async function upsertOfflineFormQueueItem(entry) {
  const existing = entry.localResponseId
    ? await findQueueByLocalResponseId(entry.localResponseId)
    : null;

  const db = await openDb();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  const store = tx.objectStore(STORE_QUEUE);

  if (existing) {
    const updated = {
      ...existing,
      ...entry,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
      status: "pending",
    };
    store.put(updated);
    await txDone(tx);
    db.close();
    notifyQueueChanged();
    await registerBackgroundSync();
    return existing.id;
  }

  const record = {
    ...entry,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "pending",
  };
  const id = await new Promise((resolve, reject) => {
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  notifyQueueChanged();
  await registerBackgroundSync();
  return id;
}

export async function upsertOfflineTemplateQueueItem(entry) {
  const existing = entry.localFormId
    ? await findQueueByLocalFormId(entry.localFormId)
    : null;
  if (existing) return existing.id;
  return enqueueOfflineWrite(entry);
}

export async function updateOfflineQueueItem(id, patch) {
  const db = await openDb();
  const existing = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, "readonly");
    const req = tx.objectStore(STORE_QUEUE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  if (!existing) {
    db.close();
    return;
  }
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  tx.objectStore(STORE_QUEUE).put({ ...existing, ...patch, updatedAt: Date.now() });
  await txDone(tx);
  db.close();
  notifyQueueChanged();
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

export function notifyQueueChanged() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export async function registerBackgroundSync() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ("sync" in reg) {
      await reg.sync.register(OFFLINE_SYNC_TAG);
    }
  } catch {
    /* Background Sync not supported or registration failed */
  }
}

export { OFFLINE_SYNC_TAG };

export function createOfflineAxiosError(message = "Saved offline — will sync when online") {
  const err = new Error(message);
  err.code = "OFFLINE_QUEUED";
  err.isOfflineQueued = true;
  return err;
}
