import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, BottomNav } from "@/components/app-shell";
import { SupportBadge } from "@/components/support-badge";
import { ArrowLeft, Bell, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/message")({
  head: () => ({ meta: [{ title: "Messages — InvestPro" }] }),
  component: MessagePage,
});

function MessagePage() {
  const [tab, setTab] = useState<"announcement" | "message">("announcement");

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements-inbox"],
    queryFn: async () => {
      const { data: settings } = await supabase
        .from("site_settings")
        .select("key,value")
        .in("key", ["announce_1", "announce_2"]);
      const admin = (settings ?? [])
        .map((r: any) => r.value)
        .filter((v: any) => v && v.enabled && (v.title || v.body))
        .map((v: any, i: number) => ({ id: `announce-${i}`, title: v.title, body: v.body, created_at: null }));
      const { data: posts } = await supabase
        .from("post_messages")
        .select("*")
        .eq("kind", "announcement")
        .order("created_at", { ascending: false });
      return [...admin, ...(posts ?? [])];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["inbox-messages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("post_messages")
        .select("*")
        .eq("kind", "message")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const items = tab === "announcement" ? announcements : messages;

  return (
    <AppShell>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-3 py-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">Messages</h1>
      </header>

      <div className="grid grid-cols-2 gap-0 border-b bg-white">
        {(["announcement", "message"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
              tab === k ? "border-b-2 border-brand text-brand" : "text-muted-foreground"
            }`}
          >
            {k === "announcement" ? <Bell className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            {k === "announcement" ? "Announcement" : "Message"}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-sm text-muted-foreground">
            {tab === "announcement" ? "No announcements yet." : "No messages yet."}
          </div>
        ) : (
          items.map((m: any) => (
            <div key={m.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
              <div className="flex items-start gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white ${
                  tab === "announcement" ? "bg-gradient-to-br from-orange-400 to-red-500" : "bg-gradient-to-br from-blue-400 to-indigo-600"
                }`}>
                  {tab === "announcement" ? <Bell className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-bold [overflow-wrap:anywhere]">{m.title ?? "Notice"}</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                    {m.body}
                  </div>
                  {m.image_url && (
                    <img src={m.image_url} alt="" className="mt-2 max-h-56 rounded-lg object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                  )}
                  {m.created_at && (
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <SupportBadge />
      <BottomNav />
    </AppShell>
  );
}
