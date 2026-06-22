import { createFileRoute, Outlet, Link, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Boxes, Sparkles, Image as ImageIcon, Users, Receipt, ArrowLeft, Settings } from "lucide-react";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — InvestPro" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!role) throw redirect({ to: "/" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items: Array<{ to: "/admin" | "/admin/investments" | "/admin/ai-create" | "/admin/banners" | "/admin/users" | "/admin/transactions" | "/admin/settings"; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/admin/investments", label: "Investments", icon: Boxes },
    { to: "/admin/ai-create", label: "AI Create", icon: Sparkles },
    { to: "/admin/banners", label: "Banners", icon: ImageIcon },
    { to: "/admin/settings", label: "Settings", icon: Settings },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/transactions", label: "Transactions", icon: Receipt },
  ];
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"><ArrowLeft className="h-4 w-4" /></Link>
          <h1 className="text-base font-semibold">Admin Panel</h1>
          <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">InvestPro</span>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {items.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            return (
              <Link key={to} to={to} className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${active ? "bg-brand text-white" : "hover:bg-muted"}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
