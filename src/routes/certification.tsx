import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { uploadAndGetUrl } from "@/lib/storage";
import { SupportBadge } from "@/components/support-badge";

export const Route = createFileRoute("/certification")({
  head: () => ({ meta: [{ title: "Withdrawal proofs — InvestPro" }] }),
  component: CertificationPage,
});

function CertificationPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const uid = data.session.user.id;
      setUserId(uid);
      const { data: p } = await supabase.from("profiles").select("phone").eq("id", uid).maybeSingle();
      setPhone(p?.phone ?? "");
    });
  }, []);

  const { data: proofs = [] } = useQuery({
    queryKey: ["withdraw-proofs"],
    queryFn: async () => {
      const { data } = await supabase.from("withdrawal_proofs").select("*").order("created_at", { ascending: false }).limit(60);
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  async function submit() {
    if (!userId) return navigate({ to: "/auth" });
    if (!amount || !caption || !file) return toast.error("Image, amount and caption required");
    setSubmitting(true);
    try {
      const path = `proofs/${userId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const masked = "+234" + phone.replace(/[^0-9]/g, "").slice(0, 3) + "****" + phone.replace(/[^0-9]/g, "").slice(-3);
      const { error } = await supabase.from("withdrawal_proofs").insert({
        user_id: userId,
        phone_masked: masked,
        amount: Number(amount),
        caption,
        image_url: pub.publicUrl,
        is_ai: false,
      });
      if (error) throw error;
      toast.success("Proof posted");
      setOpen(false); setAmount(""); setCaption(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["withdraw-proofs"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm">
        <button onClick={() => history.back()} className="grid h-9 w-9 place-items-center rounded-full"><ArrowLeft className="h-5 w-5" /></button>
        <div className="font-semibold">Withdrawal proofs</div>
        <span className="w-9" />
      </div>

      <div className="m-4 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-orange-200 to-yellow-100 p-4 shadow-sm">
        <div className="flex-1">
          <div className="text-base font-extrabold uppercase leading-tight tracking-tight">Upload your own withdrawal voucher to get cash rewards</div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="mt-3 rounded-full bg-red-600 hover:bg-red-700"><Upload className="mr-2 h-4 w-4" /> Upload proof</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <div className="text-base font-semibold">Upload withdrawal proof</div>
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Amount (₦)" />
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (e.g. Thanks InvestPro!)" maxLength={140} />
              <Button onClick={submit} disabled={submitting} className="w-full bg-red-600 hover:bg-red-700">{submitting ? "Posting…" : "Post"}</Button>
            </DialogContent>
          </Dialog>
        </div>
        <div className="text-5xl">💰</div>
      </div>

      <h3 className="px-4 pt-2 text-center text-base font-bold">User upload proofs</h3>

      <div className="space-y-3 px-4 pt-3">
        {proofs.map((p: any) => (
          <div key={p.id} className="flex items-start gap-3 rounded-2xl border bg-white p-3 shadow-sm">
            <div className="flex-1 space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="font-bold">{p.phone_masked}</span>
                <span className="font-bold text-red-600">+{Number(p.amount).toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(p.created_at).toISOString().slice(0, 10)}</div>
              <div className="text-sm">{p.caption}</div>
            </div>
            {p.image_url && (
              <img src={p.image_url} alt="proof" className="h-24 w-20 rounded-lg border object-cover" />
            )}
          </div>
        ))}
        {proofs.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-sm text-muted-foreground">No proofs yet</div>
        )}
      </div>

      <SupportBadge />
    </div>
  );
}
