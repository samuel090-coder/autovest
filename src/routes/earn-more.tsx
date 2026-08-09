import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, BottomNav } from "@/components/app-shell";
import { formatNaira } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Gift, Lock, Sparkles, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/earn-more")({
  head: () => ({
    meta: [
      { title: "Earn More — Claim up to ₦500,000 | AutoVest" },
      { name: "description", content: "Run a qualifying investment and claim ₦500,000 or ₦200,000 straight into your real AutoVest balance." },
      { property: "og:title", content: "Earn More — Claim up to ₦500,000 | AutoVest" },
      { property: "og:description", content: "Run a qualifying investment and claim ₦500,000 or ₦200,000 straight into your real AutoVest balance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EarnMore,
});

type Res = { ok?: boolean; amount?: number; error?: string; required?: number };

function EarnMore() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  const { data: offers = [] } = useQuery({
    queryKey: ["offers"],
    queryFn: async () =>
      (await supabase.from("offers").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });

  const { data: state } = useQuery({
    queryKey: ["offer-state", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [claims, invs] = await Promise.all([
        supabase.from("offer_claims").select("offer_key").eq("user_id", userId!),
        supabase.from("user_investments").select("price_paid").eq("user_id", userId!),
      ]);
      return {
        claimed: new Set((claims.data ?? []).map((c) => c.offer_key)),
        best: Math.max(0, ...(invs.data ?? []).map((i) => Number(i.price_paid))),
      };
    },
  });

  const claim = useMutation({
    mutationFn: async (key: string) => {
      const { data, error } = await supabase.rpc("claim_offer", { _key: key });
      if (error) throw error;
      const res = (data ?? {}) as Res;
      if (!res.ok) throw new Error(res.error === "requirement_not_met" ? "You have not met the investment requirement yet." : res.error ?? "Could not claim");
      return res;
    },
    onSuccess: (res) => {
      toast.success(`🎉 ${formatNaira(res.amount ?? 0)} credited to your real balance!`);
      qc.invalidateQueries({ queryKey: ["offer-state"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-gradient-to-r from-brand to-red-500 px-4 py-3 text-white">
        <Link to="/" aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full bg-white/20">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-base font-bold leading-tight">Earn More Offers</h1>
          <p className="text-[11px] text-white/80">Big rewards for active investors</p>
        </div>
        <Sparkles className="ml-auto h-5 w-5 animate-pulse" />
      </header>

      <div className="space-y-4 p-4">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-brand p-4 text-white shadow-lg">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">Limited reward pool</div>
          <div className="mt-1 text-2xl font-black leading-tight">Get up to ₦500,000 free</div>
          <p className="mt-1 text-xs leading-relaxed text-white/90">
            Invest in a qualifying product, keep it running, then tap claim. The reward lands in your <b>real balance</b> —
            you can invest it again or withdraw it like any other money.
          </p>
        </div>

        {offers.map((o) => {
          const claimed = state?.claimed.has(o.key) ?? false;
          const qualified = (state?.best ?? 0) >= Number(o.required_investment);
          const pct = Math.min(100, Math.round(((state?.best ?? 0) / Number(o.required_investment)) * 100));
          return (
            <div key={o.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="flex items-center justify-between bg-gradient-to-r from-brand/10 to-amber-500/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">
                    <Gift className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <div className="text-sm font-bold">{o.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Requires a successful {formatNaira(o.required_investment)} investment
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-brand">{formatNaira(o.reward_amount)}</div>
                  <div className="text-[10px] text-muted-foreground">reward</div>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <p className="text-xs leading-relaxed text-muted-foreground break-words">{o.description}</p>

                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Your best investment: {formatNaira(state?.best ?? 0)}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-brand transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <ol className="space-y-1.5 rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed">
                  <li><b>1.</b> Fund your account from the Deposit page.</li>
                  <li><b>2.</b> Buy any investment product of {formatNaira(o.required_investment)} or more.</li>
                  <li><b>3.</b> Come back here and tap claim — {formatNaira(o.reward_amount)} is added to your real balance.</li>
                </ol>

                {claimed ? (
                  <div className="flex items-center justify-center gap-2 rounded-full bg-success/15 py-3 text-sm font-bold text-success">
                    <BadgeCheck className="h-4 w-4" /> Claimed
                  </div>
                ) : qualified ? (
                  <button
                    onClick={() => claim.mutate(o.key)}
                    disabled={claim.isPending}
                    className="w-full animate-pulse rounded-full bg-gradient-to-r from-amber-500 to-brand py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {claim.isPending ? "Crediting…" : `Claim ${formatNaira(o.reward_amount)} now`}
                  </button>
                ) : (
                  <Link to="/" className="flex w-full items-center justify-center gap-2 rounded-full bg-muted py-3 text-sm font-bold text-muted-foreground">
                    <Lock className="h-4 w-4" /> Invest {formatNaira(o.required_investment)} to unlock
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="h-4 w-4 text-brand" /> How it works
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            These offers reward serious investors. The system checks your purchase history automatically — as soon as a
            qualifying product is bought and running, the claim button turns on. Each offer can be claimed once per
            account, and the reward is normal money in your main balance (not a locked bonus).
          </p>
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
