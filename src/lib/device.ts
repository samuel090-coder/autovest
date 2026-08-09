const DEVICE_KEY = "av_device_id";

/** Stable-ish device fingerprint: persisted id + hardware signature hash. */
export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `${sigHash()}-${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return sigHash();
  }
}

function sigHash(): string {
  if (typeof window === "undefined") return "srv";
  const n = navigator as Navigator & { deviceMemory?: number };
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(window.devicePixelRatio),
    String(navigator.hardwareConcurrency ?? 0),
    String(n.deviceMemory ?? 0),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  ].join("|");
  let h = 0;
  for (let i = 0; i < parts.length; i++) h = (Math.imul(31, h) + parts.charCodeAt(i)) | 0;
  return `d${(h >>> 0).toString(36)}`;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

export function deviceInfo() {
  if (typeof navigator === "undefined") return {};
  const ua = navigator.userAgent;
  const os =
    /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
    : /Windows/i.test(ua) ? "Windows"
    : /Mac OS X/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux"
    : "Unknown";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Unknown";
  const model =
    ua.match(/\(Linux;[^)]*?;\s*([^;)]+?)\s*(?:Build|\))/)?.[1]?.trim() ||
    (/iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : os);
  return {
    device_id: getDeviceId() ?? undefined,
    device_model: model,
    browser,
    os,
    is_pwa: isStandalone(),
  };
}
