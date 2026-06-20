import { createFileRoute } from "@tanstack/react-router";
import { AppShell, BottomNav } from "@/components/app-shell";
import { SupportBadge } from "@/components/support-badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Copy, User, CheckCircle2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "My Team — InvestPro" }] }),
  component: Team,
});

function Team() {
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: p } = await supabase.from("profiles").select("referral_code").eq("id", data.user.id).maybeSingle();
      setCode(p?.referral_code ?? "");
    });
  }, []);

  const link = code ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${code}` : "";

  const { data: refs = [] } = useQuery({
    queryKey: ["my-refs", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("profiles").select("id").eq("referred_by", userId!)).data ?? [],
  });
  const { data: wallet } = useQuery({
    queryKey: ["wallet", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("wallets").select("referral_bonus").eq("user_id", userId!).maybeSingle()).data,
  });
  const { data: deposits = 0 } = useQuery({
    queryKey: ["ref-deposits", userId], enabled: !!userId,
    queryFn: async () => {
      const refIds = refs.map((r: any) => r.id);
      if (refIds.length === 0) return 0;
      const { data } = await supabase.from("transactions").select("amount").in("user_id", refIds).eq("type", "recharge").eq("status", "approved");
      return (data ?? []).reduce((s, t: any) => s + Number(t.amount), 0);
    },
  });

  function copy(text: string) { navigator.clipboard.writeText(text); toast.success("Copied"); }
  async function share() {
    if (navigator.share) try { await navigator.share({ title: "Join InvestPro", text: "Use my code to join InvestPro", url: link }); } catch {}
    else copy(link);
  }

  const tiers = [
    { tier: 1, pct: 20, color: "bg-warning", refs: refs.length, deposit: deposits },
    { tier: 2, pct: 3, color: "bg-flash-gradient", refs: 0, deposit: 0 },
    { tier: 3, pct: 1, color: "bg-brand", refs: 0, deposit: 0 },
  ];

  return (
    <AppShell>
      <header className="px-4 pt-4"><h1 className="text-xl font-bold">My Team</h1></header>
      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-card p-4 text-center shadow-sm">
          <div className="text-sm">My invitation code</div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-dark-surface px-3 py-2 text-left text-white">
            <span className="truncate text-sm">{link || "—"}</span>
            <button onClick={() => copy(link)}><Copy className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Code: <span className="font-bold tracking-widest">{code || "—"}</span></div>
        </div>
      </div>

      <div className="px-4 pt-5"><h2 className="text-lg font-bold">Referral Details</h2></div>
      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="inline-flex items-center gap-1 text-sm"><User className="text-warning h-4 w-4" /> My referrals</div>
          <div className="mt-2 text-2xl font-bold">{refs.length}</div>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="inline-flex items-center gap-1 text-sm"><CheckCircle2 className="text-warning h-4 w-4" /> Referral bonus</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-brand text-2xl font-bold">{formatNaira(wallet?.referral_bonus ?? 0)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 pt-4">
        {tiers.map((t) => (
          <div key={t.tier} className="overflow-hidden rounded-2xl bg-dark-surface">
            <div className="m-2 grid grid-cols-3 items-center rounded-lg bg-card px-3 py-3">
              <div className="text-sm">Referrals:<div className="mt-1 inline-flex items-center gap-1 font-bold">👤 {t.refs}</div></div>
              <div className="text-sm">Deposit cashback:<div className="mt-1 inline-flex items-center gap-1 font-bold">💰 {formatNaira(t.deposit * t.pct / 100)}</div></div>
              <div className={`${t.color} -mr-3 -my-3 ml-2 grid h-14 place-items-center rounded-l-full pl-4 pr-3 text-white`}>
                <div className="text-right">🏅 <span className="text-xs">Tier{t.tier}</span> <span className="text-base font-bold">{t.pct}%</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pt-4">
        <div className="bg-warning/20 flex items-center justify-between rounded-2xl p-4">
          <div>
            <div className="font-bold">Invite Friends</div>
            <div className="text-xs text-muted-foreground">Withdrawing is easier!</div>
          </div>
          <Button onClick={share} className="bg-brand text-white"><Share2 className="mr-1 h-4 w-4" />Share</Button>
        </div>
      </div>

      <SupportBadge />
      <BottomNav />
    </AppShell>
  );
}
