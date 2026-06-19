import { createFileRoute } from "@tanstack/react-router";
import { AppShell, BottomNav } from "@/components/app-shell";
import { SupportBadge } from "@/components/support-badge";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Support Chat — InvestPro" }] }),
  component: Chat,
});

function Chat() {
  return (
    <AppShell>
      <header className="px-4 pt-4"><h1 className="text-xl font-bold">Customer Support</h1></header>
      <div className="px-4 pt-16 text-center">
        <MessageCircle className="mx-auto h-12 w-12 text-brand" />
        <h2 className="mt-4 text-lg font-semibold">We're here to help</h2>
        <p className="mt-1 text-sm text-muted-foreground">Live chat coming soon. Tap the badge for urgent support.</p>
      </div>
      <SupportBadge />
      <BottomNav />
    </AppShell>
  );
}
