/**
 * Flush IndexedDB offline write queue when the device is online.
 */
import api from "../services/api";
import {
  listOfflineQueue,
  removeOfflineQueueItem,
  deserializeRequestBody,
  countOfflineQueue,
  subscribeOfflineQueue,
} from "./offlineStore";

let flushing = false;
let started = false;

export async function flushOfflineQueue() {
  if (flushing) return { flushed: 0, remaining: await countOfflineQueue() };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { flushed: 0, remaining: await countOfflineQueue() };
  }

  flushing = true;
  let flushed = 0;
  try {
    const items = await listOfflineQueue();
    for (const item of items) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) break;
      try {
        const data = deserializeRequestBody(item.body);
        const headers = { ...(item.headers || {}) };
        // Let axios set multipart boundary for FormData
        if (data instanceof FormData && headers["Content-Type"]) {
          delete headers["Content-Type"];
        }
        await api.request({
          method: item.method || "post",
          url: item.url,
          data,
          headers,
          params: item.params,
          timeout: item.timeout,
          // Prevent re-queueing this replay
          __offlineReplay: true,
        });
        await removeOfflineQueueItem(item.id);
        flushed += 1;
      } catch (err) {
        // Stop on auth errors so we don't burn the queue
        const status = err?.response?.status;
        if (status === 401 || status === 403) break;
        // Leave item queued; retry on next flush
        console.warn("[offline] sync failed for queue item", item.id, err?.message || err);
        break;
      }
    }
  } finally {
    flushing = false;
  }

  return { flushed, remaining: await countOfflineQueue() };
}

/** Call once from app bootstrap. */
export function startOfflineSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  const tryFlush = () => {
    flushOfflineQueue().catch(() => {});
  };

  window.addEventListener("online", tryFlush);
  // Periodic retry while the tab is open
  window.setInterval(tryFlush, 60_000);
  // First attempt shortly after load
  window.setTimeout(tryFlush, 2_000);

  subscribeOfflineQueue(() => {
    if (navigator.onLine) tryFlush();
  });
}
