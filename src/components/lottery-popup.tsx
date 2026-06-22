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
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/70 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-b from-[#ff8a3d] to-[#ffb96a] p-6 text-center shadow-2xl">
        <h2 className="text-2xl font-extrabold text-yellow-100 drop-shadow">Congratulations! Win the lottery</h2>
        <div className="my-4 mx-auto grid h-44 w-44 place-items-center rounded-full bg-gradient-to-br from-yellow-300 to-orange-500 ring-8 ring-yellow-100/40 shadow-xl">
          <span className="text-6xl font-black text-red-700 drop-shadow">x8</span>
        </div>
        <button
          onClick={() => { close(); navigate({ to: "/lucky-draw" }); }}
          className="mx-auto block w-full rounded-full bg-yellow-200 px-8 py-3 text-lg font-bold text-black shadow-lg hover:bg-yellow-100"
        >
          Go Luck Draw →
        </button>
        <button onClick={close} aria-label="Close" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/30 text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
