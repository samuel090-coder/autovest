import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Copy, Loader2, Landmark, Send, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/payment/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Complete Payment — InvestPro" },
      { name: "description", content: "Transfer to your generated virtual account and confirm your deposit with a payment token." },
      { property: "og:title", content: "Complete Payment — InvestPro" },
      { property: "og:description", content: "Transfer to your virtual account and confirm your InvestPro deposit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentPage,
});

type BankCfg = {
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  telegram_username?: string;
  telegram_message?: string;
  support_email?: string;
  note?: string;
};

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
}

function PaymentPage() {
  const { id } = useParams({ from: "/payment/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(true);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    const t = setTimeout(() => setGenerating(false), 3200);
    return () => clearTimeout(t);
  }, []);

  const { data: cfg } = useQuery({
    queryKey: ["manual-bank"],
    queryFn: async (): Promise<BankCfg> => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "manual_bank").maybeSingle();
      return (data?.value as BankCfg) ?? {};
    },
  });

  const { data: tx } = useQuery({
    queryKey: ["payment-tx", id],
    refetchInterval: 5000,
    queryFn: async () => (await supabase.from("transactions").select("*").eq("id", id).maybeSingle()).data,
  });

  const amount = Number(tx?.amount ?? 0);
  const reference = `INV-${id.slice(0, 8).toUpperCase()}`;
  const status = tx?.status ?? "pending";

  const supportEmail = (cfg?.support_email ?? "cartswiftonline@gmail.com").trim();
const emailLink = `mailto:${supportEmail}?subject=Payment%20Token%20-%20${reference}&body=${tgText}`;

  async function submitToken() {
    const t = token.trim();
    if (t.length < 4) return toast.error("Enter the payment token from support");
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("redeem_payment_token", { _tx_id: id, _token: t });
      if (error) throw error;
      toast.success("Payment confirmed — wallet credited 🎉");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["payment-tx", id] });
      setTimeout(() => navigate({ to: "/" }), 1400);
    } catch (e: any) {
      toast.error(e.message ?? "Could not verify token");
    } finally {
      setBusy(false);
    }
  }

  if (generating) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-b from-[#0b2f26] to-[#08201a] px-6 text-center text-white">
        <div>
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-emerald-400" />
          <div className="mt-5 text-lg font-bold">Please wait…</div>
          <p className="mt-2 text-sm text-white/70">We are generating a virtual account number for your payment.</p>
          <div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf6e8] to-[#fdebd0] pb-16">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={() => navigate({ to: "/recharge" })} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">Complete Payment</div>
        <Link to="/orders" className="text-sm text-foreground/80">Record</Link>
      </div>

      {status === "approved" ? (
        <div className="px-4 pt-6">
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <div className="mt-3 text-lg font-bold">Payment confirmed</div>
            <p className="mt-1 text-sm text-muted-foreground">{formatNaira(amount)} has been credited to your wallet.</p>
            <Button onClick={() => navigate({ to: "/" })} className="mt-4 h-12 w-full rounded-full bg-emerald-600 hover:bg-emerald-700">Go to dashboard</Button>
          </div>
        </div>
      ) : status === "rejected" ? (
        <div className="px-4 pt-6">
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <XCircle className="mx-auto h-14 w-14 text-red-600" />
            <div className="mt-3 text-lg font-bold">Payment rejected</div>
            <p className="mt-1 text-sm text-muted-foreground">This payment could not be verified. Please make a new payment.</p>
            <Button onClick={() => navigate({ to: "/recharge" })} className="mt-4 h-12 w-full rounded-full bg-emerald-600 hover:bg-emerald-700">Make a new payment</Button>
          </div>
        </div>
      ) : (
        <>
          {step === 1 ? (
            <>
              <div className="px-4 pt-3">
                <div className="rounded-2xl bg-[#0b2f26] p-5 text-white shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-emerald-300">
                    <Landmark className="h-4 w-4" /> Virtual account generated
                  </div>
                  <div className="mt-3 text-3xl font-extrabold tracking-wide">{formatNaira(amount)}</div>
                  <div className="mt-1 text-xs text-white/60">Transfer this exact amount</div>

                  <div className="mt-4 space-y-2 rounded-xl bg-white/10 p-3">
                    <Row
                      label="Account number"
                      value={cfg?.account_number ?? "—"}
                      onCopy={() => { copy(cfg?.account_number ?? "", "Account number"); setCopiedAccount(true); }}
                      big
                    />
                    <Row label="Bank name" value={cfg?.bank_name ?? "—"} onCopy={() => copy(cfg?.bank_name ?? "", "Bank name")} />
                    <Row label="Account name" value={cfg?.account_name ?? "—"} onCopy={() => copy(cfg?.account_name ?? "", "Account name")} />
                    <Row label="Reference" value={reference} onCopy={() => copy(reference, "Reference")} />
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-white/60">
                    This account is reserved for this transaction only. Do not reuse it for future payments.
                  </p>
                </div>
              </div>

              {cfg?.note && (
                <div className="px-4 pt-4">
                  <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 whitespace-pre-wrap break-words">{cfg.note}</div>
                </div>
              )}

              <div className="px-4 pt-4">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!copiedAccount}
                  className="h-12 w-full rounded-full bg-emerald-600 text-base font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  I have made the payment
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {copiedAccount ? "Tap to continue and get your payment token." : "Copy the account number first to continue."}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="px-4 pt-3">
                <div className="rounded-2xl bg-[#0b2f26] p-4 text-white shadow-sm">
                  <div className="text-xs text-white/60">Amount paid</div>
                  <div className="text-2xl font-extrabold">{formatNaira(amount)}</div>
                  <div className="mt-1 text-xs text-white/60">Reference: {reference}</div>
                </div>
              </div>

              <div className="px-4 pt-4">
  <div className="rounded-2xl bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2 text-base font-bold">
      <Send className="h-5 w-5 text-sky-500" /> Step 2 — Get your payment token
    </div>
    <p className="mt-1 text-sm text-muted-foreground">
      Email our support team to receive your payment token.
    </p>
    <Button
      asChild
      className="mt-3 h-12 w-full rounded-full bg-sky-500 text-sm font-semibold text-white hover:bg-sky-600"
    >
      <a href__={emailLink}><Send className="mr-2 h-4 w-4" /> Email support</a>
    </Button>
  </div>
</div>

              <div className="px-4 pt-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-base font-bold">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" /> Step 3 — Enter payment token
                  </div>
                  <Input
                    value={token}
                    onChange={(e) => setToken(e.target.value.toUpperCase())}
                    placeholder="e.g. A1B2C3D4"
                    className="mt-3 h-12 text-center text-lg font-bold tracking-[0.3em]"
                  />
                  <Button onClick={submitToken} disabled={busy} className="mt-3 h-12 w-full rounded-full bg-emerald-600 hover:bg-emerald-700">
                    {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : "Confirm Payment"}
                  </Button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Your wallet is credited instantly once the token is verified.
                  </p>
                </div>
              </div>

              <div className="px-4 pt-4">
                <button onClick={() => setStep(1)} className="w-full text-center text-sm text-muted-foreground underline">
                  Back to account details
                </button>
              </div>
            </>
          )}
        </>

      )}
    </div>
  );
}

function Row({ label, value, onCopy, big }: { label: string; value: string; onCopy: () => void; big?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-white/50">{label}</div>
        <div className={`break-all font-semibold ${big ? "text-xl tracking-wider" : "text-sm"}`}>{value}</div>
      </div>
      <button onClick={onCopy} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15" aria-label={`Copy ${label}`}>
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}
