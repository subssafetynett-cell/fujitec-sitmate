/** JWT session helpers — server expiry is authoritative; client mirrors `exp` for proactive logout. */

const EXPIRY_SKEW_MS = 30_000; // treat as expired 30s before exp to avoid race with API

let expiryTimerId = null;
let onSessionExpiredCallback = null;
let sessionExpiryInProgress = false;

export function getStoredToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || null;
}

export function setStoredToken(token, { remember = true } = {}) {
  if (!token) return;
  if (remember) {
    localStorage.setItem("token", token);
    sessionStorage.removeItem("token");
  } else {
    sessionStorage.setItem("token", token);
    localStorage.removeItem("token");
  }
}

export function clearAuthStorage() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("actingClient");
  sessionStorage.removeItem("token");
}

export function parseJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function getTokenExpiryMs(token) {
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return null;
  return payload.exp * 1000;
}

export function isTokenExpired(token, skewMs = EXPIRY_SKEW_MS) {
  if (!token) return true;
  const expMs = getTokenExpiryMs(token);
  if (!expMs) return true;
  return Date.now() >= expMs - skewMs;
}

export function registerSessionExpiredHandler(handler) {
  onSessionExpiredCallback = handler;
}

export function handleSessionExpired(reason = "expired") {
  if (sessionExpiryInProgress) return;
  sessionExpiryInProgress = true;

  clearExpiryTimer();
  clearAuthStorage();

  try {
    if (typeof onSessionExpiredCallback === "function") {
      onSessionExpiredCallback(reason);
    }
  } finally {
    setTimeout(() => {
      sessionExpiryInProgress = false;
    }, 500);
  }
}

export function clearExpiryTimer() {
  if (expiryTimerId != null) {
    clearTimeout(expiryTimerId);
    expiryTimerId = null;
  }
}

/**
 * Schedule automatic logout when JWT reaches exp.
 * @returns {() => void} cleanup
 */
export function scheduleTokenExpiryLogout(token) {
  clearExpiryTimer();
  if (!token || isTokenExpired(token)) {
    return () => {};
  }

  const expMs = getTokenExpiryMs(token);
  if (!expMs) return () => {};

  const delay = Math.max(0, expMs - EXPIRY_SKEW_MS - Date.now());
  expiryTimerId = setTimeout(() => {
    handleSessionExpired("expired");
  }, delay);

  return clearExpiryTimer;
}

export function assertValidSession() {
  const token = getStoredToken();
  if (!token || isTokenExpired(token)) {
    handleSessionExpired(token ? "expired" : "missing");
    return false;
  }
  return true;
}
