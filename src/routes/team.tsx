import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, BottomNav } from "@/components/app-shell";
import { SupportBadge } from "@/components/support-badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Copy, User, CheckCircle2, Share2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "My Team — InvestPro" }] }),
  component: Team,
});

function Team() {
  const [userId, setUserId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [code, setCode] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: p } = await supabase.from("profiles").select("referral_code").eq("id", data.user.id).maybeSingle();
      setCode(p?.referral_code ?? "");
    });
  }, []);

  const link = code ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${code}` : "";

  const { data: refs = [] } = useQuery({
    queryKey: ["my-refs", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("profiles").select("id").eq("referred_by", userId!)).data ?? [],
  });
  const { data: wallet } = useQuery({
    queryKey: ["wallet", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("wallets").select("referral_bonus").eq("user_id", userId!).maybeSingle()).data,
  });
  const { data: deposits = 0 } = useQuery({
    queryKey: ["ref-deposits", userId], enabled: !!userId,
    queryFn: async () => {
      const refIds = refs.map((r: any) => r.id);
      if (refIds.length === 0) return 0;
      const { data } = await supabase.from("transactions").select("amount").in("user_id", refIds).eq("type", "recharge").eq("status", "approved");
      return (data ?? []).reduce((s, t: any) => s + Number(t.amount), 0);
    },
  });

  function copy(text: string) { navigator.clipboard.writeText(text); toast.success("Copied"); }

  const shareMessage = `Hey! 👋 I've been earning daily on InvestPro and it actually pays out. You invest, watch short videos and complete tasks to earn every single day — plus instant withdrawals to your bank.

Sign up with my invitation link below and we both get a referral bonus 💰 once you make your first deposit.

