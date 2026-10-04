import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Full-screen block for users an admin has restricted. Support chat stays reachable. */
export function RestrictionGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [info, setInfo] = useState<{ reason: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) { if (active) setInfo(null); return; }
      const { data: p } = await supabase.from("profiles").select("restricted_at, restricted_reason").eq("id", uid).maybeSingle();
      if (active) setInfo(p?.restricted_at ? { reason: p.restricted_reason } : null);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT") check(); });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [pathname]);

  if (!info || pathname.startsWith("/chat") || pathname.startsWith("/auth")) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-background/95 px-6 backdrop-blur">
      <div className="max-w-sm text-center">
        <ShieldAlert className="mx-auto h-14 w-14 text-destructive" />
        <h1 className="mt-4 text-xl font-bold">Your account is restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access to your account has been paused by our team. Please contact support to restore access.
        </p>
        {info.reason && <p className="mt-3 rounded-md bg-muted p-2 text-sm">Reason: {info.reason}</p>}
        <Button asChild className="mt-5 w-full"><Link to="/chat">Contact support</Link></Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      </div>
    </div>
  );
}
