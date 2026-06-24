import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

/**
 * Floating live credit-alert toast on the left/side of the screen.
 * Cycles through the latest withdrawal_proofs entries, one every 6-10s.
 * Hides on /auth, /admin and /api routes.
 */
export function LiveCreditAlerts() {
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  const { data: proofs = [] } = useQuery({
    queryKey: ["live-credit-proofs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawal_proofs")
        .select("phone_masked, amount, caption, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      return data ?? [];
    },
    refetchInterval: 120_000,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = window.location.pathname;
    if (p.startsWith("/auth") || p.startsWith("/admin") || p.startsWith("/api")) return;
    if (proofs.length === 0) return;
    setShow(true);
    const tick = () => setIdx((i) => (i + 1) % proofs.length);
    const t = setInterval(tick, 6000 + Math.floor(Math.random() * 4000));
    return () => clearInterval(t);
  }, [proofs.length]);

  if (!show || dismissed || proofs.length === 0) return null;
  const p = proofs[idx];
  const seconds = Math.max(8, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 1000));
  const ago = seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;

  return (
    <div
      className="pointer-events-auto fixed left-2 top-24 z-[80] max-w-[78vw] sm:max-w-xs animate-in slide-in-from-left-2 fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-start gap-2 rounded-xl bg-white/95 p-2.5 pr-7 shadow-lg ring-1 ring-black/10 backdrop-blur">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-lg">💸</div>
        <div className="min-w-0 flex-1 text-[12px] leading-tight">
          <div className="truncate font-semibold text-foreground">@{p.phone_masked}</div>
          <div className="font-bold text-emerald-700">
            Withdrawal of ₦{Number(p.amount).toLocaleString()} successful!
          </div>
          <div className="text-[10px] text-muted-foreground">{ago}</div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
