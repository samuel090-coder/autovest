import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, X, Copy, Share2 } from "lucide-react";
import { SupportBadge } from "@/components/support-badge";
import { formatNaira } from "@/lib/format";
import { toast } from "sonner";
import { fireCongrats } from "@/components/congrats-popup";

export const Route = createFileRoute("/bonus-task")({
  head: () => ({ meta: [{ title: "Bonus Task — InvestPro" }] }),
  component: BonusTask,
});

function BonusTask() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [refCode, setRefCode] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [countdown, setCountdown] = useState("00:00:00");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return navigate({ to: "/auth" });
      setUserId(data.session.user.id);
      const { data: p } = await supabase.from("profiles").select("referral_code").eq("id", data.session.user.id).maybeSingle();
      setRefCode(p?.referral_code ?? "");
    });
  }, [navigate]);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", userId!).maybeSingle()).data,
  });

  const { data: cfg } = useQuery({
    queryKey: ["cash-benefits"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "cash_benefits").maybeSingle();
      return (data?.value as any) ?? {};
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["bonus-videos"],
    queryFn: async () => (await supabase.from("bonus_videos").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });

  const { data: watched = [] } = useQuery({
    queryKey: ["bonus-watched", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("bonus_watches").select("video_id").eq("user_id", userId!)).data ?? [],
  });

  const { data: state, refetch: refetchState } = useQuery({
    queryKey: ["bonus-state", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("bonus_state").select("*").eq("user_id", userId!).maybeSingle()).data,
  });

  const { data: incomes = [] } = useQuery({
    queryKey: ["bonus-income", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("transactions").select("*").eq("user_id", userId!).eq("type", "bonus").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });

  const watchedIds = new Set(watched.map((w: any) => w.video_id));
  const currentVideo = videos.find((v: any) => !watchedIds.has(v.id)) ?? null;
  const nextAt = state?.next_available_at ? new Date(state.next_available_at).getTime() : 0;
  const now = Date.now();
  const onCooldown = nextAt > now;

  // Countdown ticker
  useEffect(() => {
    if (!onCooldown) { setCountdown("00:00:00"); return; }
    const t = setInterval(() => {
      const diff = Math.max(0, nextAt - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      if (diff <= 0) { refetchState(); }
    }, 1000);
    return () => clearInterval(t);
  }, [onCooldown, nextAt, refetchState]);

  // Prevent seeking / speed changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let lastTime = 0;
    const onTime = () => { if (Math.abs(v.currentTime - lastTime) < 2) lastTime = v.currentTime; };
    const onSeeking = () => { if (Math.abs(v.currentTime - lastTime) > 1.5) v.currentTime = lastTime; };
    const onRate = () => { v.playbackRate = 1; };
    v.playbackRate = 1;
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("ratechange", onRate);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("ratechange", onRate);
    };
  }, [currentVideo?.id]);

  async function onEnded() {
    if (!currentVideo || claiming) return;
    setClaiming(true);
    try {
      const { data, error } = await supabase.rpc("complete_bonus_watch", { _video_id: currentVideo.id });
      if (error) throw error;
      const reward = Number((data as any)?.reward ?? 27);
      toast.success(`+${formatNaira(reward)} earned!`);
      fireCongrats({ title: "Congratulations!", amount: reward, subtitle: "Reward credited to your balance" });
      qc.invalidateQueries();
      setShowInvite(true);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("cooldown")) toast.error("Please wait for the timer before your next reward.");
      else if (msg.includes("already")) toast.error("You've already earned from this video.");
      else toast.error(msg || "Failed to claim reward");
    } finally {
      setClaiming(false);
    }
  }

  const link = refCode ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${refCode}` : "";
  const reward = Number(cfg?.reward_amount ?? 27);
  const minWithdraw = Number(cfg?.min_withdrawal ?? 6000);
  const headline = cfg?.headline ?? "Bonus Task";

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-orange-300 pb-24">
      <div className="flex items-center justify-between px-4 pt-4 text-white">
        <button onClick={() => history.back()} className="grid h-9 w-9 place-items-center rounded-full"><ArrowLeft className="h-5 w-5" /></button>
        <div className="font-semibold">{headline}</div>
        <span className="text-sm">Rules</span>
      </div>

      <div className="px-4 pt-4">
        <div className="relative overflow-hidden rounded-2xl bg-red-600 p-5 text-white shadow-lg">
          <div className="absolute right-0 top-0 h-full w-32 bg-zinc-900 [clip-path:polygon(40%_0,100%_0,100%_100%,0_100%)]" />
          <div className="relative">
            <div className="text-sm">📂 Account Balance →</div>
            <div className="mt-2 text-3xl font-extrabold">{formatNaira(wallet?.balance ?? 0)}</div>
          </div>
          <Link to="/withdraw" className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold">Withdraw →</Link>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-zinc-900 px-4 py-3 text-center text-white text-sm">
          <span>Watch a video to earn </span><span className="font-bold text-yellow-300">₦{reward}</span>
          <span> · Min withdrawal </span><span className="font-bold">{formatNaira(minWithdraw)}</span>
        </div>
      </div>

      {/* Video area */}
      <div className="px-4 pt-3">
        <div className="relative overflow-hidden rounded-2xl bg-black aspect-video">
          {onCooldown ? (
            <div className="absolute inset-0 grid place-items-center bg-black/80 text-center text-white">
              <div>
                <div className="text-yellow-300 text-lg font-semibold">The next video is loading.</div>
                <div className="mt-2 text-4xl font-extrabold tracking-widest">{countdown}</div>
                <button onClick={() => setShowInvite(true)} className="mt-4 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold">Invite friends to speed up</button>
              </div>
            </div>
          ) : currentVideo ? (
            <video
              key={currentVideo.id}
              ref={videoRef}
              src={currentVideo.url}
              poster={currentVideo.poster_url ?? undefined}
              controls
              controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
              onEnded={onEnded}
              className="h-full w-full object-contain [&::-webkit-media-controls-timeline]:hidden [&::-webkit-media-controls-current-time-display]:hidden [&::-webkit-media-controls-time-remaining-display]:hidden [&::-webkit-media-controls-seek-back-button]:hidden [&::-webkit-media-controls-seek-forward-button]:hidden"
            />
          ) : (
            <div className="grid h-full place-items-center text-white/70 text-sm">
              {videos.length === 0 ? "No videos uploaded yet" : "🎉 You've watched all videos! Check back soon."}
            </div>
          )}
        </div>
        {cfg?.body && <p className="mt-3 whitespace-pre-wrap text-sm text-white">{cfg.body}</p>}
      </div>

      {/* Income records */}
      <div className="mt-4 rounded-t-3xl bg-white px-4 py-4">
        <h3 className="text-lg font-bold">Income records</h3>
        <div className="mt-2 space-y-2">
          {incomes.length === 0 ? (
            <div className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">No income yet</div>
          ) : (
            incomes.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold">Video reward</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className="font-bold text-emerald-600 shrink-0">+₦{Number(t.amount).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {showInvite && (
        <InvitePopup link={link} countdown={onCooldown ? countdown : "00:00:00"} onClose={() => setShowInvite(false)} />
      )}

      <SupportBadge />
    </div>
  );
}

function InvitePopup({ link, countdown, onClose }: { link: string; countdown: string; onClose: () => void }) {
  function copy() { navigator.clipboard.writeText(link); toast.success("Link copied"); }
  const share = (net: string) => {
    const msg = encodeURIComponent(`Join InvestPro and earn daily! ${link}`);
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${msg}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Join InvestPro")}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      twitter: `https://twitter.com/intent/tweet?text=${msg}`,
      sms: `sms:?body=${msg}`,
    };
    window.open(urls[net], "_blank");
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
      <div className="relative w-full max-w-sm">
        <button onClick={onClose} className="absolute -top-2 -right-2 grid h-9 w-9 place-items-center rounded-full bg-white text-black shadow-lg z-10"><X className="h-4 w-4" /></button>
        <div className="rounded-3xl bg-orange-50 p-6 text-center shadow-2xl ring-4 ring-orange-300">
          <div className="mx-auto -mt-14 grid h-14 w-14 place-items-center rounded-full bg-red-600 text-2xl">🎁</div>
          <h3 className="mt-3 text-lg font-bold text-zinc-900">Invite friends to improve loading speed</h3>
          <div className="mt-3 text-4xl font-extrabold text-red-600 tabular-nums">{countdown}</div>
          <button onClick={copy} className="mt-4 w-full rounded-xl bg-red-600 py-3 font-bold text-white active:scale-95">
            <span className="inline-flex items-center gap-2"><Copy className="h-4 w-4" /> Copy link</span>
          </button>
          <div className="mt-4 flex items-center justify-around">
            {[
              { k: "whatsapp", bg: "bg-green-500", label: "WhatsApp", icon: "💬" },
              { k: "telegram", bg: "bg-sky-500", label: "Telegram", icon: "✈️" },
              { k: "facebook", bg: "bg-blue-600", label: "Facebook", icon: "f" },
              { k: "twitter", bg: "bg-zinc-900", label: "Twitter", icon: "𝕏" },
              { k: "sms", bg: "bg-indigo-400", label: "SMS", icon: "✉️" },
            ].map((s) => (
              <button key={s.k} onClick={() => share(s.k)} className="flex flex-col items-center gap-1">
                <span className={`grid h-11 w-11 place-items-center rounded-full text-white text-lg font-bold ${s.bg}`}>{s.icon}</span>
                <span className="text-[10px] font-semibold text-zinc-700">{s.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-600">When your friend watches a video, your timer instantly clears — watch again right away! <Share2 className="inline h-3 w-3" /></p>
        </div>
      </div>
    </div>
  );
}
