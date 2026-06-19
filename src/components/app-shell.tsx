import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ClipboardList, Users, MessageCircle, Wallet } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/orders", label: "Order", icon: ClipboardList },
  { to: "/team", label: "Team", icon: Users },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/wallet", label: "Wallet", icon: Wallet },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${active ? "text-brand" : "text-muted-foreground"}`}
              >
                <span className={`grid h-7 w-7 place-items-center rounded-lg ${active ? "bg-brand text-brand-foreground" : ""}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-20">
      {children}
    </div>
  );
}
