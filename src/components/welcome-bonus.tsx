import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fireCongrats } from "@/components/congrats-popup";

const BALLOON_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6"];

/** Shows a one-time ₦500 welcome bonus celebration for brand-new users. */
export function WelcomeBonusPopup({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const { data: claimed } = useQuery({
    queryKey: ["welcome-bonus", userId],
    enabled: !!userId,
    queryFn: async () =>
      (await supabase.from("wallets").select("welcome_bonus_claimed").eq("user_id", userId!).maybeSingle()).data
        ?.welcome_bonus_claimed ?? true,
  });

  if (!userId || dismissed || claimed !== false) return null;

  async function claim() {
    setClaiming(true);
    const { error } = await supabase.rpc("claim_welcome_bonus");
    setClaiming(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDismissed(true);
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["welcome-bonus"] });
    fireCongrats({
      title: "Welcome aboard! 🎈",
      subtitle: "Your ₦500 welcome bonus has been added to your balance",
      amount: 500,
    });
  }

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center overflow-hidden bg-black/60 px-4 backdrop-blur-sm">
      {/* Floating balloons */}
      {Array.from({ length: 14 }).map((_, i) => {
        const color = BALLOON_COLORS[i % BALLOON_COLORS.length];
        return (
          <span
            key={i}
            className="pointer-events-none absolute bottom-[-140px]"
            style={{
              left: `${(i * 7 + 4) % 96}%`,
              animation: `wb-float ${6000 + ((i * 733) % 4000)}ms linear ${(i * 420) % 3000}ms infinite`,
            }}
          >
            <span
              className="block h-12 w-9 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] shadow-lg"
              style={{ background: color }}
            />
            <span className="mx-auto block h-10 w-px bg-white/50" />
          </span>
        );
      })}

      <div className="relative w-full max-w-xs animate-[wb-pop_500ms_cubic-bezier(0.22,1,0.36,1)] rounded-3xl bg-gradient-to-b from-brand to-red-600 p-1 shadow-2xl">
        <div className="rounded-[22px] bg-card px-5 py-6 text-center">
          <div className="text-4xl">🎈🎉🎈</div>
          <h2 className="mt-3 text-xl font-extrabold text-brand">Welcome to InvestPro!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;re excited to have you. Here&apos;s a gift to start your journey today.
          </p>
          <div className="mt-4 rounded-2xl bg-warning/15 py-4">
            <div className="text-xs font-medium text-muted-foreground">Welcome bonus</div>
            <div className="text-4xl font-black text-brand">₦500</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Added straight to your real balance</div>
          </div>
          <button
            onClick={claim}
            disabled={claiming}
            className="mt-5 w-full rounded-full bg-gradient-to-r from-brand to-red-500 py-3 text-sm font-bold text-white shadow-md disabled:opacity-60"
          >
            {claiming ? "Claiming…" : "Claim my ₦500"}
          </button>
          <button onClick={() => setDismissed(true)} className="mt-2 text-xs text-muted-foreground">
            Maybe later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes wb-pop { 0% { transform: scale(0.7); opacity: 0 } 60% { transform: scale(1.05); opacity: 1 } 100% { transform: scale(1) } }
        @keyframes wb-float { 0% { transform: translateY(0) rotate(-4deg) } 100% { transform: translateY(-130vh) rotate(4deg) } }
      `}</style>
    </div>
  );
}
