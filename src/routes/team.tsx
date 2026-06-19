import { createFileRoute } from "@tanstack/react-router";
import { AppShell, BottomNav } from "@/components/app-shell";
import { SupportBadge } from "@/components/support-badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "My Team — InvestPro" }] }),
  component: Team,
});

function Team() {
  const [code, setCode] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("referral_code").eq("id", data.user.id).maybeSingle();
      setCode(p?.referral_code ?? "");
    });
  }, []);
  return (
    <AppShell>
      <header className="px-4 pt-4"><h1 className="text-xl font-bold">My Team</h1></header>
      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-brand p-5 text-white">
          <div className="text-sm opacity-80">Your referral code</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl font-bold tracking-widest">{code || "—"}</span>
            <button onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied"); }} className="rounded-md bg-white/15 p-2"><Copy className="h-4 w-4" /></button>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">Share your code. Earn from your team's investments.</p>
      </div>
      <SupportBadge />
      <BottomNav />
    </AppShell>
  );
}
