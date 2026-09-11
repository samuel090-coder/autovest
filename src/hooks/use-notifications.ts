import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppNotification = {
  id: string;
  user_id: string;
  category: string;
  title: string;
  body: string;
  image_url: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

/** Live list of the signed-in user's own notifications. */
export function useNotifications() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["notifications-unread"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  const query = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,user_id,category,title,body,image_url,url,read_at,created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(300);
      // Defensive de-duplication (same title+body within the same minute).
      const seen = new Set<string>();
      return ((data ?? []) as AppNotification[]).filter((n) => {
        const k = `${n.title}|${n.body}|${n.created_at.slice(0, 16)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    },
  });

  return { ...query, userId };
}

export function useUnreadCount() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif-unread-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications-unread"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  const { data } = useQuery({
    queryKey: ["notifications-unread", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId!)
        .is("read_at", null);
      return count ?? 0;
    },
  });
  return data ?? 0;
}
