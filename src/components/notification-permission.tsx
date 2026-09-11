import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { enablePush, pushSupported, syncPushSubscription } from "@/lib/push";
import { Bell, X } from "lucide-react";

const KEY = "notif_prompt_v1";

/**
 * Professional, non-blocking permission prompt.
 * Appears a few seconds after a signed-in user lands, and only when the
 * browser has not already granted or blocked notifications.
 */
export function NotificationPermission() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!pushSupported()) return;

    // Re-register silently on every visit (handles expired / rotated subscriptions).
    void syncPushSubscription().catch(() => {});

    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "push-subscription-change") void syncPushSubscription().catch(() => {});
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);

    const snoozedUntil = Number(localStorage.getItem(KEY) || 0);
    if (Notification.permission !== "default" || Date.now() < snoozedUntil) {
      return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled && data.user) setShow(true);
    }, 6000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      navigator.serviceWorker?.removeEventListener("message", onMsg);
    };
  }, []);

  if (!show) return null;

  const snooze = (days: number) => {
    localStorage.setItem(KEY, String(Date.now() + days * 86400000));
    setShow(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-24 z-[130] flex justify-center px-3">
      <div className="w-full max-w-sm animate-[np-up_420ms_cubic-bezier(0.22,1,0.36,1)] overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-red-500 p-[2px] shadow-2xl">
        <div className="relative rounded-[14px] bg-card p-4">
          <button
            onClick={() => snooze(3)}
            aria-label="Not now"
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 animate-pulse place-items-center rounded-full bg-brand/10 text-brand">
              <Bell className="h-6 w-6" />
            </div>
            <div className="min-w-0 pr-6">
              <div className="text-sm font-bold">Turn on instant alerts</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Get notified the moment your deposit is confirmed, your withdrawal is paid,
                your investment matures or a referral bonus lands — even when the app is closed.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const r = await enablePush();
                    setBusy(false);
                    if (r !== "granted") localStorage.setItem(KEY, String(Date.now() + 3 * 86400000));
                    setShow(false);
                  }}
                  className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {busy ? "Enabling…" : "Enable alerts"}
                </button>
                <button onClick={() => snooze(3)} className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes np-up { from { transform: translateY(120%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
    </div>
  );
}
