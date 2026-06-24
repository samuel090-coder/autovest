import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * "Congratulations! Win the lottery" popup — appears FIRST (before announcement popups)
 * once per browser session for authenticated users. Tapping the button sends them to /lucky-draw.
 */
export function LotteryPopup() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("lottery_pop_seen") === "1") return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setOpen(true);
    });
  }, []);

  function close() {
    sessionStorage.setItem("lottery_pop_seen", "1");
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/75 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[28px] bg-gradient-to-b from-[#ffb13d] via-[#ff9320] to-[#ff7a00] p-5 pb-7 text-center shadow-2xl">
        <button onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/30 text-white backdrop-blur">
          <X className="h-5 w-5" />
        </button>
        <h2 className="px-4 pt-2 text-2xl font-extrabold text-yellow-100 drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">
          Congratulations! Win the lottery
        </h2>

        {/* Wheel scene */}
        <div className="relative mx-auto mt-3 h-56 w-full">
          {/* gifts */}
          <div className="absolute bottom-6 left-2 text-5xl drop-shadow-lg">🎁</div>
          <div className="absolute bottom-3 left-12 text-4xl drop-shadow-lg">🎀</div>
          {/* coins */}
          <div className="absolute bottom-4 right-3 text-3xl drop-shadow-lg">🪙</div>
          <div className="absolute bottom-10 right-12 text-2xl drop-shadow">💰</div>
          {/* wheel */}
          <div className="absolute left-1/2 top-1 -translate-x-1/2">
            <div className="relative h-40 w-40 rounded-full bg-gradient-to-br from-yellow-200 via-yellow-400 to-orange-500 ring-[6px] ring-white/70 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              {/* spokes */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="absolute left-1/2 top-1/2 h-1/2 w-[2px] origin-top bg-white/40" style={{ transform: `translate(-50%, 0) rotate(${i * 45}deg)` }} />
              ))}
              {/* bulbs */}
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="absolute h-2 w-2 rounded-full bg-white shadow"
                  style={{ left: `${50 + 48 * Math.cos((i / 10) * 2 * Math.PI)}%`, top: `${50 + 48 * Math.sin((i / 10) * 2 * Math.PI)}%`, transform: "translate(-50%, -50%)" }} />
              ))}
              {/* center */}
              <div className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-white shadow-inner">
                <span className="text-2xl font-black text-red-600">x8</span>
              </div>
              {/* pointer */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 border-x-[10px] border-b-[14px] border-x-transparent border-b-red-600" />
            </div>
          </div>
        </div>

        {/* CTA in a yellow tray */}
        <div className="mt-2 rounded-2xl bg-gradient-to-b from-orange-400 to-orange-500 p-3 shadow-inner">
          <button
            onClick={() => { close(); navigate({ to: "/lucky-draw" }); }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-yellow-100 to-yellow-300 px-6 py-3 text-lg font-extrabold text-black shadow-lg hover:from-yellow-50"
          >
            Go Luck Draw
            <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-500 text-white">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
