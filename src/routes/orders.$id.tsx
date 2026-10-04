import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3, Coins, Repeat, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({
    meta: [
      { title: "Live Investment Progress — AutoVest" },
      { name: "description", content: "See live earnings, battery progress, investment rounds, and payout status." },
      { property: "og:title", content: "Live Investment Progress — AutoVest" },
      { property: "og:description", content: "See live earnings, battery progress, investment rounds, and payout status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RunningInvestmentPage,
});

function RunningInvestmentPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [, setClock] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ["running-investment", id, userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_investments")
        .select("*, investment:investments(name, image_url, description, max_rounds, price)")
        .eq("id", id)
        .eq("user_id", userId)
        .is("claimed_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const nextRound = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("start_next_round", { _uinv_id: order!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Next round started`);
      qc.invalidateQueries({ queryKey: ["my-investments"] });
      refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const claim = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("claim_investment", { _uinv_id: order!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout credited to balance");
      qc.invalidateQueries({ queryKey: ["my-investments"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      window.location.assign("/orders");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !userId) {
    return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading live progress…</div>;
  }

  if (!order) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="text-xl font-bold">Investment not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This investment is unavailable or has already been claimed.</p>
          <Button asChild className="mt-5"><Link to="/orders">Back to orders</Link></Button>
        </div>
      </div>
    );
  }

  const purchasedAt = new Date(order.purchased_at).getTime();
  const cycleSeconds = Math.max(1, Number(order.cycle_days) * 86_400);
  const elapsedSeconds = Math.max(0, (Date.now() - purchasedAt) / 1000);
  const progress = Math.min(elapsedSeconds / cycleSeconds, 1);
  const progressPercent = Math.round(progress * 100);
  const round = Number(order.round ?? 1);
  const maxRounds = Number(order.investment?.max_rounds ?? 2);
  const totalIncome = Number(order.total_income);
  const dailyIncome = Number(order.daily_income);
  const earnedThisRound = totalIncome * progress;
  const earnedAll = (round - 1) * totalIncome + earnedThisRound;
  const roundComplete = progress >= 1;
  const allDone = roundComplete && round >= maxRounds;
  const endAt = new Date(purchasedAt + cycleSeconds * 1000);
  const remainingSeconds = Math.max(0, Math.ceil(cycleSeconds - elapsedSeconds));


  return (
    <main className="mx-auto min-h-screen max-w-md overflow-hidden bg-background pb-8 pt-[30px]">
      <header className="relative overflow-hidden bg-dark-surface px-4 pb-7 pt-4 text-primary-foreground">
        {order.investment?.image_url && (
          <img src={order.investment.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        )}
        <div className="absolute inset-0 bg-dark-surface/75" />
        <div className="relative flex items-center justify-between">
          <Button asChild variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <Link to="/orders" aria-label="Back to orders"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex items-center gap-1.5 rounded-full bg-success/20 px-3 py-1 text-[11px] font-bold text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> LIVE EARNING
          </div>
        </div>
        <div className="relative mt-5 text-center">
          <p className="text-xs font-semibold uppercase text-primary-foreground/70">Running investment</p>
          <h1 className="mt-1 text-2xl font-extrabold">{order.investment?.name}</h1>
          <p className="mt-2 text-sm text-primary-foreground/70">Round {round} of {maxRounds}</p>
        </div>
      </header>

      <section className="px-4 py-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Invested" value={formatNaira(order.investment?.price)} />
          <Metric label="Daily" value={formatNaira(dailyIncome)} highlight />
          <Metric label="Total" value={formatNaira(totalIncome)} />
        </div>

        <div className="relative mt-8 flex justify-center pb-4 pt-6">
          <div className="battery-charge relative h-[330px] w-[176px]">
            <div className="absolute left-1/2 top-0 h-7 w-20 -translate-x-1/2 rounded-t-xl bg-charge-shell" />
            <div className="absolute inset-x-0 bottom-0 top-5 overflow-hidden rounded-[30px] border-[8px] border-charge-shell bg-muted shadow-inner">
              <div
                className="absolute inset-x-0 bottom-0 bg-charge-fill transition-[height] duration-1000 ease-out"
                style={{ height: `${Math.max(6, progressPercent)}%` }}
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-charge-glow" />
              </div>
              <MoneyRain />
              <div className="absolute inset-0 z-20 grid place-items-center">
                <div className="text-center text-charge-shell drop-shadow-sm">
                  <Zap className="battery-bolt mx-auto h-10 w-10 fill-current" />
                  <div className="mt-2 text-4xl font-black tabular-nums">{progressPercent}%</div>
                  <div className="mt-1 text-[10px] font-extrabold uppercase">Charging profit</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Earned so far</p>
          <p className="mt-1 text-3xl font-black tabular-nums text-success">+{formatNaira(earnedAll)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Money keeps dropping in while this cycle is active</p>
        </div>

        <div className="mt-6 divide-y overflow-hidden rounded-2xl border bg-card px-4 shadow-sm">
          <DetailRow icon={CalendarClock} label="Started" value={new Date(order.purchased_at).toLocaleString()} />
          <DetailRow icon={Clock3} label={roundComplete ? "Cycle status" : "Time remaining"} value={roundComplete ? "Completed" : formatCountdown(remainingSeconds)} />
          <DetailRow icon={TrendingUp} label="Cycle ends" value={endAt.toLocaleString()} />
          <DetailRow icon={Coins} label="This round" value={formatNaira(earnedThisRound)} />
        </div>

        <div className="mt-5">
          {roundComplete && !allDone && (
            <Button className="h-14 w-full gap-2 rounded-xl" onClick={() => nextRound.mutate()} disabled={nextRound.isPending}>
              <Repeat className="h-4 w-4" />{nextRound.isPending ? "Starting…" : `Start round ${round + 1}`}
            </Button>
          )}
          {allDone && (
            <Button className="h-14 w-full gap-2 rounded-xl bg-success hover:bg-success/90" onClick={() => claim.mutate()} disabled={claim.isPending}>
              <CheckCircle2 className="h-4 w-4" />{claim.isPending ? "Crediting…" : `Receive ${formatNaira(totalIncome * maxRounds)}`}
            </Button>
          )}
          {!roundComplete && (
            <Button disabled className="h-14 w-full rounded-xl">Earning in progress · {progressPercent}%</Button>
          )}
        </div>
      </section>
    </main>
  );
}

function MoneyRain() {
  const drops = [
    { left: "12%", delay: "0s", duration: "2.4s" },
    { left: "31%", delay: "0.7s", duration: "2.8s" },
    { left: "52%", delay: "1.3s", duration: "2.2s" },
    { left: "70%", delay: "0.25s", duration: "3s" },
    { left: "84%", delay: "1.65s", duration: "2.6s" },
    { left: "42%", delay: "2s", duration: "2.9s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
      {drops.map((drop, index) => (
        <span
          key={index}
          className="money-rain-drop absolute -top-8 grid h-7 w-11 place-items-center rounded border border-success bg-success/85 text-[10px] font-black text-primary-foreground shadow-sm"
          style={{ left: drop.left, animationDelay: drop.delay, animationDuration: drop.duration }}
        >
          ₦
        </span>
      ))}
    </div>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-2 py-3 shadow-sm">
      <p className={`truncate text-sm font-extrabold ${highlight ? "text-success" : "text-foreground"}`}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success/10 text-success"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase text-muted-foreground">{label}</span>
        <span className="mt-0.5 block break-words text-sm font-bold">{value}</span>
      </span>
    </div>
  );
}

function formatCountdown(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}