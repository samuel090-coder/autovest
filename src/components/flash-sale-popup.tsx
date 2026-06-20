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
      <DialogContent className="max-w-sm overflow-hidden bg-[#fff8ee] p-0">
        <div className="-mt-2 mx-auto w-[90%] rounded-2xl bg-gradient-to-r from-[#ff7a5c] to-[#ffa07a] p-4 text-white">
          <div className="text-2xl font-extrabold italic tracking-wide drop-shadow">FLASH SALE</div>
        </div>
        <div className="p-4 pt-2">
          <div className="relative overflow-hidden rounded-xl bg-muted">
            {sale.image_url && <img src={sale.image_url} alt={sale.name} className="aspect-[16/10] w-full object-cover" />}
            {pct > 0 && (
              <span className="absolute right-0 top-3 rounded-l-md bg-brand px-3 py-1 text-sm font-bold text-white">{pct}%</span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-dark-surface p-3 text-center text-white">
            <Stat v={String(sale.cycle_days)} l="Cycle(Days)" />
            <Stat v={Number(sale.daily_income).toLocaleString()} l="Daily Income(₦)" />
            <Stat v={Number(sale.total_income).toLocaleString()} l="Total Income(₦)" />
          </div>
          <div className="mt-3 flex items-baseline justify-between px-1">
            <span className="text-muted-foreground">Price(₦)</span>
            <div>
              {salePrice < original && <span className="mr-2 text-muted-foreground line-through">{original.toLocaleString()}</span>}
              <span className="text-info text-2xl font-extrabold">{salePrice.toLocaleString()}</span>
            </div>
          </div>
          <Link to="/investment/$id" params={{ id: sale.id }} onClick={close} className="mt-3 block">
            <Button className="bg-flash-gradient h-12 w-full rounded-full text-base font-semibold text-white shadow-md">Invest now</Button>
          </Link>
          {sale.description && (
            <div className="mt-3 max-h-40 overflow-y-auto text-sm leading-relaxed">
              {sale.description.split("\n").map((line, i) => (
                <p key={i} className="py-1">💰 {line}</p>
              ))}
              <p className="py-1">📅 Duration: {sale.cycle_days}</p>
              <p className="py-1">📈 Daily Earnings: {formatNaira(sale.daily_income)}</p>
              <p className="py-1">🏆 Total Earnings: {formatNaira(sale.total_income)}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div>
      <div className="text-warning text-base font-bold">{v}</div>
      <div className="text-[10px] opacity-80">{l}</div>
    </div>
  );
}
