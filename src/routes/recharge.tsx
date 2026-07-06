import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Info, Phone, LifeBuoy, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SupportBadge } from "@/components/support-badge";
import { uploadAndGetUrl } from "@/lib/storage";
import { formatNaira } from "@/lib/format";

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

      {/* Payment complaint / support */}
      <ComplaintSection userId={userId} />


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

function ComplaintSection({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: mine = [] } = useQuery({
    queryKey: ["my-complaints", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("payment_complaints")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  async function submit() {
    if (!userId) return;
    const amount = Number(amt);
    if (!amount || amount < 100) return toast.error("Enter the amount you paid (₦100+)");
    if (!desc.trim() || desc.trim().length < 10) return toast.error("Please describe the issue (min 10 chars)");
    setBusy(true);
    try {
      let screenshot_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "jpg";
        screenshot_url = await uploadAndGetUrl(
          "complaint-proofs",
          file,
          `${userId}/${crypto.randomUUID()}.${ext}`,
        );
      }
      const { error } = await (supabase as any).from("payment_complaints").insert({
        user_id: userId,
        amount,
        description: desc.trim(),
        screenshot_url,
      });
      if (error) throw error;
      toast.success("Complaint submitted — support will review shortly");
      setOpen(false);
      setAmt(""); setDesc(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["my-complaints"] });
    } catch (e: any) {
      toast.error(e.message ?? "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pt-5">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-base font-bold">
          <LifeBuoy className="h-5 w-5 text-emerald-600" />
          Payment not credited?
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          If you made a payment but your wallet was not credited, send us the details and a screenshot. Our team will verify and credit you manually.
        </p>
        <Button
          onClick={() => setOpen(true)}
          disabled={!userId}
          className="mt-3 h-11 w-full rounded-full bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <LifeBuoy className="mr-2 h-4 w-4" /> Contact Support About a Payment
        </Button>

        {mine.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your recent complaints</div>
            {mine.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{formatNaira(c.amount)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  c.status === "resolved" ? "bg-emerald-100 text-emerald-700"
                  : c.status === "rejected" ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report Payment Issue</DialogTitle>
            <DialogDescription>Provide details so admin can verify and credit your wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount paid (₦)</Label>
              <Input
                inputMode="numeric"
                value={amt}
                onChange={(e) => setAmt(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 66000"
              />
            </div>
            <div>
              <Label>Describe the issue</Label>
              <Textarea
                rows={4}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="When did you pay? Which method? Any transaction reference?"
              />
            </div>
            <div>
              <Label>Payment screenshot (optional but recommended)</Label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm hover:bg-muted/50">
                <Upload className="h-4 w-4" />
                <span className="truncate">{file ? file.name : "Choose image…"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <Button onClick={submit} disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : "Submit Complaint"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
