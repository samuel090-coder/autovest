import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { isStandalone } from "@/lib/device";
import { Rocket, Zap, Bell, Home, ShieldCheck, X } from "lucide-react";

export type PwaInstallConfig = {
  enabled: boolean;
  image_url: string;
  title: string;
  description: string;
  install_label: string;
  secondary_enabled: boolean;
  secondary_label: string;
  color_from: string;
  color_to: string;
  button_color: string;
  animate: boolean;
  /** minutes before showing again after a dismiss */
  remind_after_min: number;
  /** ISO datetimes, optional scheduling window */
  start_at: string;
  end_at: string;
};

export const defaultPwaConfig: PwaInstallConfig = {
  enabled: true,
  image_url: "",
  title: "Install the AutoVest App",
  description:
    "Get the full AutoVest experience on your phone — faster loading, instant updates, smoother investing and one-tap access from your home screen.",
  install_label: "Install App",
  secondary_enabled: true,
  secondary_label: "Maybe later",
  color_from: "#dc2626",
  color_to: "#f97316",
  button_color: "#dc2626",
  animate: true,
  remind_after_min: 60,
  start_at: "",
  end_at: "",
};

export function mergePwaConfig(v: unknown): PwaInstallConfig {
  return { ...defaultPwaConfig, ...((v ?? {}) as Partial<PwaInstallConfig>) };
}

const perks = [
  { icon: Zap, label: "Lightning fast" },
  { icon: Bell, label: "Instant updates" },
  { icon: Home, label: "Home screen access" },
  { icon: ShieldCheck, label: "Secure & smooth" },
];

/** Pure presentation — used by the live modal and the admin preview. */
export function PwaInstallCard({
  cfg,
  onInstall,
  onDismiss,
  hint,
}: {
  cfg: PwaInstallConfig;
  onInstall?: () => void;
  onDismiss?: () => void;
  hint?: string;
}) {
  return (
    <div
      className={`w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-black/5 ${
        cfg.animate ? "animate-[pwa-pop_420ms_cubic-bezier(0.22,1,0.36,1)]" : ""
      }`}
    >
      <div
        className="relative h-36 w-full"
        style={{ background: `linear-gradient(135deg, ${cfg.color_from}, ${cfg.color_to})` }}
      >
        {cfg.image_url ? (
          <img src={cfg.image_url} alt={cfg.title} className="h-36 w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div
              className={`grid h-20 w-20 place-items-center rounded-3xl bg-white/20 text-white backdrop-blur ${
                cfg.animate ? "animate-[pwa-float_2.4s_ease-in-out_infinite]" : ""
              }`}
            >
              <Rocket className="h-10 w-10" />
            </div>
          </div>
        )}
        {onDismiss ? (
          <button
            onClick={onDismiss}
            aria-label="Close"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/35 text-white backdrop-blur"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        <div className="space-y-1.5 text-center">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">{cfg.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{cfg.description}</p>
        </div>

        <ul className="grid grid-cols-2 gap-2">
          {perks.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 rounded-xl bg-muted/60 px-2.5 py-2">
              <Icon className="h-4 w-4 shrink-0" style={{ color: cfg.button_color }} />
              <span className="text-[11px] font-semibold leading-tight text-foreground">{label}</span>
            </li>
          ))}
        </ul>

        {hint ? <p className="rounded-xl bg-muted/60 px-3 py-2 text-center text-[11px] text-muted-foreground">{hint}</p> : null}

        <div className="space-y-2">
          <button
            onClick={onInstall}
            className={`h-12 w-full rounded-2xl text-base font-extrabold text-white shadow-lg active:scale-[.98] ${
              cfg.animate ? "animate-[pwa-pulse_2s_ease-in-out_infinite]" : ""
            }`}
            style={{ backgroundColor: cfg.button_color }}
          >
            {cfg.install_label}
          </button>
          {cfg.secondary_enabled ? (
            <button onClick={onDismiss} className="h-10 w-full rounded-2xl text-sm font-semibold text-muted-foreground">
              {cfg.secondary_label}
            </button>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes pwa-pop { from { transform: translateY(18px) scale(.94); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes pwa-float { 0%,100% { transform: translateY(-5px) } 50% { transform: translateY(5px) } }
        @keyframes pwa-pulse { 0%,100% { box-shadow: 0 10px 24px -8px rgba(0,0,0,.35) } 50% { box-shadow: 0 0 0 6px rgba(0,0,0,.06) } }
      `}</style>
    </div>
  );
}

const DISMISS_KEY = "av_pwa_dismissed_at";

type BipEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function PwaInstallModal() {
  const [bip, setBip] = useState<BipEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [iosLike, setIosLike] = useState(false);

  const { data: cfg = defaultPwaConfig } = useQuery({
    queryKey: ["setting", "pwa_install"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "pwa_install").maybeSingle();
      return mergePwaConfig(data?.value);
    },
  });

  const scheduled = useMemo(() => {
    const now = Date.now();
    if (cfg.start_at && now < new Date(cfg.start_at).getTime()) return false;
    if (cfg.end_at && now > new Date(cfg.end_at).getTime()) return false;
    return true;
  }, [cfg.start_at, cfg.end_at]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) { setInstalled(true); return; }

    const ua = navigator.userAgent;
    setIosLike(/iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua));

    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BipEvent);
    };
    const onInstalled = () => { setInstalled(true); setOpen(false); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Decide whether to open (respects dismissal cooldown)
  useEffect(() => {
    if (installed || !cfg.enabled || !scheduled) return;
    if (!bip && !iosLike) return;
    let last = 0;
    try { last = Number(localStorage.getItem(DISMISS_KEY) ?? 0); } catch { /* ignore */ }
    const waitMs = Math.max(0, (cfg.remind_after_min || 0) * 60_000 - (Date.now() - last));
    const t = setTimeout(() => setOpen(true), last ? waitMs : 1200);
    return () => clearTimeout(t);
  }, [bip, iosLike, installed, cfg.enabled, cfg.remind_after_min, scheduled]);

  function dismiss() {
    setOpen(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
  }

  async function install() {
    if (!bip) return; // iOS: keep the instructions visible
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    setBip(null);
    if (outcome === "accepted") setInstalled(true);
    else dismiss();
  }

  if (!open || installed) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <PwaInstallCard
        cfg={cfg}
        onInstall={install}
        onDismiss={dismiss}
        hint={!bip && iosLike ? "On iPhone: tap the Share button, then choose “Add to Home Screen”." : undefined}
      />
    </div>
  );
}
