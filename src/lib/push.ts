import { supabase } from "@/integrations/supabase/client";
import { getDeviceId, isStandalone } from "@/lib/device";

/** Public VAPID key (safe to ship to the browser). */
export const VAPID_PUBLIC_KEY =
  "BA572G_XW21GWJdUN_AjN6YjPMHQlUnudyetTqlb21GQjTwqRXjCqw-2Fdkg5r4t9y1OsqlCjYK99-C6vMRWxfc";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

/** Saves the browser subscription against the signed-in user. Safe to call repeatedly. */
export async function syncPushSubscription(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options?.applicationServerKey) {
    const current = bufToBase64Url(sub.options.applicationServerKey as ArrayBuffer);
    if (current && current !== VAPID_PUBLIC_KEY) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  await supabase.from("push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      device_id: getDeviceId() ?? null,
      user_agent: navigator.userAgent,
      is_pwa: isStandalone(),
      failure_count: 0,
      disabled_at: null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  return true;
}

/** Asks the browser for permission, then registers the device. */
export async function enablePush(): Promise<"granted" | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  await syncPushSubscription();
  return "granted";
}
