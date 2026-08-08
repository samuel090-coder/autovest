import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Receipt as ReceiptIcon } from "lucide-react";
import { SupportBadge } from "@/components/support-badge";
import { formatNaira } from "@/lib/format";
import { WithdrawalReceipt, type ReceiptTx } from "@/components/withdrawal-receipt";

export const Route = createFileRoute("/withdraw")({
  head: () => ({
    meta: [
      { title: "Withdraw — InvestPro" },
      { name: "description", content: "Withdraw your earnings to your bank account and track every withdrawal request in real time." },
      { property: "og:title", content: "Withdraw — InvestPro" },
      { property: "og:description", content: "Withdraw your earnings to your bank account and track every withdrawal request in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WithdrawPage,
});

const BANKS = ["OPAY(PAYCOM)", "PALMPAY", "ACCESS BANK", "GTB", "UBA", "ZENITH BANK", "FIRST BANK", "FCMB", "FIDELITY", "STERLING", "KUDA", "MONIEPOINT", "WEMA"];

const MIN_WITHDRAW = 1_000;
const MAX_WITHDRAW = 400_000_000;

function WithdrawPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (!data.user) navigate({ to: "/auth" }); else setUserId(data.user.id); }); }, [navigate]);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", userId!).maybeSingle()).data,
  });
  const { data: bank, refetch: refetchBank } = useQuery({
    queryKey: ["bank", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("bank_accounts").select("*").eq("user_id", userId!).eq("is_default", true).maybeSingle()).data,
  });

  const { data: activeInvestments = 0 } = useQuery({
    queryKey: ["active-investments", userId], enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase.from("user_investments").select("id", { count: "exact", head: true })
        .eq("user_id", userId!).is("claimed_at", null).gt("price_paid", 0);
      return count ?? 0;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["withdraw-history", userId], enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, amount, created_at, status, meta")
        .eq("user_id", userId!)
        .eq("type", "withdraw")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as unknown as ReceiptTx[];
    },
  });

  // Live updates for this user's withdrawal history
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`withdraw-history-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["withdraw-history", userId] });
        qc.invalidateQueries({ queryKey: ["wallet", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  const [editing, setEditing] = useState(false);
  const [holder, setHolder] = useState("");
  const [bankName, setBankName] = useState(BANKS[0]);
  const [acct, setAcct] = useState("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<"balance" | "bonus">("balance");
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<ReceiptTx | null>(null);

  const bonusBalance = Number((wallet as { bonus_balance?: number } | null)?.bonus_balance ?? 0);
  const hasActiveInvestment = activeInvestments > 0;

  useEffect(() => {
    if (bank) { setHolder(bank.holder_name); setBankName(bank.bank_name); setAcct(bank.account_number); }
  }, [bank]);

  const saveBank = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("auth");
      if (!holder.trim() || !acct.trim()) throw new Error("Fill all fields");
      if (bank) {
        const { error } = await supabase.from("bank_accounts").update({ holder_name: holder, bank_name: bankName, account_number: acct, updated_at: new Date().toISOString() }).eq("id", bank.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts").insert({ user_id: userId, holder_name: holder, bank_name: bankName, account_number: acct });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Bank account saved"); setEditing(false); refetchBank(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitWithdraw = useMutation({
    mutationFn: async () => {
      if (!userId || !bank) throw new Error("Bind your bank first");
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Enter an amount");
      if (amt < MIN_WITHDRAW) throw new Error(`Minimum withdrawal is ${formatNaira(MIN_WITHDRAW)}`);
      if (amt > MAX_WITHDRAW) throw new Error(`Maximum withdrawal is ${formatNaira(MAX_WITHDRAW)}`);

      if (source === "bonus") {
        if (!hasActiveInvestment) throw new Error("Purchase an active investment first to withdraw reward money");
        if (amt > bonusBalance) throw new Error("Insufficient reward balance");
        const { error } = await supabase.rpc("withdraw_bonus", { _amount: amt, _bank_account_id: bank.id });
        if (error) throw error;
        return amt;
      }

      if (amt > Number(wallet?.balance ?? 0)) throw new Error("Insufficient balance");
      const { error: txErr } = await supabase.from("transactions").insert({
        user_id: userId, type: "withdraw", amount: amt, status: "pending",
        meta: { source: "balance", bank_account_id: bank.id, holder_name: bank.holder_name, bank_name: bank.bank_name, account_number: bank.account_number },
      });
      if (txErr) throw txErr;
      const { error: wErr } = await supabase.from("wallets").update({ balance: Number(wallet!.balance) - amt }).eq("user_id", userId);
      if (wErr) throw wErr;
      return amt;
    },
    onSuccess: (amt) => {
      setSubmitted(amt);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["withdraw-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-20">
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link to="/wallet" className="grid h-9 w-9 place-items-center rounded-full bg-card shadow-sm"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-center text-base font-bold">Withdrawal account</h1>
        <div className="w-9" />
      </header>

      {(!bank || editing) ? (
        <div className="space-y-4 px-4 pt-4">
          <Field label="Name"><Input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Account holder name" /></Field>
          <Field label="Bank card">
            <Select value={bankName} onValueChange={setBankName}>
              <SelectTrigger className="h-12 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Bank account"><Input inputMode="numeric" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, ""))} placeholder="Account number" /></Field>
          <Button onClick={() => saveBank.mutate()} disabled={saveBank.isPending} className="bg-brand h-12 w-full rounded-full text-white">{saveBank.isPending ? "Saving…" : "Confirm"}</Button>
        </div>
      ) : (
        <div className="space-y-4 px-4 pt-4">
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">Bound bank</div>
            <div className="mt-1 font-semibold">{bank.holder_name}</div>
            <div className="text-sm">{bank.bank_name} · ****{bank.account_number.slice(-4)}</div>
            <button onClick={() => setEditing(true)} className="text-brand mt-2 text-xs font-semibold">Edit bank</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "balance" as const, label: "Main balance", value: Number(wallet?.balance ?? 0) },
              { key: "bonus" as const, label: "Reward balance", value: bonusBalance },
            ]).map((s) => (
              <button
                key={s.key}
                onClick={() => setSource(s.key)}
                className={`rounded-2xl p-3 text-left shadow-sm ${source === s.key ? "bg-brand text-white" : "bg-card"}`}
              >
                <div className="text-xs opacity-80">{s.label}</div>
                <div className="text-lg font-bold">{formatNaira(s.value)}</div>
              </button>
            ))}
          </div>

          {source === "bonus" && !hasActiveInvestment && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <div className="text-sm font-semibold">Active investment required</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Reward money can only be withdrawn while you have an investment running. Purchase an investment first, then come back to withdraw your reward.
              </p>
              <Link to="/" className="bg-brand mt-3 inline-flex h-10 items-center rounded-full px-4 text-xs font-bold text-white">
                Buy an investment
              </Link>
            </div>
          )}

          <Field label="Amount to withdraw (₦)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
          <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-[11px] text-muted-foreground">
            <span>Min: <b className="text-foreground">{formatNaira(MIN_WITHDRAW)}</b></span>
            <span>Max: <b className="text-foreground">{formatNaira(MAX_WITHDRAW)}</b></span>
          </div>
          <Button
            onClick={() => submitWithdraw.mutate()}
            disabled={submitWithdraw.isPending || (source === "bonus" && !hasActiveInvestment)}
            className="bg-brand h-12 w-full rounded-full text-white"
          >
            {submitWithdraw.isPending ? "Submitting…" : "Request withdrawal"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Withdrawals are reviewed by admin within 24h. Balance is held while pending.</p>

          <section className="pt-2">
            <h2 className="mb-2 text-sm font-bold">Withdrawal history</h2>
            {history.length === 0 ? (
              <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-sm">No withdrawals yet.</div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
                    <StatusIcon status={h.status} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{formatNaira(h.amount)}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {new Date(h.created_at).toLocaleString()} · {h.meta?.bank_name ?? "Bank"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        h.status === "approved" ? "bg-success/20 text-success" : h.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                      }`}>
                        {h.status === "approved" ? "Paid" : h.status === "rejected" ? "Rejected" : "Pending"}
                      </span>
                      <button onClick={() => setReceipt(h)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand">
                        <ReceiptIcon className="h-3 w-3" /> Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {submitted !== null && (
        <div className="fixed inset-0 z-[128] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs animate-[ws-pop_420ms_cubic-bezier(0.22,1,0.36,1)] rounded-3xl bg-card p-6 text-center shadow-2xl">
            <div className="mx-auto grid h-16 w-16 animate-[ws-ring_900ms_ease-out] place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h3 className="mt-4 text-lg font-extrabold">Request submitted</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Your withdrawal of <b className="text-foreground">{formatNaira(submitted)}</b> is now pending approval.
              You'll get an instant alert the moment it is credited to your bank.
            </p>
            <button onClick={() => setSubmitted(null)} className="bg-brand mt-5 w-full rounded-full py-3 text-sm font-bold text-white">
              Got it
            </button>
          </div>
          <style>{`
            @keyframes ws-pop { 0% { transform: scale(0.7); opacity: 0 } 60% { transform: scale(1.05); opacity: 1 } 100% { transform: scale(1) } }
            @keyframes ws-ring { 0% { transform: scale(0.4) } 60% { transform: scale(1.18) } 100% { transform: scale(1) } }
          `}</style>
        </div>
      )}

      {receipt && <WithdrawalReceipt tx={receipt} onClose={() => setReceipt(null)} />}

      <SupportBadge />
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "approved") return <span className="grid h-9 w-9 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-5 w-5" /></span>;
  if (status === "rejected") return <span className="grid h-9 w-9 place-items-center rounded-full bg-destructive/15 text-destructive"><XCircle className="h-5 w-5" /></span>;
  return <span className="grid h-9 w-9 place-items-center rounded-full bg-warning/15 text-warning"><Clock className="h-5 w-5" /></span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1 block text-sm font-medium">{label}</Label>{children}</div>;
}
