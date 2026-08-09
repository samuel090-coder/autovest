import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Gift } from "lucide-react";

const HIDDEN_ON = ["/auth", "/admin", "/payment"];

/** Beeping corner badge that pulls attention to the Earn More offers page. */
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
      className="fixed bottom-36 right-3 z-[110] flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-brand px-3 py-2 text-xs font-bold text-white shadow-xl"
    >
      <span className="absolute -inset-1 -z-10 animate-ping rounded-full bg-amber-400/50" />
      <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20">
        <Gift className="h-3.5 w-3.5" />
      </span>
      Earn ₦500,000
      <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-red-600 ring-2 ring-white" />
    </Link>
  );
}
