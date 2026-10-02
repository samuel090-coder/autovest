import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Gift, ChevronRight } from "lucide-react";

const HIDDEN_ON = ["/auth", "/admin", "/payment"];

/** Signed-in offer ticker displayed across the top of user-facing pages. */
export function OfferBadge() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [show, setShow] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setShow(!!data.session));
  }, []);

  if (!show || HIDDEN_ON.some((p) => path.startsWith(p))) return null;

  return (
    <Link
      to="/earn-more"
      aria-label="Earn more offers"
      className="group fixed inset-x-0 top-0 z-[110] block h-[30px] overflow-hidden border-b border-offer-border bg-offer text-offer-foreground shadow-sm"
    >
      <span className="absolute inset-y-0 left-0 z-10 grid w-9 place-items-center bg-offer text-offer-highlight shadow-[6px_0_14px_var(--offer)]">
        <Gift className="h-4 w-4 animate-pulse" />
      </span>
      <span className="offer-led-track flex h-full w-max items-center whitespace-nowrap pl-10 pr-12 text-[11px] font-extrabold uppercase">
        {[0, 1, 2, 3].map((item) => (
          <span key={item} className="mr-14 flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-offer-highlight shadow-[0_0_8px_var(--offer-highlight)]" />
            Earn up to ₦500,000 — Tap to see active offers
          </span>
        ))}
      </span>
      <span className="absolute inset-y-0 right-0 z-10 grid w-9 place-items-center bg-offer text-offer-highlight shadow-[-6px_0_14px_var(--offer)]">
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
