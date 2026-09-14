import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Gift, Rocket } from "lucide-react";

/**
 * Shown once to a user who registered through someone's referral link.
 * Purely presentational — reads the referrer via a secure, self-scoped RPC.
 */
export function ReferredWelcome() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const key = `referred-welcome:${uid}`;
      if (localStorage.getItem(key)) return;
      const { data } = await (supabase as any).rpc("get_my_referrer");
      const ref = data as { name?: string } | null;
      if (cancelled || !ref?.name) return;
      setName(ref.name);
      setOpen(true);
      localStorage.setItem(key, "1");
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-[380px] overflow-hidden rounded-3xl border-0 p-0 duration-300 animate-in zoom-in-95"
      >

        <DialogTitle className="sr-only">You've been referred</DialogTitle>

        <div className="relative bg-gradient-to-br from-brand via-red-600 to-orange-500 px-5 pb-8 pt-7 text-center text-white">

          <span className="mx-auto grid h-16 w-16 animate-bounce place-items-center rounded-full bg-white/20 backdrop-blur">
            <Gift className="h-8 w-8" />
          </span>
          <div className="mt-4 text-2xl font-extrabold leading-tight">You've Been Referred! 🎉</div>
          <p className="mt-2 text-sm text-white/90">
            You joined through <span className="font-bold">{name}</span>'s referral link.
          </p>
        </div>

        <div className="space-y-4 px-5 pb-6 pt-5 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Start your investment journey today. Make your first deposit and start working toward your earning goals —
            daily income, bonuses and instant withdrawals.
          </p>
          <Link
            to="/recharge"
            onClick={() => setOpen(false)}
            className="bg-brand flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-bold text-white shadow-lg active:scale-[.98]"
          >
            <Rocket className="h-5 w-5" /> Deposit &amp; Invest
          </Link>
          <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
