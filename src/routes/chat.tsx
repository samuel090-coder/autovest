import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, BottomNav } from "@/components/app-shell";
import { SupportBadge } from "@/components/support-badge";
import { askSupport } from "@/lib/faq-chat.functions";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Support — InvestPro" }] }),
  component: Chat,
});

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How do I start earning?",
    a: "Recharge your wallet from the Recharge page (Paystack card or bank transfer), then buy any Investment or Welfare product. Your daily income begins immediately and updates every second on the Orders page.",
  },
  {
    q: "How does the investment cycle work?",
    a: "Each product runs for a fixed number of days (the cycle). You earn a daily income every day. When the cycle ends you can either start a FREE Round 2 or claim your total income into your wallet.",
  },
  {
    q: "How do I withdraw my earnings?",
    a: "Go to Wallet → Withdraw. Bind your Nigerian bank account (name, bank, account number) and submit the amount. Withdrawals are reviewed by admin and paid to your bank.",
  },
  {
    q: "How do I recharge?",
    a: "Open the Recharge page, choose an amount and pay with Paystack (card or bank transfer). Your wallet is credited automatically once payment is confirmed.",
  },
  {
    q: "How does the referral program work?",
    a: "Share your referral link from the Team page. When someone signs up with your link and invests, you earn a commission automatically into your wallet.",
  },
  {
    q: "What is the Lucky Draw?",
    a: "Spin the wheel daily for a chance to win cash bonuses. Invite friends to unlock more spins. When your lottery balance reaches the goal, you can withdraw it.",
  },
  {
    q: "Is my money safe?",
    a: "Payments are processed through Paystack (PCI-DSS certified). We never store your card details. Always keep your password and OTP private — our team will NEVER ask for them.",
  },
];

type Msg = { role: "user" | "assistant"; content: string };

function Chat() {
  const ask = useServerFn(askSupport);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hi 👋 I'm InvestPro Support AI. Tap a question below or type your own — I'll help you learn how the site works." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setBusy(true);
    try {
      const { reply } = await ask({ data: { message: q, history: msgs.slice(-10) } });
      setMsgs([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reach support AI");
      setMsgs([...next, { role: "assistant", content: "Sorry, I couldn't respond right now. Please try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-3 py-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-red-500 to-orange-400 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold">InvestPro Support AI</div>
          <div className="text-[11px] text-emerald-600">● Online — instant answers</div>
        </div>
        <Link to="/message" className="text-xs font-semibold text-brand">Inbox</Link>
      </header>

      <div className="space-y-3 px-3 py-4">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
              m.role === "user"
                ? "rounded-br-sm bg-brand text-white"
                : "rounded-bl-sm bg-white ring-1 ring-border"
            }`}>{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-3.5 py-2.5 text-sm ring-1 ring-border">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {msgs.length <= 2 && (
        <div className="px-3 pb-2">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Frequently asked</div>
          <div className="flex flex-col gap-2">
            {FAQS.map((f, i) => (
              <button
                key={i}
                onClick={() => {
                  setMsgs((m) => [...m, { role: "user", content: f.q }, { role: "assistant", content: f.a }]);
                }}
                className="rounded-xl border bg-white px-3 py-2 text-left text-sm shadow-sm hover:bg-muted"
              >
                <div className="font-semibold">{f.q}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{f.a}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="sticky bottom-16 z-10 flex items-center gap-2 border-t bg-white px-3 py-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about withdrawal, recharge, investment…"
          className="flex-1 rounded-full border bg-muted px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
        <button type="submit" disabled={busy || !input.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>

      <SupportBadge />
      <BottomNav />
    </AppShell>
  );
}
