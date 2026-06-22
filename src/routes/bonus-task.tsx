import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { SupportBadge } from "@/components/support-badge";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/bonus-task")({
  head: () => ({ meta: [{ title: "Bonus Task — InvestPro" }] }),
  component: BonusTask,
});

function BonusTask() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return navigate({ to: "/auth" });
      setUserId(data.session.user.id);
    });
  }, [navigate]);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", userId!).maybeSingle()).data,
  });

  const { data: cfg } = useQuery({
    queryKey: ["cash-benefits"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "cash_benefits").maybeSingle();
      return (data?.value as any) ?? {};
    },
  });

  const { data: incomes = [] } = useQuery({
    queryKey: ["bonus-income", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").eq("user_id", userId!).in("type", ["income", "claim", "bonus", "referral"]).order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  const minWithdraw = Number(cfg?.min_withdrawal ?? 6000);
  const headline = cfg?.headline ?? "Bonus Task";

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-orange-300 pb-24">
      <div className="flex items-center justify-between px-4 pt-4 text-white">
        <button onClick={() => history.back()} className="grid h-9 w-9 place-items-center rounded-full"><ArrowLeft className="h-5 w-5" /></button>
        <div className="font-semibold">{headline}</div>
        <span className="text-sm">Rules</span>
      </div>

      <div className="px-4 pt-4">
        <div className="relative overflow-hidden rounded-2xl bg-red-600 p-5 text-white shadow-lg">
          <div className="absolute right-0 top-0 h-full w-32 bg-zinc-900 [clip-path:polygon(40%_0,100%_0,100%_100%,0_100%)]" />
          <div className="relative">
            <div className="text-sm">📂 Account Balance →</div>
            <div className="mt-2 text-4xl font-extrabold">{formatNaira(wallet?.balance ?? 0)}</div>
          </div>
          <Link to="/withdraw" className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold">Withdraw →</Link>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-zinc-900 px-4 py-3 text-center text-white">
          <span className="text-sm">Minimum withdrawal amount: </span>
          <span className="font-bold">{formatNaira(minWithdraw)}</span>
        </div>
      </div>

      {/* Video */}
      <div className="px-4 pt-3">
        <div className="overflow-hidden rounded-2xl bg-black aspect-video">
          {cfg?.video_url ? (
            <video src={cfg.video_url} controls poster={cfg.poster_url ?? undefined} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-white/70">No video uploaded yet</div>
          )}
        </div>
        {cfg?.body && <p className="mt-3 whitespace-pre-wrap text-sm text-white">{cfg.body}</p>}
      </div>

      {/* Income records */}
      <div className="mt-4 rounded-t-3xl bg-white px-4 py-4">
        <h3 className="text-lg font-bold">Income records</h3>
        <div className="mt-2 space-y-2">
          {incomes.length === 0 ? (
            <div className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">No income yet</div>
          ) : (
            incomes.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <div>
                  <div className="font-semibold capitalize">{t.type}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className="font-bold text-emerald-600">+₦{Number(t.amount).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <SupportBadge />
    </div>
  );
}
