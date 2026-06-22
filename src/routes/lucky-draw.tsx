import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SupportBadge } from "@/components/support-badge";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/lucky-draw")({
  head: () => ({ meta: [{ title: "Lucky Draw — InvestPro" }] }),
  component: LuckyDrawPage,
});

function LuckyDrawPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [reward, setReward] = useState<{ amount: number; kind: string } | null>(null);
  const [showReferrer, setShowReferrer] = useState(false);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return navigate({ to: "/auth" });
      const uid = data.session.user.id;
      setUserId(uid);
      const { data: p } = await supabase.from("profiles").select("phone,referral_code").eq("id", uid).maybeSingle();
      setPhone(p?.phone ?? "");
      setReferralCode(p?.referral_code ?? "");
      // ensure draw state exists & referrals are synced
      await supabase.rpc("lucky_sync_referrals");
      qc.invalidateQueries({ queryKey: ["draw-state"] });
    });
  }, [navigate, qc]);

  const { data: state } = useQuery({
    queryKey: ["draw-state", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("lucky_draw_state").select("*").eq("user_id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: rulesText } = useQuery({
    queryKey: ["lucky-rules"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "lucky_draw_rules").maybeSingle();
      return (data?.value as string) ?? "";
    },
  });

  const total = (state?.base_spins ?? 10) + (state?.bonus_spins ?? 0);
  const used = state?.spins_used ?? 0;
  const remaining = Math.max(0, total - used);
  const lottery = Number(state?.lottery_balance ?? 0);
  const goal = Number(state?.goal_amount ?? 100000);
  const pct = Math.min(100, Math.round((lottery / goal) * 100));
  const baseDone = used >= (state?.base_spins ?? 10);

  const spin = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("lucky_spin");
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      const amt = Number(data.amount);
      const turns = 6;
      const stopAt = Math.random() * 360;
      setAngle((a) => a + turns * 360 + stopAt);
      setTimeout(() => {
        setSpinning(false);
        setReward({ amount: amt, kind: data.kind });
        qc.invalidateQueries({ queryKey: ["draw-state"] });
      }, 3200);
    },
    onError: (e: Error) => {
      setSpinning(false);
      toast.error(e.message);
    },
  });

  const claim = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("lucky_claim");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Winnings credited to wallet!");
      qc.invalidateQueries({ queryKey: ["draw-state"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSpin() {
    if (spinning || remaining <= 0) {
      if (baseDone && (state?.bonus_spins ?? 0) === 0) setShowReferrer(true);
      return;
    }
    setSpinning(true);
    spin.mutate();
  }

  function closeReward() {
    setReward(null);
    if (baseDone && remaining === 0) setShowReferrer(true);
  }

  const referralUrl = typeof window !== "undefined" && referralCode
    ? `${window.location.origin}/auth?ref=${referralCode}`
    : "";

  async function shareReferral() {
    if (!referralUrl) return;
    if (navigator.share) {
      try { await navigator.share({ title: "Join InvestPro", text: "Spin the wheel and win 100k!", url: referralUrl }); return; } catch {}
    }
    await navigator.clipboard.writeText(referralUrl);
    toast.success("Referral link copied");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ff3b3b] to-[#a01010] pb-24">
      <div className="flex items-center justify-between px-4 pt-4 text-white">
        <button onClick={() => history.back()} className="grid h-9 w-9 place-items-center rounded-full"><ArrowLeft className="h-5 w-5" /></button>
        <div className="font-semibold">Lucky draw</div>
        <button onClick={shareReferral} className="grid h-9 w-9 place-items-center rounded-full"><Share2 className="h-4 w-4" /></button>
      </div>

      {/* Account card */}
      <div className="px-4 pt-3">
        <div className="relative rounded-2xl bg-[#fff8e8] p-4 shadow-lg">
          <span className="absolute right-0 top-3 rounded-l-full bg-yellow-300 px-3 py-1 text-xs font-bold">My Account</span>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-red-600 text-white text-xs font-bold">IP</div>
            <div className="font-semibold">{phone || "—"}</div>
          </div>
          <div className="mt-2 text-center text-sm text-muted-foreground">Total Rewards:</div>
          <div className="mt-1 flex items-center justify-center gap-3">
            <div className="text-4xl font-extrabold text-red-600">₦{lottery.toLocaleString()}</div>
            <Button
              onClick={() => claim.mutate()}
              disabled={lottery < goal || claim.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
            >
              {claim.isPending ? "…" : "Withdrawal"}
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-bold text-red-600">{pct}%</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-white flex items-center justify-between">
            <span className="text-sm">Earned Rewards</span>
            <span className="font-bold">₦{Number(state?.total_won ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Lottery counter */}
      <div className="mt-5 px-4 text-center">
        <span className="inline-block rounded-lg bg-red-700 px-4 py-1.5 text-sm font-medium text-white shadow">
          Lottery: <b>{remaining}</b> · Goal {formatNaira(goal)}
        </span>
      </div>

      {/* Wheel */}
      <div className="mt-4 grid place-items-center">
        <div className="relative h-72 w-72">
          <div
            className="absolute inset-0 rounded-full border-8 border-yellow-400 shadow-2xl transition-transform ease-out"
            style={{
              transitionDuration: "3s",
              transform: `rotate(${angle}deg)`,
              background: `conic-gradient(#fef08a 0 30deg, #fff 30deg 60deg, #fef08a 60deg 90deg, #fff 90deg 120deg, #fef08a 120deg 150deg, #fff 150deg 180deg, #fef08a 180deg 210deg, #fff 210deg 240deg, #fef08a 240deg 270deg, #fff 270deg 300deg, #fef08a 300deg 330deg, #fff 330deg 360deg)`,
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold text-red-700"
                style={{ transform: `rotate(${i * 30}deg) translateY(-110px)` }}
              >
                💰
              </div>
            ))}
          </div>
          <button
            onClick={onSpin}
            disabled={spinning}
            className="absolute left-1/2 top-1/2 z-10 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-b from-orange-400 to-red-600 text-2xl font-black text-white shadow-2xl ring-4 ring-yellow-300 disabled:opacity-60"
          >
            GO
          </button>
          {/* Pointer */}
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-2">
            <div className="h-0 w-0 border-x-[14px] border-x-transparent border-t-[22px] border-t-red-700" />
          </div>
        </div>
      </div>

      {/* Bottom CTAs */}
      <div className="mt-4 flex items-center justify-center gap-3 px-4">
        <button onClick={() => setShowRules(true)} className="rounded-full border border-white/60 px-5 py-1.5 text-white">Rules</button>
        <Link to="/orders" className="rounded-full border border-white/60 px-5 py-1.5 text-white">Record</Link>
      </div>
      <div className="mt-3 px-4">
        <button onClick={shareReferral} className="flex w-full items-center gap-3 rounded-full bg-zinc-900 px-4 py-3 text-white">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-red-600">→</span>
          <span className="flex-1 text-center font-bold italic">Withdrawal gift package</span>
        </button>
      </div>

      {/* Reward popup */}
      <Dialog open={!!reward} onOpenChange={(v) => !v && closeReward()}>
        <DialogContent className="max-w-xs overflow-hidden bg-gradient-to-b from-red-500 to-orange-400 p-6 text-center text-white">
          <div className="mx-auto h-20 w-20 rounded-full bg-yellow-300 grid place-items-center text-3xl">🎁</div>
          <div className="mt-3 text-lg font-semibold">InvestPro gives you</div>
          <div className="mt-1 text-5xl font-extrabold text-yellow-100">₦{reward?.amount.toLocaleString()}</div>
          <Button onClick={closeReward} className="mt-4 w-full rounded-full bg-gradient-to-r from-pink-500 via-red-500 to-orange-400 py-6 text-base font-bold">
            Click to receive
          </Button>
        </DialogContent>
      </Dialog>

      {/* Referrer prompt */}
      <Dialog open={showReferrer} onOpenChange={setShowReferrer}>
        <DialogContent className="max-w-xs p-6">
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{rulesText}</div>
          <div className="mt-3 rounded-lg border p-2 text-center text-xs break-all">{referralUrl}</div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowReferrer(false)}>Later</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={shareReferral}>Share & earn spin</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rules */}
      <Dialog open={showRules} onOpenChange={setShowRules}>
        <DialogContent className="max-w-sm">
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{rulesText}</div>
          <Button onClick={() => setShowRules(false)} className="w-full bg-red-600 hover:bg-red-700">Confirm</Button>
        </DialogContent>
      </Dialog>

      <SupportBadge />
    </div>
  );
}
