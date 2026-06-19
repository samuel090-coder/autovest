import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatNaira } from "@/lib/format";
import { ArrowLeft, TrendingUp, Calendar, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/investment/$id")({
  head: () => ({ meta: [{ title: "Investment Details — InvestPro" }] }),
  component: InvestmentDetails,
});

function InvestmentDetails() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const { data: inv, isLoading } = useQuery({
    queryKey: ["investment", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", userId!).maybeSingle()).data,
  });

  const invest = useMutation({
    mutationFn: async () => {
      if (!inv || !userId || !wallet) throw new Error("Not ready");
      const price = Number(inv.price);
      if (Number(wallet.balance) < price) throw new Error("Insufficient balance — please recharge");
      const { error: txErr } = await supabase.from("transactions").insert({
        user_id: userId, type: "invest", amount: price, status: "approved",
        meta: { investment_id: inv.id, name: inv.name },
      });
      if (txErr) throw txErr;
      const { error: uiErr } = await supabase.from("user_investments").insert({
        user_id: userId, investment_id: inv.id, quantity: 1,
        price_paid: price, daily_income: inv.daily_income,
        total_income: inv.total_income, cycle_days: inv.cycle_days,
      });
      if (uiErr) throw uiErr;
      const { error: wErr } = await supabase.from("wallets")
        .update({ balance: Number(wallet.balance) - price })
        .eq("user_id", userId);
      if (wErr) throw wErr;
    },
    onSuccess: () => {
      toast.success("Investment successful");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      setOpen(false);
      navigate({ to: "/orders" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading…</div>;
  if (!inv) return <div className="p-6 text-center">Not found</div>;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-32">
      <div className="relative">
        <div className="relative aspect-[5/3] w-full bg-dark-surface">
          {inv.image_url && <img src={inv.image_url} alt={inv.name} className="h-full w-full object-cover" />}
          <Link to="/" className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/80 backdrop-blur">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-dark-surface p-5 text-white">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-2xl font-bold">{Number(inv.price).toLocaleString()}</div>
              <div className="text-xs text-white/70">Price(₦)</div>
            </div>
            <div>
              <div className="text-brand text-2xl font-bold">{Number(inv.total_income).toLocaleString()}</div>
              <div className="text-xs text-white/70">Total Income(₦)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-card p-1 shadow-sm">
          <Row label="Investment Cycle(Days):" value={String(inv.cycle_days)} />
          <Row label="Purchase quantity" value="1" />
          <Row label="Daily Income" value={formatNaira(inv.daily_income)} />
        </div>
      </div>

      {inv.description && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl bg-card p-5 shadow-sm space-y-3 text-sm leading-relaxed">
            {inv.description.split("\n").map((line, i) => (
              <p key={i} className="flex gap-2"><span>💰</span><span>{line}</span></p>
            ))}
            <p className="flex gap-2"><TrendingUp className="h-4 w-4 text-success mt-0.5" /> Daily Earnings: {Number(inv.daily_income).toLocaleString()} Naira</p>
            <p className="flex gap-2"><Trophy className="h-4 w-4 text-warning mt-0.5" /> Total Earnings: {Number(inv.total_income).toLocaleString()} Naira</p>
            <p className="flex gap-2"><Calendar className="h-4 w-4 text-info mt-0.5" /> Duration: {inv.cycle_days} days</p>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md p-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="h-14 w-full rounded-full text-base font-semibold">Invest now</Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3 text-left">
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                  {inv.image_url && <img src={inv.image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div>
                  <div className="text-base">{inv.name}</div>
                  <div className="text-sm font-normal"><span className="text-muted-foreground">Price(₦): </span><span className="text-brand text-lg font-bold">{Number(inv.price).toLocaleString()}</span></div>
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="my-4 rounded-xl bg-muted p-4 text-sm space-y-2">
              <Line label="Investment Cycle(Days):" value={String(inv.cycle_days)} />
              <Line label="Daily Income:" value={formatNaira(inv.daily_income)} />
              <Line label="Total Income:" value={formatNaira(inv.total_income)} />
              <Line label="Need to pay:" value={formatNaira(inv.price)} valueClass="text-brand" />
            </div>
            <Button onClick={() => invest.mutate()} disabled={invest.isPending} className="h-14 w-full rounded-full text-base">
              {invest.isPending ? "Processing…" : "Invest now"}
            </Button>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-4 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
function Line({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}
