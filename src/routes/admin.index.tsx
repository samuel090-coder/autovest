import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: Overview,
});

function Overview() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: users }, { count: invs }, { data: txs }, { count: pending }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("investments").select("*", { count: "exact", head: true }),
        supabase.from("transactions").select("amount,type").eq("type", "invest"),
        supabase.from("transactions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      const totalInvested = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
      return { users: users ?? 0, invs: invs ?? 0, totalInvested, pending: pending ?? 0 };
    },
  });
  const cards = [
    { label: "Users", value: stats?.users ?? "—" },
    { label: "Investments", value: stats?.invs ?? "—" },
    { label: "Total invested", value: formatNaira(stats?.totalInvested ?? 0) },
    { label: "Pending transactions", value: stats?.pending ?? "—" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
          <div className="mt-2 text-2xl font-bold">{c.value}</div>
        </Card>
      ))}
    </div>
  );
}
