import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, BottomNav } from "@/components/app-shell";
import { SupportBadge } from "@/components/support-badge";
import { formatNaira } from "@/lib/format";
import { Bell, Cloud, CreditCard, Ticket, Gift, ClipboardList, Database, Upload, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "My Wallet — InvestPro" }] }),
  component: WalletPage,
});

function WalletPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [phone, setPhone] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return navigate({ to: "/auth" });
      setUserId(uid);
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("phone,email,full_name").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
      ]);
      setPhone(p?.phone ?? p?.email ?? "");
      setIsAdmin(!!r);
    });
  }, [navigate]);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", userId!).maybeSingle()).data,
  });
  const { data: todayIncome = 0 } = useQuery({
    queryKey: ["today-income", userId],
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date(); since.setHours(0,0,0,0);
      const { data } = await supabase.from("transactions").select("amount").eq("user_id", userId!).eq("type","income").gte("created_at", since.toISOString());
      return (data ?? []).reduce((s, t) => s + Number(t.amount), 0);
    },
  });

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  }

  const menu = [
    { label: "Bank card", icon: CreditCard, to: "/wallet" },
    { label: "Lucky draw", icon: Ticket, to: "/wallet" },
    { label: "Free cash", icon: Gift, to: "/wallet" },
    { label: "Balance bill", icon: ClipboardList, to: "/wallet" },
    { label: "Recharge record", icon: Database, to: "/wallet" },
    { label: "Withdrawal record", icon: Upload, to: "/wallet" },
  ] as const;

  return (
    <AppShell>
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-warning/30 text-foreground"><span className="text-sm">👤</span></div>
          <div className="font-semibold">{phone || "—"}</div>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Bell className="h-5 w-5" />
          <Cloud className="h-5 w-5" />
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="relative overflow-hidden rounded-2xl bg-card p-5 shadow-sm">
          <div className="absolute right-0 top-0 h-10 w-32 bg-brand [clip-path:polygon(20%_0,100%_0,100%_100%)]" />
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white text-lg">💳</div>
            <span className="text-lg font-semibold">My Wallet</span>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">Balance: <span className="text-3xl font-bold text-foreground align-middle">{Number(wallet?.balance ?? 0).toLocaleString()}</span></div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
            <Mini value={Number(todayIncome).toLocaleString()} label="No income received today(₦)" />
            <Mini value={Number(wallet?.cumulative_income ?? 0).toLocaleString()} label="Cumulative income(₦)" />
            <Mini value={"0"} label="Withdraw today(₦)" />
            <Mini value={Number(wallet?.total_withdrawals ?? 0).toLocaleString()} label="Total withdrawals(₦)" />
            <Mini value={String(wallet?.team_size ?? 0)} label="Team size" />
            <Mini value={"0"} label="Team Benefits(₦)" />
          </div>
        </div>
      </div>

      <div className="space-y-2 px-4 pt-4">
        {isAdmin && (
          <Link to="/admin" className="flex items-center justify-between rounded-2xl bg-brand p-4 text-white shadow-sm">
            <div className="flex items-center gap-3"><Shield className="h-5 w-5" /> Admin Panel</div>
            <span>›</span>
          </Link>
        )}
        {menu.map(({ label, icon: Icon, to }) => (
          <Link key={label} to={to} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3"><Icon className="h-5 w-5 text-warning" /> {label}</div>
            <span className="text-muted-foreground">›</span>
          </Link>
        ))}
        <Button variant="outline" onClick={signOut} className="mt-4 w-full"><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
        <div className="text-center text-xs text-muted-foreground pt-2">Balance display: {formatNaira(wallet?.balance ?? 0)}</div>
      </div>

      <SupportBadge />
      <BottomNav />
    </AppShell>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-1">
      <div className="font-bold">{value}</div>
      <div className="mt-1 text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}
