import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { SupportBadge } from "@/components/support-badge";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/withdraw")({
  head: () => ({ meta: [{ title: "Withdraw — InvestPro" }] }),
  component: WithdrawPage,
});

const BANKS = ["OPAY(PAYCOM)", "PALMPAY", "ACCESS BANK", "GTB", "UBA", "ZENITH BANK", "FIRST BANK", "FCMB", "FIDELITY", "STERLING", "KUDA", "MONIEPOINT", "WEMA"];

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

  const [editing, setEditing] = useState(false);
  const [holder, setHolder] = useState("");
  const [bankName, setBankName] = useState(BANKS[0]);
  const [acct, setAcct] = useState("");
  const [amount, setAmount] = useState("");

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
      if (amt > Number(wallet?.balance ?? 0)) throw new Error("Insufficient balance");
      const { error: txErr } = await supabase.from("transactions").insert({
        user_id: userId, type: "withdraw", amount: amt, status: "pending",
        meta: { bank_account_id: bank.id, holder_name: bank.holder_name, bank_name: bank.bank_name, account_number: bank.account_number },
      });
      if (txErr) throw txErr;
      const { error: wErr } = await supabase.from("wallets").update({ balance: Number(wallet!.balance) - amt }).eq("user_id", userId);
      if (wErr) throw wErr;
    },
    onSuccess: () => { toast.success("Withdrawal submitted — pending admin approval"); setAmount(""); qc.invalidateQueries({ queryKey: ["wallet"] }); },
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
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Available balance</span>
              <span className="text-brand text-lg font-bold">{formatNaira(wallet?.balance ?? 0)}</span>
            </div>
          </div>
          <Field label="Amount to withdraw (₦)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
          <Button onClick={() => submitWithdraw.mutate()} disabled={submitWithdraw.isPending} className="bg-brand h-12 w-full rounded-full text-white">
            {submitWithdraw.isPending ? "Submitting…" : "Request withdrawal"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Withdrawals are reviewed by admin within 24h. Balance is held while pending.</p>
        </div>
      )}

      <SupportBadge />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1 block text-sm font-medium">{label}</Label>{children}</div>;
}
