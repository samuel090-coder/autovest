import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/admin/transactions")({
  component: AdminTx,
});

function AdminTx() {
  const qc = useQueryClient();
  const { data: txs = [] } = useQuery({
    queryKey: ["admin-tx"],
    queryFn: async () => (await supabase.from("transactions").select("*, profile:profiles(full_name,email,phone)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("transactions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-tx"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const issueToken = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("issue_payment_token", { _tx_id: id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (token) => {
      navigator.clipboard?.writeText(token);
      toast.success(`Token ${token} issued & copied — send it to the user`);
      qc.invalidateQueries({ queryKey: ["admin-tx"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-base font-semibold">Transactions</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="py-2">User</th><th>Type</th><th>Amount</th><th>Status</th><th>Token</th><th>When</th><th></th></tr>
          </thead>
          <tbody className="divide-y">
            {txs.map((t: any) => (
              <tr key={t.id}>
                <td className="py-2"><div className="font-medium">{t.profile?.full_name ?? "—"}</div><div className="text-xs text-muted-foreground">{t.profile?.email}</div></td>
                <td className="capitalize">{t.type}</td>
                <td className="font-semibold">{formatNaira(t.amount)}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs ${t.status === "approved" ? "bg-success/20 text-success" : t.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>{t.status}</span></td>
                <td>
                  {t.meta?.payment_token ? (
                    <button
                      onClick={() => { navigator.clipboard?.writeText(t.meta.payment_token); toast.success("Token copied"); }}
                      className="rounded bg-muted px-2 py-1 font-mono text-xs"
                    >
                      {t.meta.payment_token}
                    </button>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</td>
                <td>
                  {t.status === "pending" && (
                    <div className="flex gap-1">
                      {t.type === "recharge" ? (
                        <Button size="sm" disabled={issueToken.isPending} onClick={() => issueToken.mutate(t.id)}>
                          {t.meta?.payment_token ? "Re-copy token" : "Approve & issue token"}
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setStatus.mutate({ id: t.id, status: "approved" })}>Approve</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: t.id, status: "rejected" })}>Reject</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}

          </tbody>
        </table>
      </div>
    </Card>
  );
}
