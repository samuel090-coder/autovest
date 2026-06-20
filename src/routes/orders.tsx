import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, BottomNav } from "@/components/app-shell";
import { SupportBadge } from "@/components/support-badge";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TrendingUp, Repeat } from "lucide-react";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "My Orders — InvestPro" }] }),
  component: Orders,
});

function Orders() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);
  const { data: items = [], refetch } = useQuery({
    queryKey: ["my-investments", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("user_investments").select("*, investment:investments(name, image_url, max_rounds)").eq("user_id", userId!).is("claimed_at", null).order("purchased_at", { ascending: false })).data ?? [],
  });

  return (
    <AppShell>
      <header className="px-4 pt-4"><h1 className="text-xl font-bold">My Orders</h1></header>
      <div className="space-y-4 px-4 pt-4">
        {items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No active investments yet.
            <div className="mt-4"><Link to="/" className="text-brand font-semibold">Browse products →</Link></div>
          </div>
        ) : items.map((o: any) => <OrderCard key={o.id} order={o} onChange={refetch} />)}
      </div>
      <SupportBadge />
      <BottomNav />
    </AppShell>
  );
}

function OrderCard({ order, onChange }: { order: any; onChange: () => void }) {
  const qc = useQueryClient();
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i); }, []);

  const purchased = new Date(order.purchased_at).getTime();
  const cycleSec = Number(order.cycle_days) * 86400;
  const elapsed = Math.max(0, (Date.now() - purchased) / 1000);
  const progress = Math.min(elapsed / cycleSec, 1);
  const round = Number(order.round ?? 1);
  const maxRounds = Number(order.investment?.max_rounds ?? 2);
  const total = Number(order.total_income);
  const dailyIncome = Number(order.daily_income);
  const earnedThisRound = total * progress;
  const earnedAll = (round - 1) * total + earnedThisRound;
  const roundComplete = progress >= 1;
  const allDone = roundComplete && round >= maxRounds;
  const endAt = new Date(purchased + cycleSec * 1000);

  const nextRound = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("start_next_round", { _uinv_id: order.id });
      if (error) throw error; return data;
    },
    onSuccess: () => { toast.success(`Round ${round + 1} started`); qc.invalidateQueries({ queryKey: ["my-investments"] }); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const claim = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_investment", { _uinv_id: order.id });
      if (error) throw error; return data;
    },
    onSuccess: () => { toast.success("Payout credited to balance"); qc.invalidateQueries({ queryKey: ["my-investments"] }); qc.invalidateQueries({ queryKey: ["wallet"] }); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl bg-card shadow-sm">
      <div className="flex gap-3 p-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {order.investment?.image_url && <img src={order.investment.image_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate font-semibold">{order.investment?.name}</div>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">Round {round}/{maxRounds}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Starting: {new Date(order.purchased_at).toLocaleString()}</div>
          <div className="text-xs"><span className="text-muted-foreground">Expiration: </span><span className="text-warning font-semibold">{endAt.toLocaleString()}</span></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t px-3 py-3 text-center">
        <div><div className="text-lg font-bold">{order.cycle_days}</div><div className="text-xs text-muted-foreground">Cycle(Days)</div></div>
        <div><div className="text-warning text-lg font-bold">{Math.round(dailyIncome).toLocaleString()}</div><div className="text-xs text-muted-foreground">Daily Income</div></div>
        <div><div className="text-warning text-lg font-bold">{Math.round(total).toLocaleString()}</div><div className="text-xs text-muted-foreground">Total Income</div></div>
      </div>
      <div className="px-3 pb-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="bg-brand h-full transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground"><TrendingUp className="mr-1 inline h-3 w-3" />Earned live</span>
          <span className="text-success font-bold tabular-nums">+{earnedAll.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {roundComplete && !allDone && (
        <button onClick={() => nextRound.mutate()} disabled={nextRound.isPending}
          className="bg-flash-gradient flex w-full items-center justify-center gap-2 rounded-b-2xl px-3 py-3 text-sm font-bold text-white">
          <Repeat className="h-4 w-4" /> {nextRound.isPending ? "Starting…" : `Go another round (Round ${round + 1})`}
        </button>
      )}
      {allDone && (
        <div className="flex items-stretch border-t">
          <div className="bg-warning/15 flex-1 px-3 py-3 text-center">
            <div className="text-success text-lg font-bold">+{(total * maxRounds).toLocaleString()}</div>
          </div>
          <Button onClick={() => claim.mutate()} disabled={claim.isPending} className="rounded-none rounded-br-2xl bg-brand px-6 text-white">
            {claim.isPending ? "…" : "Receive"}
          </Button>
        </div>
      )}
      {!roundComplete && (
        <div className="flex items-stretch border-t">
          <div className="bg-warning/15 flex-1 px-3 py-3 text-center">
            <div className="text-brand text-lg font-bold tabular-nums">+{Math.round(earnedThisRound).toLocaleString()}</div>
          </div>
          <Button disabled className="rounded-none rounded-br-2xl bg-muted-foreground/30 px-6 text-white">Receive</Button>
        </div>
      )}
    </div>
  );
}
