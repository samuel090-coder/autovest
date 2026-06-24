import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Info, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SupportBadge } from "@/components/support-badge";

export const Route = createFileRoute("/recharge")({
  head: () => ({ meta: [{ title: "Recharge — InvestPro" }] }),
  component: RechargePage,
});

type RechargeSettings = {
  presets?: number[];
  bonus_map?: Record<string, string | number>;
  instructions?: string;
};

function RechargePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<string>("66000");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return navigate({ to: "/auth" });
      setUserId(data.session.user.id);
      supabase
        .from("profiles")
        .select("phone")
        .eq("id", data.session.user.id)
        .maybeSingle()
        .then(({ data: p }) => setPhone(p?.phone ?? ""));
    });
  }, [navigate]);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", userId!).maybeSingle()).data,
  });

  const { data: settings } = useQuery({
    queryKey: ["recharge-settings"],
    queryFn: async (): Promise<RechargeSettings> => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "recharge").maybeSingle();
      return (data?.value as RechargeSettings) ?? {};
    },
  });

  const { data: paystackCfg } = useQuery({
    queryKey: ["paystack-cfg"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "paystack").maybeSingle();
      return (data?.value as { enabled?: boolean; public_key?: string; mode?: string }) ?? {};
    },
  });

  const presets = settings?.presets ?? [];
  const bonusMap = settings?.bonus_map ?? {};
  const instructions = settings?.instructions ?? "";

  // Inject Paystack inline script once
  useEffect(() => {
    if (!paystackCfg?.enabled) return;
    if (document.getElementById("paystack-inline")) return;
    const s = document.createElement("script");
    s.id = "paystack-inline";
    s.src = "https://js.paystack.co/v2/inline.js";
    s.async = true;
    document.head.appendChild(s);
  }, [paystackCfg?.enabled]);

  // (removed manual-transfer submission — Paystack is the only method)
  const submit = useMutation({ mutationFn: async () => {}, onSuccess: () => {}, onError: () => {} });
  void submit;

  async function payWithPaystack() {
    if (!userId) return navigate({ to: "/auth" });
    if (!paystackCfg?.public_key || !paystackCfg.public_key.startsWith("pk_")) {
      return toast.error("Payments not configured yet. Please contact support.");
    }
    const amt = Number(amount);
    if (!amt || amt < 100) return toast.error("Enter at least ₦100");
    const { data: prof } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
    const email = prof?.email || `${userId}@investpro.local`;
    // 1) create pending tx
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({ user_id: userId, type: "recharge", amount: amt, status: "pending", meta: { method: "paystack" } })
      .select("id").single();
    if (txErr || !tx) return toast.error(txErr?.message ?? "Could not start payment");
    // 2) open inline
    const w = window as any;
    if (!w.PaystackPop) return toast.error("Paystack script not loaded yet — try again");
    const popup = new w.PaystackPop();
    popup.newTransaction({
      key: paystackCfg.public_key,
      email,
      amount: amt * 100,
      currency: "NGN",
      metadata: { user_id: userId, transaction_id: tx.id },
      onSuccess: () => {
        toast.success("Payment received — wallet will update shortly");
        qc.invalidateQueries({ queryKey: ["wallet"] });
        setTimeout(() => navigate({ to: "/" }), 1500);
      },
      onCancel: () => toast.info("Payment cancelled"),
    });
  }

  const headerBg = useMemo(() => "bg-gradient-to-b from-[#fdf6e8] to-[#fdebd0]", []);

  return (
    <div className={`min-h-screen ${headerBg} pb-32`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={() => history.back()} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">Recharge</div>
        <Link to="/orders" className="text-sm text-foreground/80">Record</Link>
      </div>

      {/* Phone + balance card */}
      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-[#fce0a0] p-4 shadow-sm">
          <div className="text-sm font-medium">Phone number</div>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-white px-3 py-3 shadow-inner">
            <span className="text-[#a14a1a] font-semibold">+234</span>
            <span className="text-xl font-bold text-[#7a2e0e] tracking-wide flex-1">{phone || "—"}</span>
            <Phone className="h-5 w-5 text-[#a14a1a]" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm">
              Balance(₦):{" "}
              <span className="text-lg font-bold">{Number(wallet?.balance ?? 0).toLocaleString()}</span>
            </div>
            <Link to="/orders" className="rounded-full bg-white px-3 py-1 text-sm font-medium shadow-sm">
              Bill ›
            </Link>
          </div>
        </div>
      </div>

      {/* Amount grid */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-[#fce0a0]/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Info className="h-4 w-4" /> Recharge amount
          </div>
          <div className="grid grid-cols-3 gap-3">
            {presets.map((p) => {
              const bonus = bonusMap[String(p)];
              const active = String(p) === amount;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={`relative rounded-lg border bg-white py-4 text-base font-bold transition ${
                    active ? "border-red-500 text-red-600" : "border-transparent text-foreground"
                  }`}
                >
                  {bonus != null && (
                    <span
                      className={`absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${
                        active ? "bg-red-500" : "bg-muted-foreground"
                      }`}
                    >
                      {bonus}
                    </span>
                  )}
                  {Number(p).toLocaleString()}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-4 py-3">
            <span className="text-lg font-bold text-foreground">₦</span>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              className="border-0 px-0 text-lg font-bold text-red-600 focus-visible:ring-0"
            />
          </div>
        </div>
      </div>

      {/* Paystack-only info card */}
      <div className="px-4 pt-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-base font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-white">P</span>
            Paystack — secure payment
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            We accept payments via Paystack. You can pay using your <b>bank card (Visa / Mastercard / Verve)</b> <i>or</i> via <b>bank transfer</b> — Paystack will show you both options on the payment page. Funds reflect instantly after confirmation.
          </p>
          {!paystackCfg?.enabled || !paystackCfg?.public_key ? (
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Payments are temporarily disabled. Please contact support.
            </div>
          ) : null}
        </div>
      </div>

      {/* Instructions */}
      {instructions && (
        <div className="px-4 pt-5">
          <div className="text-base font-bold">Notes:</div>
          <div className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{instructions}</div>
        </div>
      )}

      {/* Sticky CTA — Paystack only */}
      <div className="fixed inset-x-0 bottom-0 z-30 space-y-2 border-t bg-white px-4 py-3 shadow-lg">
        <Button
          onClick={payWithPaystack}
          disabled={!paystackCfg?.enabled || !paystackCfg?.public_key}
          className="h-14 w-full rounded-full bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {paystackCfg?.enabled && paystackCfg?.public_key
            ? `Pay ₦${Number(amount || 0).toLocaleString()} — Card or Bank Transfer`
            : "Payments unavailable"}
        </Button>
      </div>

      <SupportBadge />
    </div>
  );
}
