import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";
import { useState } from "react";

export const Route = createFileRoute("/admin/complaints")({
  component: AdminComplaints,
});

function AdminComplaints() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-complaints"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("payment_complaints")
        .select("*, profile:profiles(full_name,email,phone)")
        .order("created_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, admin_note }: { id: string; status: string; admin_note?: string }) => {
      const { error } = await (supabase as any)
        .from("payment_complaints")
        .update({ status, ...(admin_note !== undefined ? { admin_note } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-complaints"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const creditUser = useMutation({
    mutationFn: async ({ userId, amount, complaintId }: { userId: string; amount: number; complaintId: string }) => {
      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        type: "recharge",
        amount,
        status: "approved",
        meta: { source: "manual_complaint_credit", complaint_id: complaintId },
      });
      if (error) throw error;
      const { error: e2 } = await (supabase as any)
        .from("payment_complaints")
        .update({ status: "resolved", admin_note: "Manually credited via admin" })
        .eq("id", complaintId);
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success("User credited"); qc.invalidateQueries({ queryKey: ["admin-complaints"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-base font-semibold">Payment Complaints</h2>
      <div className="space-y-3">
        {rows.length === 0 && <div className="text-sm text-muted-foreground">No complaints yet.</div>}
        {rows.map((c: any) => (
          <ComplaintCard
            key={c.id}
            c={c}
            onUpdate={(status, note) => updateStatus.mutate({ id: c.id, status, admin_note: note })}
            onCredit={(amount) => creditUser.mutate({ userId: c.user_id, amount, complaintId: c.id })}
          />
        ))}
      </div>
    </Card>
  );
}

function ComplaintCard({
  c,
  onUpdate,
  onCredit,
}: {
  c: any;
  onUpdate: (status: string, note?: string) => void;
  onCredit: (amount: number) => void;
}) {
  const [note, setNote] = useState(c.admin_note ?? "");
  const [creditAmt, setCreditAmt] = useState(String(c.amount));
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{c.profile?.full_name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{c.profile?.email} • {c.profile?.phone}</div>
          <div className="mt-1 text-sm">Claim: <b>{formatNaira(c.amount)}</b></div>
          <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          c.status === "resolved" ? "bg-emerald-100 text-emerald-700"
          : c.status === "rejected" ? "bg-red-100 text-red-700"
          : "bg-amber-100 text-amber-700"
        }`}>{c.status}</span>
      </div>

      <p className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-2 text-sm">{c.description}</p>

      {c.screenshot_url && (
        <a href={c.screenshot_url} target="_blank" rel="noreferrer" className="mt-2 block">
          <img src={c.screenshot_url} alt="Proof" className="max-h-64 rounded border object-contain" />
        </a>
      )}

      <div className="mt-3 space-y-2">
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Admin note (optional)"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs">Credit ₦</span>
            <Input
              className="h-8 w-28"
              value={creditAmt}
              onChange={(e) => setCreditAmt(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
            />
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                const a = Number(creditAmt);
                if (!a || a <= 0) return toast.error("Enter a valid amount");
                onCredit(a);
              }}
            >
              Credit & Resolve
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => onUpdate("resolved", note)}>
            Mark Resolved
          </Button>
          <Button size="sm" variant="outline" onClick={() => onUpdate("rejected", note)}>
            Reject
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onUpdate(c.status, note)}>
            Save Note
          </Button>
        </div>
      </div>
    </div>
  );
}
