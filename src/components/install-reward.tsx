import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { isStandalone, getDeviceId } from "@/lib/device";
import { Smartphone, X, PartyPopper } from "lucide-react";

type Res = { ok?: boolean; amount?: number; error?: string };

/** Credits ₦100 once when the user installs the web app to their phone. */
export function InstallReward() {
  const qc = useQueryClient();
  const [won, setWon] = useState<number | null>(null);
  const [prompt, setPrompt] = useState<null | { install: () => void }>(null);

  useEffect(() => {
    let cancelled = false;

    async function claim() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || cancelled) return;
      const { data } = await supabase.rpc("claim_install_bonus", { _device_id: getDeviceId() ?? undefined });
      const res = (data ?? {}) as Res;
      if (res.ok && !cancelled) {
        setWon(Number(res.amount ?? 100));
        qc.invalidateQueries({ queryKey: ["wallet"] });
      }
    }

    if (isStandalone()) void claim();

    const onInstalled = () => void claim();
    window.addEventListener("appinstalled", onInstalled);

    const onBip = (e: Event) => {
      e.preventDefault();
      const ev = e as Event & { prompt: () => Promise<void> };
      setPrompt({ install: () => void ev.prompt() });
    };
    window.addEventListener("beforeinstallprompt", onBip);

    return () => {
      cancelled = true;
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("beforeinstallprompt", onBip);
    };
  }, [qc]);

  if (won !== null) {
    return (
      <div className="fixed inset-x-0 top-0 z-[128] flex justify-center p-3">
        <div className="w-full max-w-sm animate-[ir-drop_450ms_cubic-bezier(0.22,1,0.36,1)] rounded-2xl bg-gradient-to-br from-brand to-red-500 p-[2px] shadow-2xl">
          <div className="relative rounded-[14px] bg-card p-4">
            <button onClick={() => setWon(null)} aria-label="Close" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-muted">
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-brand/10 text-brand">
                <PartyPopper className="h-6 w-6" />
              </div>
              <div className="pr-6">
                <div className="text-sm font-bold text-brand">App installed — ₦{won} credited!</div>
                <p className="mt-0.5 text-xs text-muted-foreground">Thanks for installing AutoVest. Your reward has been added to your real balance.</p>
              </div>
            </div>
          </div>
        </div>
        <style>{`@keyframes ir-drop { from { transform: translateY(-120%); opacity:0 } to { transform: translateY(0); opacity:1 } }`}</style>
      </div>
    );
  }

  if (!prompt) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-[120] flex justify-center px-3">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-card p-3 shadow-xl">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold">Install the app, get ₦100</div>
          <p className="text-[11px] text-muted-foreground">Add AutoVest to your home screen and we credit ₦100 instantly.</p>
        </div>
        <button onClick={prompt.install} className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white">
          Install
        </button>
        <button onClick={() => setPrompt(null)} aria-label="Dismiss" className="shrink-0 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
