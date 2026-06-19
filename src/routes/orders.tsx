import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, BottomNav } from "@/components/app-shell";
import { SupportBadge } from "@/components/support-badge";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "My Orders — InvestPro" }] }),
  component: Orders,
});

function Orders() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);
  const { data: items = [] } = useQuery({
    queryKey: ["my-investments", userId], enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("user_investments").select("*, investment:investments(name, image_url)").eq("user_id", userId!).order("purchased_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <header className="px-4 pt-4"><h1 className="text-xl font-bold">My Orders</h1></header>
      <div className="space-y-3 px-4 pt-4">
        {items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No active investments yet.</div>
        ) : items.map((o: any) => (
          <div key={o.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
            <div className="h-16 w-20 overflow-hidden rounded-lg bg-muted">
              {o.investment?.image_url && <img src={o.investment.image_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{o.investment?.name}</div>
              <div className="text-xs text-muted-foreground">{new Date(o.purchased_at).toLocaleString()}</div>
              <div className="mt-1 text-sm"><span className="text-muted-foreground">Daily: </span><span className="text-brand font-semibold">{formatNaira(o.daily_income)}</span></div>
            </div>
            <div className="text-right text-sm"><div className="text-muted-foreground">Cycle</div><div className="font-bold">{o.cycle_days}d</div></div>
          </div>
        ))}
      </div>
      <SupportBadge />
      <BottomNav />
    </AppShell>
  );
}
