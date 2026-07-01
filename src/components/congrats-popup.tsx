import { useEffect, useState } from "react";

/**
 * Global "Congratulations" celebration popup.
 * Any component can trigger it with:
 *   window.dispatchEvent(new CustomEvent("congrats", { detail: { title, subtitle, amount } }))
 */
export type CongratsDetail = { title?: string; subtitle?: string; amount?: number | string };

export function CongratsPopup() {
  const [state, setState] = useState<CongratsDetail | null>(null);

  useEffect(() => {
    function on(e: Event) {
      const d = (e as CustomEvent<CongratsDetail>).detail ?? {};
      setState(d);
      window.setTimeout(() => setState(null), 4500);
    }
    window.addEventListener("congrats", on as EventListener);
    return () => window.removeEventListener("congrats", on as EventListener);
  }, []);

  if (!state) return null;

  const title = state.title ?? "Congratulations!";
  const subtitle = state.subtitle ?? "You just won a reward";
  const amount = state.amount;

  // Confetti pieces (deterministic-ish)
  const pieces = Array.from({ length: 40 });

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] grid place-items-center overflow-hidden">
      {/* Backdrop flash */}
      <div className="absolute inset-0 animate-[cg-flash_500ms_ease-out] bg-gradient-radial from-yellow-300/40 via-transparent to-transparent" />

      {/* Confetti */}
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 400;
        const dur = 1800 + Math.random() * 1500;
        const rot = Math.random() * 360;
        const colors = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#eab308", "#ec4899"];
        const bg = colors[i % colors.length];
        return (
          <span
            key={i}
            className="absolute -top-4 h-2 w-3 rounded-sm"
            style={{
              left: `${left}%`,
              background: bg,
              transform: `rotate(${rot}deg)`,
              animation: `cg-fall ${dur}ms ease-in ${delay}ms forwards`,
            }}
          />
        );
      })}

      {/* Card */}
      <div className="pointer-events-auto relative mx-4 w-full max-w-xs animate-[cg-pop_500ms_cubic-bezier(0.22,1,0.36,1)] rounded-3xl bg-gradient-to-br from-orange-400 via-red-500 to-pink-600 p-1 shadow-2xl ring-4 ring-yellow-300/60">
        <div className="rounded-[22px] bg-white/95 px-5 py-6 text-center backdrop-blur">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-yellow-300 to-orange-500 shadow-lg ring-4 ring-white">
            <span className="animate-[cg-bounce_800ms_ease-in-out_infinite] text-3xl">🎉</span>
          </div>
          <div className="text-xl font-extrabold tracking-tight text-red-600">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
          {amount !== undefined && amount !== null && amount !== "" && (
            <div className="mt-3 text-3xl font-black text-orange-600 drop-shadow-sm">
              ₦{Number(amount).toLocaleString()}
            </div>
          )}
          <button
            onClick={() => setState(null)}
            className="mt-4 w-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 py-2.5 text-sm font-bold text-white shadow-md"
          >
            Awesome!
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cg-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes cg-fall { to { transform: translateY(110vh) rotate(720deg); opacity: 0.9; } }
        @keyframes cg-flash { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes cg-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>
    </div>
  );
}

export function fireCongrats(detail: CongratsDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("congrats", { detail }));
}
