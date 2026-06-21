import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

/**
 * Two sequential welcome popups (first then second after the first is closed),
 * shown only once per browser session. Content is admin-editable via
 * site_settings keys `announce_1` and `announce_2`.
 */
export function AnnouncementPopups() {
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0=none, 1=first, 2=second

  const { data: settings } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key,value")
        .in("key", ["announce_1", "announce_2"]);
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => (map[r.key] = r.value));
      return map;
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("announce_seen") === "1") return;
    if (!settings) return;
    if (settings.announce_1?.enabled) setStep(1);
    else if (settings.announce_2?.enabled) setStep(2);
    else sessionStorage.setItem("announce_seen", "1");
  }, [settings]);

  function close() {
    if (step === 1 && settings?.announce_2?.enabled) {
      setStep(2);
    } else {
      sessionStorage.setItem("announce_seen", "1");
      setStep(0);
    }
  }

  if (step === 0 || !settings) return null;

  // Render hyperlinks for URLs inside the body text
  function renderRich(text: string) {
    const parts = text.split(/(https?:\/\/\S+)/g);
    return parts.map((p, i) =>
      /^https?:\/\//.test(p) ? (
        <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-red-600 underline">
          {p}
        </a>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
  }

  if (step === 1) {
    const a = settings.announce_1 ?? {};
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-[#f5b740] shadow-2xl">
          <div className="px-5 pt-5 pb-3 text-2xl font-black tracking-tight text-black">{a.title ?? "Announcement"}</div>
          <div className="mx-3 mb-3 max-h-[60vh] overflow-y-auto rounded-lg bg-white p-5 text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
            {renderRich(a.body ?? "")}
          </div>
          <button onClick={close} aria-label="Close" className="absolute -bottom-5 left-1/2 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full border-2 border-white bg-black/60 text-white shadow-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  const b = settings.announce_2 ?? {};
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#fdf6e8] p-6 shadow-2xl">
        <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">{renderRich(b.body ?? "")}</p>
        <Button asChild className="mt-5 w-full rounded-full bg-red-600 py-6 text-base font-bold text-white hover:bg-red-700">
          <a href={b.cta_url ?? "#"} target="_blank" rel="noreferrer" onClick={() => setTimeout(close, 50)}>{b.cta_label ?? "Join in"}</a>
        </Button>
        <button onClick={close} className="mx-auto mt-4 grid h-9 w-9 place-items-center rounded-full border bg-white text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
