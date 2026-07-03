import { useRouterState, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/format";

export function FlashSalePopup() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const { data: sale } = useQuery({
    queryKey: ["flash-sale", pathname],
    queryFn: async () => {
      const { data } = await supabase
        .from("investments")
        .select("*")
        .eq("is_active", true)
        .eq("is_flash_sale", true)
        .eq("flash_sale_route", pathname)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!sale) return;
    const key = `flash-sale:${sale.id}:${pathname}`;
    if (sessionStorage.getItem(key)) setDismissedKey(key);
    else setDismissedKey(null);
  }, [sale, pathname]);

  if (!sale) return null;
  const key = `flash-sale:${sale.id}:${pathname}`;
  const open = dismissedKey !== key;

  function close() {
    sessionStorage.setItem(key, "1");
    setDismissedKey(key);
  }

  const salePrice = Number(sale.flash_sale_price ?? sale.price);
  const original = Number(sale.price);
  const pct = sale.flash_sale_discount_pct ?? Math.round(((original - salePrice) / original) * 100);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden rounded-2xl bg-[#fff8ee] p-0">
        <div className="-mt-1 mx-auto w-[88%] rounded-xl bg-gradient-to-r from-[#ff7a5c] to-[#ffa07a] px-3 py-2 text-center text-white">
          <div className="text-lg font-extrabold italic tracking-wide drop-shadow">FLASH SALE</div>
        </div>
        <div className="p-3 pt-2">
          <div className="relative overflow-hidden rounded-lg bg-muted">
            {sale.image_url && <img src={sale.image_url} alt={sale.name} className="aspect-[16/9] w-full object-cover" />}
            {pct > 0 && (
              <span className="absolute right-0 top-2 rounded-l-md bg-brand px-2 py-0.5 text-xs font-bold text-white">{pct}%</span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-lg bg-dark-surface p-2 text-center text-white">
            <Stat v={String(sale.cycle_days)} l="Cycle(Days)" />
            <Stat v={Number(sale.daily_income).toLocaleString()} l="Daily(₦)" />
            <Stat v={Number(sale.total_income).toLocaleString()} l="Total(₦)" />
          </div>
          <div className="mt-2 flex items-baseline justify-between px-1">
            <span className="text-xs text-muted-foreground">Price(₦)</span>
            <div className="min-w-0">
              {salePrice < original && <span className="mr-1.5 text-xs text-muted-foreground line-through">{original.toLocaleString()}</span>}
              <span className="text-info text-lg font-extrabold">{salePrice.toLocaleString()}</span>
            </div>
          </div>
          <Link to="/investment/$id" params={{ id: sale.id }} onClick={close} className="mt-2 block">
            <Button className="bg-flash-gradient h-10 w-full rounded-full text-sm font-semibold text-white shadow-md">Invest now</Button>
          </Link>
          {sale.description && (
            <div className="mt-2 max-h-24 overflow-y-auto text-xs leading-relaxed [overflow-wrap:anywhere]">
              {sale.description.split("\n").slice(0, 3).map((line, i) => (
                <p key={i} className="py-0.5">💰 {line}</p>
              ))}
              <p className="py-0.5">📅 Duration: {sale.cycle_days} days</p>
              <p className="py-0.5">📈 Daily: {formatNaira(sale.daily_income)}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="min-w-0">
      <div className="text-warning truncate text-sm font-bold">{v}</div>
      <div className="text-[9px] opacity-80">{l}</div>
    </div>
  );
}
