/** PWA install helpers — Safari (iOS/macOS) vs Chromium. */

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

export function isInStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

export function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as MacIntel
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS/i.test(ua);
}

export function isMacSafari() {
  return isSafariBrowser() && !isIos() && /Macintosh|Mac OS X/i.test(navigator.userAgent || "");
}

export function getPwaInstallPlatform() {
  if (isInStandaloneMode()) return null;
  if (isIos()) return "ios";
  if (isMacSafari()) return "macos";
  if (typeof window !== "undefined" && "BeforeInstallPromptEvent" in window) {
    return "chromium";
  }
  // Android Firefox / others with beforeinstallprompt at runtime
  return "chromium-capable";
}

export function canShowInstallUi() {
  return getPwaInstallPlatform() != null;
}

export function wasInstallPromptDismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_MS;
  } catch {
    return false;
  }
}

export function markInstallPromptDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

let openInstallDialogFn = null;

export function registerInstallDialogOpener(fn) {
  openInstallDialogFn = fn || null;
}

export function openPwaInstallPrompt() {
  openInstallDialogFn?.();
}

/** Chromium deferred install prompt (set by PwaInstallPrompt). */
let deferredInstallPrompt = null;

export function setDeferredInstallPrompt(event) {
  deferredInstallPrompt = event;
}

export function getDeferredInstallPrompt() {
  return deferredInstallPrompt;
}

export function clearDeferredInstallPrompt() {
  deferredInstallPrompt = null;
}

export async function triggerChromiumInstall() {
  const prompt = deferredInstallPrompt;
  if (!prompt) return { outcome: "unavailable" };
  await prompt.prompt();
  const result = await prompt.userChoice;
  clearDeferredInstallPrompt();
  return result;
}
