import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SupportBadge } from "@/components/support-badge";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/free-cash")({
  head: () => ({ meta: [{ title: "Free cash — InvestPro" }] }),
  component: FreeCashPage,
});

function FreeCashPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function redeem() {
    if (!code.trim()) return toast.error("Enter a code");
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) { setLoading(false); navigate({ to: "/auth" }); return; }
    const { data, error } = await supabase.rpc("redeem_free_cash", { _code: code.trim() });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`+₦${Number((data as any).amount).toLocaleString()} credited`);
    qc.invalidateQueries({ queryKey: ["wallet"] });
    setCode("");
  }

  return (
    <div className="min-h-screen bg-yellow-300 pb-24">
      <div className="flex items-center justify-between px-4 pt-4">
        <button onClick={() => history.back()} className="grid h-9 w-9 place-items-center rounded-full"><ArrowLeft className="h-5 w-5" /></button>
        <div className="font-semibold">Free cash</div>
        <span className="w-9" />
      </div>

      <div className="mt-6 grid place-items-center">
        <div className="text-6xl">🎁</div>
      </div>

      <div className="mx-4 mt-6 rounded-2xl bg-yellow-200/60 p-6 shadow-lg">
        <div className="text-center text-lg font-semibold">Receive free money</div>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter free bonus code"
          className="mt-4 h-14 rounded-2xl border-0 bg-white text-center text-base"
        />
        <Button onClick={redeem} disabled={loading} className="mt-4 h-14 w-full rounded-full bg-red-700 text-base font-semibold hover:bg-red-800">
          {loading ? "Redeeming…" : "Receive"}
        </Button>
      </div>

      <div className="mt-6 space-y-2 px-5 text-sm text-foreground">
        <p>👑 <b>Free Cash!</b></p>
        <p>💎 Enter the reward code to receive a random reward! Top reward: 10,000 Naira!</p>
        <p>💎 Reward codes are distributed daily. Join our Telegram channel to easily earn rewards. Don't hesitate!</p>
      </div>

      <SupportBadge />
    </div>
  );
}
