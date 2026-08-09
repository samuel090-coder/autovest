import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, X } from "lucide-react";

const KEY = "invest_reminder_at";
const EVERY_MS = 30 * 60 * 1000; // at most once every 30 minutes
const HIDDEN_ON = ["/auth", "/admin", "/payment", "/recharge"];

/** Occasional friendly reminder that the user can invest and earn daily. */
export function InvestReminder() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (HIDDEN_ON.some((p) => path.startsWith(p))) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      const last = Number(window.localStorage.getItem(KEY) ?? 0);
      if (Date.now() - last < EVERY_MS) return;
      window.localStorage.setItem(KEY, String(Date.now()));
      setOpen(true);
    }, 12000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [path]);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-24 z-[118] flex justify-center px-3">
      <div className="w-full max-w-sm animate-[ib-up_320ms_cubic-bezier(0.22,1,0.36,1)] overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-red-500 p-[2px] shadow-2xl">
        <div className="relative rounded-[14px] bg-card p-4">
          <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-muted">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0 pr-6">
              <div className="text-sm font-bold">Your money can be working right now</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Pick any investment product and start earning daily income automatically — every day, straight to your balance.
              </p>
              <div className="mt-3 flex gap-2">
                <Link to="/" onClick={() => setOpen(false)} className="rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white">
                  View products
                </Link>
                <button onClick={() => setOpen(false)} className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes ib-up { from { transform: translateY(24px); opacity:0 } to { transform: translateY(0); opacity:1 } }`}</style>
    </div>
  );
}
