import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, phone, full_name, created_at, wallets(balance), user_roles(role)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const adjust = useMutation({
    mutationFn: async ({ userId, delta }: { userId: string; delta: number }) => {
      const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
      const next = Number(w?.balance ?? 0) + delta;
      const { error } = await supabase.from("wallets").update({ balance: next }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Balance updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = users.filter((u: any) => {
    const s = q.toLowerCase();
    return !s || u.email?.toLowerCase().includes(s) || u.phone?.toLowerCase().includes(s) || u.full_name?.toLowerCase().includes(s);
  });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Users ({users.length})</h2>
        <Input className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="py-2">User</th><th>Balance</th><th>Roles</th><th>Adjust balance</th></tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((u: any) => (
              <tr key={u.id}>
                <td className="py-2">
                  <div className="font-medium">{u.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email} · {u.phone}</div>
                </td>
                <td className="font-semibold">{formatNaira(u.wallets?.[0]?.balance ?? 0)}</td>
                <td>{(u.user_roles ?? []).map((r: any) => r.role).join(", ") || "user"}</td>
                <td>
                  <AdjustForm onSubmit={(delta) => adjust.mutate({ userId: u.id, delta })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AdjustForm({ onSubmit }: { onSubmit: (delta: number) => void }) {
  const [v, setV] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(Number(v)); setV(""); }} className="flex gap-1">
      <Input className="h-8 w-28" value={v} onChange={(e) => setV(e.target.value)} placeholder="+/-" type="number" />
      <Button size="sm" type="submit">Apply</Button>
    </form>
  );
}
