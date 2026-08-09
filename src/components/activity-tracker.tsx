import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity.functions";
import { deviceInfo } from "@/lib/device";

/** Silently records page views + session start (with IP/geo/device) for signed-in users. */
export function ActivityTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastPath = useRef<string | null>(null);
  const sessionLogged = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      if (pathname === lastPath.current) return;
      lastPath.current = pathname;
      const firstOfSession = !sessionLogged.current;
      sessionLogged.current = true;
      try {
        await logActivity({
          data: {
            event: firstOfSession ? "session_start" : "page_view",
            path: pathname,
            geo: firstOfSession,
            ...deviceInfo(),
            meta: {
              screen: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : null,
              referrer: typeof document !== "undefined" ? document.referrer || null : null,
              language: typeof navigator !== "undefined" ? navigator.language : null,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
      } catch {
        /* tracking must never break the app */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}

/** Log a discrete interaction (button click, purchase, claim, etc.). */
export function trackEvent(event: string, label?: string, meta?: Record<string, unknown>) {
  void logActivity({
    data: {
      event,
      label,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
      meta,
      ...deviceInfo(),
    },
  }).catch(() => {});
}
