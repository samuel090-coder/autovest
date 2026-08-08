import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, X, Receipt as ReceiptIcon } from "lucide-react";
import { WithdrawalReceipt, type ReceiptTx } from "@/components/withdrawal-receipt";

const SEEN_KEY = "withdraw_seen_v1";

function seen(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(SEEN_KEY) || "[]") as string[]; } catch { return []; }
}
function markSeen(id: string) {
  try {
    const list = Array.from(new Set([...seen(), id])).slice(-200);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

export function WithdrawalAlerts() {
  const qc = useQueryClient();
  const [queue, setQueue] = useState<ReceiptTx[]>([]);
  const [receipt, setReceipt] = useState<ReceiptTx | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    function push(tx: ReceiptTx) {
      if (seen().includes(tx.id)) return;
      setQueue((q) => (q.some((t) => t.id === tx.id) ? q : [...q, tx]));
    }

    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid || cancelled) return;

      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data: rows } = await supabase
        .from("transactions")
        .select("id, amount, created_at, status, meta")
        .eq("user_id", uid)
        .eq("type", "withdraw")
        .eq("status", "approved")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5);
      (rows ?? []).forEach((r) => push(r as unknown as ReceiptTx));

      channel = supabase
        .channel("withdraw-status")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "transactions", filter: `user_id=eq.${uid}` },
          (payload) => {
            const row = payload.new as unknown as ReceiptTx & { type?: string };
            if (row.type !== "withdraw") return;
            qc.invalidateQueries({ queryKey: ["withdraw-history"] });
            qc.invalidateQueries({ queryKey: ["wallet"] });
            if (row.status === "approved") push(row);
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  const current = queue[0];
  if (!current && !receipt) return null;

  function dismiss(id: string) {
    markSeen(id);
    setQueue((q) => q.filter((t) => t.id !== id));
  }

  return (
    <>
      {current && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[125] flex justify-center p-3">
          <div className="pointer-events-auto w-full max-w-sm animate-[wa-drop_450ms_cubic-bezier(0.22,1,0.36,1)] overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-[2px] shadow-2xl">
            <div className="relative rounded-[14px] bg-white p-4">
              <button
                onClick={() => dismiss(current.id)}
                aria-label="Dismiss"
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 animate-[wa-pop_700ms_ease-out] place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="min-w-0 pr-6">
                  <div className="text-sm font-bold text-emerald-700">Withdrawal successful</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Your withdrawal request of{" "}
                    <span className="font-bold text-foreground">₦{Number(current.amount).toLocaleString()}</span>{" "}
                    has been credited to your bank account
                    {current.meta?.bank_name ? ` (${current.meta.bank_name})` : ""}. Kindly check your bank.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setReceipt(current)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <ReceiptIcon className="h-3.5 w-3.5" /> View receipt
                    </button>
                    <button onClick={() => dismiss(current.id)} className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes wa-drop { from { transform: translateY(-120%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
            @keyframes wa-pop { 0% { transform: scale(0.4) } 60% { transform: scale(1.15) } 100% { transform: scale(1) } }
          `}</style>
        </div>
      )}

      {receipt && (
        <WithdrawalReceipt
          tx={receipt}
          onClose={() => {
            markSeen(receipt.id);
            setQueue((q) => q.filter((t) => t.id !== receipt.id));
            setReceipt(null);
          }}
        />
      )}
    </>
  );
}
