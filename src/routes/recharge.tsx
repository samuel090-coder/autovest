import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Info, Mail, LifeBuoy, Upload, Loader2, Landmark } from "lucide-react";
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
  head: () => ({
    meta: [
      { title: "Recharge Wallet — InvestPro" },
      { name: "description", content: "Fund your InvestPro wallet with a secure bank transfer to your generated virtual account." },
      { property: "og:title", content: "Recharge Wallet — InvestPro" },
      { property: "og:description", content: "Fund your InvestPro wallet with a secure bank transfer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RechargePage,
});

type RechargeSettings = {
  presets?: number[];
  bonus_map?: Record<string, string | number>;
  instructions?: string;
};

function RechargePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState<string>("66000");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.session.user.id);
      supabase
        .from("profiles")
        .select("email")
        .eq("id", data.session.user.id)
        .maybeSingle()
        .then(({ data: p }) => setEmail(p?.email ?? ""));
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

  const presets = settings?.presets ?? [];
  const bonusMap = settings?.bonus_map ?? {};
  const instructions = settings?.instructions ?? "";

  async function startPayment() {
    if (!userId) return navigate({ to: "/auth" });
    const amt = Number(amount);
    if (!amt || amt < 100) return toast.error("Enter at least ₦100");
    setStarting(true);
    try {
      const { data: tx, error } = await supabase
        .from("transactions")
        .insert({ user_id: userId, type: "recharge", amount: amt, status: "pending", meta: { method: "bank_transfer" } })
        .select("id")
        .single();
      if (error || !tx) throw new Error(error?.message ?? "Could not start payment");
      navigate({ to: "/payment/$id", params: { id: tx.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Could not start payment");
    } finally {
      setStarting(false);
    }
  }

  const headerBg = useMemo(() => "bg-gradient-to-b from-[#fdf6e8] to-[#fdebd0]", []);

  return (
    <div className={`min-h-screen ${headerBg} pb-32`}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={() => history.back()} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">Recharge</div>
        <Link to="/orders" className="text-sm text-foreground/80">Record</Link>
      </div>

      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-[#fce0a0] p-4 shadow-sm">
          <div className="text-sm font-medium">Email address</div>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-white px-3 py-3 shadow-inner">
            <span className="flex-1 break-all text-lg font-bold tracking-wide text-[#7a2e0e]">{email || "—"}</span>
            <Mail className="h-5 w-5 shrink-0 text-[#a14a1a]" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm">
              Balance(₦): <span className="text-lg font-bold">{Number(wallet?.balance ?? 0).toLocaleString()}</span>
            </div>
            <Link to="/orders" className="rounded-full bg-white px-3 py-1 text-sm font-medium shadow-sm">Bill ›</Link>
          </div>
        </div>
      </div>

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

      <div className="px-4 pt-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-base font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-white">
              <Landmark className="h-4 w-4" />
            </span>
            Bank Transfer — Virtual Account
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Tap continue and we will generate a virtual account number for your deposit. Transfer the exact amount, then get your
            payment token from our support team on Telegram to confirm the deposit instantly.
          </p>
        </div>
      </div>

      {instructions && (
        <div className="px-4 pt-5">
          <div className="text-base font-bold">Notes:</div>
          <div className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{instructions}</div>
        </div>
      )}

      <ComplaintSection userId={userId} />

      <div className="fixed inset-x-0 bottom-0 z-30 space-y-2 border-t bg-white px-4 py-3 shadow-lg">
        <Button
          onClick={startPayment}
          disabled={starting}
          className="h-14 w-full rounded-full bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {starting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Preparing…</> : `Pay ₦${Number(amount || 0).toLocaleString()} — Bank Transfer`}
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
        screenshot_url = await uploadAndGetUrl("complaint-proofs", file, `${userId}/${crypto.randomUUID()}.${ext}`);
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
              <Input inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 66000" />
            </div>
            <div>
              <Label>Describe the issue</Label>
              <Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="When did you pay? Which method? Any transaction reference?" />
            </div>
            <div>
              <Label>Payment screenshot (optional but recommended)</Label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm hover:bg-muted/50">
                <Upload className="h-4 w-4" />
                <span className="truncate">{file ? file.name : "Choose image…"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