Join me here 👉 ${link}`;

  function openShare() {
    setShareOpen(true);
  }

  function shareTo(target: "whatsapp" | "facebook" | "telegram" | "instagram") {
    const text = encodeURIComponent(shareMessage);
    const url = encodeURIComponent(link);
    if (target === "whatsapp") window.open(`https://wa.me/?text=${text}`, "_blank");
    else if (target === "facebook") window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, "_blank");
    else if (target === "telegram") window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
    else if (target === "instagram") {
      navigator.clipboard.writeText(shareMessage);
      toast.success("Message copied — paste it into Instagram");
      window.open("https://www.instagram.com/", "_blank");
    }
    setShareOpen(false);
  }

  const tiers = [
    { tier: 1, pct: 20, color: "bg-warning", refs: refs.length, deposit: deposits },
    { tier: 2, pct: 3, color: "bg-flash-gradient", refs: 0, deposit: 0 },
    { tier: 3, pct: 1, color: "bg-brand", refs: 0, deposit: 0 },
  ];

  return (
    <AppShell>
      <header className="px-4 pt-4"><h1 className="text-xl font-bold">My Team</h1></header>
      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-card p-4 text-center shadow-sm">
          <div className="text-sm">My invitation code</div>
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-dark-surface px-3 py-2 text-left text-white">
            <span className="min-w-0 flex-1 truncate text-xs [overflow-wrap:anywhere]">{link || "—"}</span>
            <button onClick={() => copy(link)} className="shrink-0"><Copy className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Code: <span className="font-bold tracking-widest">{code || "—"}</span></div>
        </div>
      </div>

      <div className="px-4 pt-5"><h2 className="text-lg font-bold">Referral Details</h2></div>
      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="inline-flex items-center gap-1 text-sm"><User className="text-warning h-4 w-4" /> My referrals</div>
          <div className="mt-2 text-2xl font-bold">{refs.length}</div>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="inline-flex items-center gap-1 text-sm"><CheckCircle2 className="text-warning h-4 w-4" /> Referral bonus</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-brand text-2xl font-bold">{formatNaira(wallet?.referral_bonus ?? 0)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 pt-4">
        {tiers.map((t) => (
          <div key={t.tier} className="overflow-hidden rounded-2xl bg-dark-surface">
            <div className="m-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-lg bg-card px-3 py-3">
              <div className="min-w-0 text-xs">Referrals:<div className="mt-1 inline-flex items-center gap-1 text-sm font-bold">👤 {t.refs}</div></div>
              <div className="min-w-0 text-xs">Cashback:<div className="mt-1 truncate text-sm font-bold">💰 {formatNaira(t.deposit * t.pct / 100)}</div></div>
              <div className={`${t.color} -my-3 -mr-3 grid h-14 shrink-0 place-items-center rounded-l-full pl-4 pr-3 text-white`}>
                <div className="text-right text-xs">🏅 Tier{t.tier} <span className="text-base font-bold">{t.pct}%</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pt-4">
        <div className="bg-warning/20 flex items-center justify-between rounded-2xl p-4">
          <div className="min-w-0">
            <div className="font-bold">Invite Friends</div>
            <div className="text-xs text-muted-foreground">Withdrawing is easier!</div>
          </div>
          <Button onClick={openShare} className="bg-brand shrink-0 text-white"><Share2 className="mr-1 h-4 w-4" />Share</Button>
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[380px] overflow-hidden rounded-2xl p-0">
          <DialogTitle className="sr-only">Share your referral</DialogTitle>

          <div className="bg-gradient-to-br from-brand to-orange-500 p-5 text-white">
            <div className="text-xs uppercase tracking-wider opacity-90">Referral Earnings</div>
            <div className="mt-1 text-3xl font-extrabold">{formatNaira(wallet?.referral_bonus ?? 0)}</div>
            <Link to="/team" onClick={() => setShareOpen(false)} className="mt-3 flex items-center justify-between rounded-xl bg-white/15 px-3 py-2 backdrop-blur">
              <div className="flex items-center gap-4 text-sm">
                <div><span className="text-lg font-bold">{refs.length}</span> <span className="opacity-90">Referrals</span></div>
                <div className="h-4 w-px bg-white/40" />
                <div><span className="text-lg font-bold">{formatNaira(deposits)}</span> <span className="text-[11px] opacity-90">Deposits</span></div>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="px-4 pt-3 text-sm">
            <div className="font-bold">How you earn</div>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              <li>• Tier 1: earn <span className="text-brand font-bold">20%</span> of every friend's deposit</li>
              <li>• Tier 2: earn <span className="text-brand font-bold">3%</span> from your friends' invites</li>
              <li>• Tier 3: earn <span className="text-brand font-bold">1%</span> from third-level invites</li>
              <li>• Bonus is paid instantly to your wallet — withdrawable anytime</li>
            </ul>
          </div>

          <div className="px-4 pb-4 pt-4">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Share via</div>
            <div className="grid grid-cols-4 gap-2">
              <SocialBtn label="WhatsApp" color="bg-[#25D366]" onClick={() => shareTo("whatsapp")}
                icon={<svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M20.5 3.5A11 11 0 003.7 17.2L2 22l4.9-1.6A11 11 0 1020.5 3.5zM12 20a8 8 0 01-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1120 12a8 8 0 01-8 8zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.1-.5 0a6.6 6.6 0 01-3.2-2.8c-.2-.4.2-.4.6-1.2a.5.5 0 000-.5c0-.1-.5-1.3-.7-1.7s-.4-.4-.5-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2c0 1.3.9 2.5 1.1 2.7s1.9 2.9 4.6 4a15.6 15.6 0 001.5.6 3.7 3.7 0 001.7.1c.5-.1 1.4-.6 1.6-1.1s.2-1 .1-1.1-.3-.2-.5-.3z"/></svg>} />
              <SocialBtn label="Facebook" color="bg-[#1877F2]" onClick={() => shareTo("facebook")}
                icon={<svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6a24 24 0 00-2.5-.1c-2.5 0-4.1 1.5-4.1 4.2v2.3H7.5V14h2.7v8z"/></svg>} />
              <SocialBtn label="Telegram" color="bg-[#229ED9]" onClick={() => shareTo("telegram")}
                icon={<svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M9.8 15.6l-.4 3.7c.5 0 .7-.2 1-.5l2.4-2.2 5 3.6c.9.5 1.6.2 1.8-.8l3.3-15.4c.3-1.3-.5-1.8-1.4-1.5L2.3 9.3c-1.3.5-1.2 1.2-.2 1.5l4.8 1.5 11.2-7c.5-.3 1-.1.6.3z"/></svg>} />
              <SocialBtn label="Instagram" color="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" onClick={() => shareTo("instagram")}
                icon={<svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2 0 1.9.2 2.3.4a4 4 0 011.4.9 4 4 0 01.9 1.4c.2.4.4 1.1.4 2.3.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c0 1.2-.2 1.9-.4 2.3a4 4 0 01-.9 1.4 4 4 0 01-1.4.9c-.4.2-1.1.4-2.3.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2 0-1.9-.2-2.3-.4a4 4 0 01-1.4-.9 4 4 0 01-.9-1.4c-.2-.4-.4-1.1-.4-2.3-.1-1.3-.1-1.6-.1-4.8s0-3.6.1-4.8c0-1.2.2-1.9.4-2.3a4 4 0 01.9-1.4 4 4 0 011.4-.9c.4-.2 1.1-.4 2.3-.4C8.4 2.2 8.8 2.2 12 2.2M12 0C8.7 0 8.3 0 7.1.1 5.8.1 4.9.3 4.1.6a6 6 0 00-2.2 1.4A6 6 0 00.6 4.1C.3 4.9.1 5.8.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c0 1.3.3 2.2.5 3a6 6 0 001.4 2.2 6 6 0 002.2 1.4c.8.3 1.7.5 3 .5 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c1.3 0 2.2-.3 3-.5a6 6 0 002.2-1.4 6 6 0 001.4-2.2c.3-.8.5-1.7.5-3 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c0-1.3-.3-2.2-.5-3a6 6 0 00-1.4-2.2A6 6 0 0019.9.6c-.8-.3-1.7-.5-3-.5C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zm0 10.2a4 4 0 110-8 4 4 0 010 8zm6.4-11.9a1.4 1.4 0 100 2.9 1.4 1.4 0 000-2.9z"/></svg>} />
            </div>
            <button onClick={() => copy(shareMessage)} className="mt-3 w-full rounded-lg border border-border py-2 text-xs font-medium hover:bg-muted">Copy message</button>
          </div>
        </DialogContent>
      </Dialog>

      <SupportBadge />
      <BottomNav />
    </AppShell>
  );
}

function SocialBtn({ label, color, icon, onClick }: { label: string; color: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <span className={`grid h-11 w-11 place-items-center rounded-full ${color} shadow-sm`}>{icon}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
