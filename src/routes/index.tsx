import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, BottomNav } from "@/components/app-shell";
import { SupportBadge } from "@/components/support-badge";
import { AnnouncementPopups } from "@/components/announcement-popups";
import { formatNaira } from "@/lib/format";
import { ArrowRight, Headphones, Gift, HandCoins, ClipboardCheck, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InvestPro — Dashboard" },
      { name: "description", content: "Track your balance, browse welfare products and grow your daily income." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setAuthChecked(true);
      if (!data.session) navigate({ to: "/auth" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", userId!).maybeSingle()).data,
  });

  const { data: banners = [] } = useQuery({
    queryKey: ["banners"],
    queryFn: async () => (await supabase.from("banners").select("*").eq("is_active", true)).data ?? [],
  });
  const lucky = banners.find((b) => b.key === "lucky_draw");
  const welfareBanner = banners.find((b) => b.key === "welfare_hero");

  const { data: welfareItems = [] } = useQuery({
    queryKey: ["welfare-items"],
    queryFn: async () => (await supabase.from("investments").select("*").eq("is_active", true).eq("category", "welfare").order("sort_order")).data ?? [],
  });

  const actions: Array<{ label: string; icon: typeof Headphones; to: "/chat" | "/wallet" | "/orders"; badge?: number }> = [
    { label: "Message", icon: Headphones, to: "/chat", badge: 0 },
    { label: "Free Cash", icon: Gift, to: "/wallet" },
    { label: "Cash Benefits", icon: HandCoins, to: "/wallet" },
    { label: "Certificate", icon: ClipboardCheck, to: "/orders" },
    { label: "FAQ", icon: HelpCircle, to: "/chat" },
  ];

  if (!authChecked || !userId) return null;

  return (
    <AppShell>
      {/* Balance card */}
      <div className="px-4 pt-4">
        <div className="bg-balance-card relative overflow-hidden rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <Link to="/wallet" className="flex items-center gap-2 text-sm font-medium">
              <span className="grid h-5 w-5 place-items-center rounded bg-white/20"><HandCoins className="h-3 w-3" /></span>
              Account Balance <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/withdraw" className="rounded-md bg-info px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1">
              Withdraw <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div className="text-3xl font-bold tracking-tight">{formatNaira(wallet?.balance ?? 0)}</div>
            <Link to="/wallet" className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1">
              Recharge <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Action grid */}
      <div className="grid grid-cols-5 gap-2 px-4 pt-5">
        {actions.map(({ label, icon: Icon, to, badge }) => (
          <Link key={label} to={to} className="flex flex-col items-center gap-1.5">
            <div className="relative grid h-12 w-12 place-items-center rounded-full bg-card shadow-sm ring-1 ring-border">
              <Icon className="h-5 w-5 text-brand" />
              {badge ? (<span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{badge}</span>) : null}
            </div>
            <span className="text-center text-[11px] font-medium leading-tight">{label}</span>
          </Link>
        ))}
      </div>

      {/* Lucky draw banner (admin uploadable) */}
      <div className="px-4 pt-5">
        <Link to={(lucky?.link as "/wallet") ?? "/wallet"} className="block">
          <div className="bg-lucky-gradient relative h-28 overflow-hidden rounded-2xl shadow-md">
            {lucky?.image_url ? (
              <img src={lucky.image_url} alt={lucky.title ?? "Lucky Draw"} className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-r from-black/35 to-transparent" />
            <div className="relative p-5 text-white">
              <div className="text-2xl font-extrabold tracking-tight drop-shadow">{lucky?.title ?? "LUCKY DRAW"}</div>
              <div className="mt-1 text-sm opacity-95">{lucky?.subtitle ?? "Click here to enter the lottery tour"}</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Welfare Product carousel */}
      <div className="px-4 pt-5">
        <div className="bg-welfare-gradient rounded-2xl p-3">
          <div className="py-1 text-center text-lg font-bold text-white">{welfareBanner?.title ?? "Welfare Product"}</div>
          {welfareItems.length === 0 ? (
            <div className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground">No welfare products yet.</div>
          ) : (
            <Carousel opts={{ loop: welfareItems.length > 1 }} className="w-full">
              <CarouselContent>
                {welfareItems.map((hero) => (
                  <CarouselItem key={hero.id}>
                    <Link to="/investment/$id" params={{ id: hero.id }} className="block">
                      <div className="overflow-hidden rounded-xl bg-card">
                        <div className="relative aspect-[16/10] w-full bg-muted">
                          {hero.image_url && <img src={hero.image_url} alt={hero.name} className="h-full w-full object-cover" />}
                          {hero.is_hot && (<span className="absolute left-3 top-3 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">HOT</span>)}
                        </div>
                        <div className="p-4">
                          <div className="text-base font-bold">{hero.name}</div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                            <Stat sub="Investment Cycle" value={`${hero.cycle_days} Days`} />
                            <Stat sub="Daily Income" value={Number(hero.daily_income).toLocaleString()} info />
                            <Stat sub="Total Income" value={Number(hero.total_income).toLocaleString()} info />
                          </div>
                          <Button className="mt-3 w-full bg-info text-white hover:bg-info/90 text-base">{formatNaira(hero.price)}</Button>
                        </div>
                      </div>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {welfareItems.length > 1 && (<><CarouselPrevious className="left-1" /><CarouselNext className="right-1" /></>)}
            </Carousel>
          )}
        </div>
      </div>

      {/* Product center */}
      <div className="px-4 pt-6 pb-2"><h2 className="text-lg font-bold">Product Center</h2></div>
      <ProductList />

      <SupportBadge />
      <BottomNav />
    </AppShell>
  );
}

function Stat({ value, sub, info }: { value: string; sub: string; info?: boolean }) {
  return (
    <div>
      <div className={info ? "text-info font-bold" : "font-bold"}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function ProductList() {
  const { data: items = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("investments").select("*").eq("is_active", true).eq("category", "product").order("sort_order")).data ?? [],
  });
  if (items.length === 0) return <div className="px-4 pb-6 text-center text-sm text-muted-foreground">No products yet. Admins can add them from the admin panel.</div>;
  return (
    <div className="space-y-3 px-4 pb-6">
      {items.map((p) => (
        <Link key={p.id} to="/investment/$id" params={{ id: p.id }} className="block">
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-base font-bold">{p.name}</div>
                <div className="mt-1 text-sm"><span className="text-muted-foreground">Cycle(Days) </span><span className="font-bold">{p.cycle_days}</span></div>
              </div>
              <div className="h-16 w-20 overflow-hidden rounded-lg bg-muted">
                {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-muted px-4 py-3 text-center">
              <div><div className="text-brand font-bold">{Number(p.daily_income).toLocaleString()}</div><div className="text-xs">Daily Income</div></div>
              <div><div className="text-brand font-bold">{Number(p.total_income).toLocaleString()}</div><div className="text-xs">Total Income</div></div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div><span className="text-sm">Price(₦):</span> <span className="text-brand font-bold">{Number(p.price).toLocaleString()}</span></div>
              <Button size="sm" className="px-6">INVEST</Button>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
