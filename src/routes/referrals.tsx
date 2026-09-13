import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, BottomNav } from "@/components/app-shell";
import { SupportBadge } from "@/components/support-badge";
import { formatNaira } from "@/lib/format";
import { Copy, Share2, Users, CheckCircle2, Clock, Wallet, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/referrals")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Referrals — InvestPro" },
      { name: "description", content: "Track everyone you invited, their deposit status and the bonuses you earned." },
      { property: "og:title", content: "My Referrals — InvestPro" },
      { property: "og:description", content: "Track your referrals, their status and your referral earnings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralsPage,
});

type Row = {
  referee_id: string;
  display_name: string;
  joined_at: string;
  has_deposited: boolean;
  deposit_total: number;
  bonus_earned: number;
  status: "valid" | "pending_deposit";
};

type Stats = { total: number; valid: number; pending: number; deposits: number; earnings: number };

function ReferralsPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { navigate({ to: "/auth" }); return; }
      setUserId(data.session.user.id);
      const { data: p } = await supabase.from("profiles").select("referral_code").eq("id", data.session.user.id).maybeSingle();
      setCode(p?.referral_code ?? "");
    });
  }, [navigate]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-referrals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_referrals");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["my-referral-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_referral_stats");
      if (error) throw error;
      return (data ?? { total: 0, valid: 0, pending: 0, deposits: 0, earnings: 0 }) as Stats;
    },
  });

  const link = code && typeof window !== "undefined" ? `${window.location.origin}/auth?ref=${code}` : "";

  function copy(text: string, label = "Copied") {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(label);
  }

  async function share() {
    const message = `Join me on InvestPro and start earning daily 💰\n\n${link}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "Join InvestPro", text: message, url: link }); return; } catch { /* cancelled */ }
    }
    copy(message, "Invite message copied");
  }

  return (
    <AppShell>
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => history.back()} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">My Referrals</h1>
      </header>

      <div className="px-4 pt-4">
        <div className="bg-gradient-to-br from-brand to-orange-500 rounded-2xl p-4 text-white shadow-sm">
          <div className="text-xs uppercase tracking-wider opacity-90">Referral earnings</div>
          <div className="mt-1 text-3xl font-extrabold">{formatNaira(stats?.earnings ?? 0)}</div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 backdrop-blur">
            <span className="min-w-0 flex-1 truncate text-xs [overflow-wrap:anywhere]">{link || "—"}</span>
            <button onClick={() => copy(link, "Invite link copied")} aria-label="Copy invite link"><Copy className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs opacity-90">Code: <span className="font-bold tracking-widest">{code || "—"}</span></div>
            <Button onClick={share} size="sm" className="h-8 rounded-full bg-white/20 text-xs font-semibold text-white hover:bg-white/30">
              <Share2 className="mr-1 h-3.5 w-3.5" /> Share
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 pt-4">
        <Stat icon={<Users className="h-4 w-4" />} label="Referred" value={String(stats?.total ?? 0)} />
        <Stat icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Valid" value={String(stats?.valid ?? 0)} />
        <Stat icon={<Clock className="text-warning h-4 w-4" />} label="Pending" value={String(stats?.pending ?? 0)} />
      </div>

      <div className="px-4 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">People you invited</h2>
          <Link to="/team" className="text-xs text-muted-foreground underline">Team overview</Link>
        </div>

        <div className="mt-3 space-y-2 pb-6">
          {isLoading ? (
            <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">Loading your referrals…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl bg-card p-6 text-center shadow-sm">
              <Users className="mx-auto h-10 w-10 text-muted-foreground" />
              <div className="mt-2 font-semibold">No referrals yet</div>
              <p className="mt-1 text-xs text-muted-foreground">Share your invite link — you earn a bonus once your friend makes their first deposit.</p>
              <Button onClick={share} className="bg-brand mt-3 rounded-full text-white">
                <Share2 className="mr-1 h-4 w-4" /> Share invite link
              </Button>
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.referee_id} className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 shadow-sm">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{r.display_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Joined {new Date(r.joined_at).toLocaleDateString()}
                    {Number(r.bonus_earned) > 0 && <> · earned {formatNaira(Number(r.bonus_earned))}</>}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    r.has_deposited ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.has_deposited ? "Valid Referral" : "Pending Deposit"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="bg-warning/20 flex items-center gap-3 rounded-2xl p-4">
          <Wallet className="h-5 w-5 shrink-0" />
          <p className="text-xs leading-relaxed">
            A referral becomes <span className="font-bold">Valid</span> only after your friend completes their first
            approved deposit. Your bonus is credited to your wallet automatically.
          </p>
        </div>
      </div>

      <SupportBadge />
      <BottomNav />
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-sm">
      <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
