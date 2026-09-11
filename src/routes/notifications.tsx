import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, BottomNav } from "@/components/app-shell";
import { useNotifications, type AppNotification } from "@/hooks/use-notifications";
import { enablePush, pushSupported } from "@/lib/push";
import {
  ArrowLeft, Bell, BellRing, Search, CheckCheck, Wallet, TrendingUp,
  Gift, Users, ShieldCheck, Megaphone, LifeBuoy, Banknote, Trash2,
} from "lucide-react";

export const Route = createFileRoute("/notifications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notifications — AutoVest" },
      { name: "description", content: "Your private AutoVest alerts: deposits, withdrawals, investment payouts, referral bonuses and account updates." },
      { property: "og:title", content: "Notifications — AutoVest" },
      { property: "og:description", content: "Your private AutoVest alerts, all in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

const CATS = [
  { key: "all", label: "All", icon: Bell },
  { key: "deposit", label: "Deposits", icon: Banknote },
  { key: "withdrawal", label: "Withdrawals", icon: Wallet },
  { key: "investment", label: "Investments", icon: TrendingUp },
  { key: "reward", label: "Rewards", icon: Gift },
  { key: "referral", label: "Referrals", icon: Users },
  { key: "wallet", label: "Wallet", icon: Wallet },
  { key: "announcement", label: "News", icon: Megaphone },
  { key: "account", label: "Account", icon: ShieldCheck },
  { key: "support", label: "Support", icon: LifeBuoy },
] as const;

function iconFor(cat: string) {
  return (CATS.find((c) => c.key === cat)?.icon ?? Bell) as typeof Bell;
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useNotifications();
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(
      (n) =>
        (cat === "all" || n.category === cat) &&
        (!onlyUnread || !n.read_at) &&
        (!term || n.title.toLowerCase().includes(term) || n.body.toLowerCase().includes(term)),
    );
  }, [items, cat, q, onlyUnread]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markAll() {
    await supabase.rpc("mark_notifications_read");
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
  }

  async function open(n: AppNotification) {
    if (!n.read_at) {
      await supabase.rpc("mark_notifications_read", { _ids: [n.id] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    }
    if (n.url) navigate({ to: n.url as string }).catch(() => {});
  }

  async function remove(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
  }

  const needsPermission =
    pushSupported() && typeof Notification !== "undefined" && Notification.permission === "default";

  return (
    <AppShell>
      <header className="sticky top-0 z-20 bg-brand px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <Link to="/" className="grid h-8 w-8 place-items-center rounded-full bg-white/15"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold">Notifications</h1>
            <p className="text-[11px] text-white/80">{unread} unread</p>
          </div>
          <button onClick={markAll} className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        </div>
      </header>

      {needsPermission && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
          <BellRing className="h-5 w-5 shrink-0 text-brand" />
          <p className="min-w-0 flex-1 break-words text-[11px] leading-relaxed text-muted-foreground">
            Allow alerts so you never miss a payout or approval, even when the app is closed.
          </p>
          <button onClick={() => void enablePush()} className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-[11px] font-bold text-white">
            Allow
          </button>
        </div>
      )}

      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notifications"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => setOnlyUnread((v) => !v)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold ${onlyUnread ? "bg-brand text-white" : "bg-muted"}`}
        >
          Unread
        </button>
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold ${cat === c.key ? "bg-brand text-white" : "bg-muted"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 px-4 pt-3">
        {isLoading && <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-3 h-8 w-8 opacity-40" />
            Nothing here yet. Your account alerts will show up here.
          </div>
        )}
        {filtered.map((n) => {
          const Icon = iconFor(n.category);
          return (
            <div
              key={n.id}
              className={`overflow-hidden rounded-2xl border shadow-sm ${n.read_at ? "bg-card" : "border-brand/30 bg-brand/5"}`}
            >
              <button onClick={() => void open(n)} className="flex w-full gap-3 p-3 text-left">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${n.read_at ? "bg-muted text-muted-foreground" : "bg-brand/15 text-brand"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 break-words text-sm font-semibold">{n.title}</div>
                    {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  </div>
                  <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {n.category} • {timeAgo(n.created_at)}
                  </div>
                </div>
              </button>
              {n.image_url && (
                <img src={n.image_url} alt="" className="h-32 w-full object-cover" loading="lazy" />
              )}
              <div className="flex justify-end border-t px-3 py-1.5">
                <button onClick={() => void remove(n.id)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </AppShell>
  );
}
