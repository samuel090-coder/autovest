import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity.functions";
import { deviceInfo } from "@/lib/device";

/** Records signed-in session starts and page views without blocking the app. */
export function ActivityTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathnameRef = useRef(pathname);
  const lastPath = useRef<string | null>(null);
  const lastSessionUser = useRef<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  pathnameRef.current = pathname;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      setUserId(nextUserId);

      if (!nextUserId) {
        lastSessionUser.current = null;
        lastPath.current = null;
        return;
      }

      if (lastSessionUser.current !== nextUserId) {
        lastSessionUser.current = nextUserId;
        lastPath.current = pathnameRef.current;
        void writeActivity("session_start", pathnameRef.current, true);
      } else if (event === "SIGNED_IN") {
        lastPath.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || pathname === lastPath.current) return;
    lastPath.current = pathname;
    void writeActivity("page_view", pathname, false);
  }, [pathname, userId]);

  return null;
}

async function writeActivity(event: "session_start" | "page_view", path: string, includeGeo: boolean) {
  try {
    const result = await logActivity({
      data: {
        event,
        path,
        geo: includeGeo,
        ...deviceInfo(),
        meta: {
          screen: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : null,
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
          language: typeof navigator !== "undefined" ? navigator.language : null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    });
    if (!result.ok && import.meta.env.DEV) console.warn("Activity record was not saved:", result.error);
  } catch (error) {
    if (import.meta.env.DEV) console.warn("Activity tracking failed:", error);
  }
}

/** Log an individual interaction (button click, purchase, claim, etc.). */
export function trackEvent(event: string, label?: string, meta?: Record<string, unknown>) {
  void logActivity({
    data: {
      event,
      label,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
      meta,
      ...deviceInfo(),
    },
  }).catch((error) => {
    if (import.meta.env.DEV) console.warn("Activity event was not saved:", error);
  });
}