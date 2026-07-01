import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Top-of-site LED-style marquee showing recent withdrawal notifications.
 * Scrolls smoothly right-to-left in a continuous loop like a stock ticker /
 * live LED sign. Hidden on /auth, /admin and /api routes.
 */
export function LiveCreditAlerts() {
  const [show, setShow] = useState(false);

  const { data: proofs = [] } = useQuery({
    queryKey: ["live-credit-proofs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawal_proofs")
        .select("phone_masked, amount, caption, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    refetchInterval: 120_000,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = window.location.pathname;
    if (p.startsWith("/auth") || p.startsWith("/admin") || p.startsWith("/api")) return;
    setShow(true);
  }, []);

  if (!show || proofs.length === 0) return null;

  // Duplicate so the marquee loops seamlessly
  const items = [...proofs, ...proofs];
  // Faster, more professional pace
  const durationSec = Math.max(18, proofs.length * 2.2);

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[70] overflow-hidden border-b border-emerald-900/40 bg-gradient-to-r from-emerald-950 via-emerald-800 to-emerald-950 shadow-md"
      role="status"
      aria-live="polite"
      style={{ height: 30 }}
    >
      <div
        className="flex h-full items-center gap-8 whitespace-nowrap will-change-transform"
        style={{ animation: `led-scroll ${durationSec}s linear infinite` }}
      >
        {items.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px] font-semibold">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />
            <span className="text-emerald-100">{p.phone_masked}</span>
            <span className="text-yellow-300">just withdrew</span>
            <span className="text-white">₦{Number(p.amount).toLocaleString()}</span>
            <span className="text-emerald-200/90 italic">— {p.caption}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes led-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
