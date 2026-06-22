import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Info, Phone, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SupportBadge } from "@/components/support-badge";

export const Route = createFileRoute("/recharge")({
  head: () => ({ meta: [{ title: "Recharge — InvestPro" }] }),
  component: RechargePage,
});

type Channel = { name: string; bank?: string; account_name?: string; account_number?: string; color?: string };
type RechargeSettings = {
  presets?: number[];
  bonus_map?: Record<string, string | number>;
  instructions?: string;
  channels?: Channel[];
};

function RechargePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<string>("66000");
  const [selectedChannel, setSelectedChannel] = useState(0);

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
  const channels = settings?.channels ?? [];
  const instructions = settings?.instructions ?? "";

  const channel = channels[selectedChannel];

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

  const submit = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const amt = Number(amount);
      if (!amt || amt < 1) throw new Error("Enter a valid amount");
      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        type: "recharge",
        amount: amt,
        status: "pending",
        meta: { channel: channel?.name ?? null, account_number: channel?.account_number ?? null },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Top-up request submitted. Funds will reflect after confirmation.");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function payWithPaystack() {
    if (!userId) return navigate({ to: "/auth" });
    if (!paystackCfg?.public_key) return toast.error("Paystack not configured");
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

      {/* Payment channels */}
      <div className="px-4 pt-5">
        <h3 className="mb-2 text-base font-bold">Payment Channel</h3>
        <div className="space-y-2">
          {channels.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedChannel(i)}
              className={`flex w-full items-center justify-between rounded-xl border-2 bg-white p-3 text-left ${
                selectedChannel === i ? "border-red-500" : "border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full text-white font-bold" style={{ background: c.color ?? "#e53935" }}>
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold">{c.name}</div>
                  {c.bank && <div className="text-xs text-muted-foreground">{c.bank}</div>}
                </div>
              </div>
              {selectedChannel === i && c.account_number && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="font-mono">{c.account_number}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(c.account_number!);
                      toast.success("Account number copied");
                    }}
                    className="rounded p-1 hover:bg-muted"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selected account details */}
      {channel && channel.account_number && (
        <div className="px-4 pt-3">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">Transfer to:</div>
            <div className="mt-1 text-sm">
              <div><span className="font-semibold">Bank:</span> {channel.bank}</div>
              <div><span className="font-semibold">Account name:</span> {channel.account_name}</div>
              <div className="font-mono text-base font-bold">{channel.account_number}</div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {instructions && (
        <div className="px-4 pt-5">
          <div className="text-base font-bold">Top-up Steps:</div>
          <div className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{instructions}</div>
        </div>
      )}

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 space-y-2 border-t bg-white px-4 py-3 shadow-lg">
        {paystackCfg?.enabled && paystackCfg?.public_key && (
          <Button onClick={payWithPaystack} className="h-12 w-full rounded-full bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700">
            Pay with card (Paystack) — ₦{Number(amount || 0).toLocaleString()}
          </Button>
        )}
        <Button
          onClick={() => submit.mutate()}
          disabled={submit.isPending}
          className="h-14 w-full rounded-full bg-gradient-to-r from-[#f5b740] to-[#e88a1a] text-base font-bold text-black hover:opacity-95"
        >
          {submit.isPending ? "Submitting…" : "Confirm manual transfer"}
        </Button>
      </div>

      <SupportBadge />
    </div>
  );
}
