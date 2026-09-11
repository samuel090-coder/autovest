import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetUrl } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, Send, Clock, Users } from "lucide-react";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotifications,
});

const AUDIENCES = [
  { key: "all", label: "All users" },
  { key: "active_investors", label: "Active investors" },
  { key: "completed_investments", label: "Completed investments" },
  { key: "no_investment", label: "Never invested" },
  { key: "inactive", label: "Inactive (7 days)" },
  { key: "with_balance", label: "Has balance" },
  { key: "pending_deposits", label: "Pending deposits" },
];

function AdminNotifications() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [url, setUrl] = useState("/");
  const [actionLabel, setActionLabel] = useState("Open");
  const [audience, setAudience] = useState("all");
  const [scheduledAt, setScheduledAt] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: sizes } = useQuery({
    queryKey: ["audience-size", audience],
    queryFn: async () => {
      const { data } = await supabase.rpc("audience_user_ids", { _audience: audience });
      return (data ?? []).length;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_broadcasts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async (mode: "now" | "schedule") => {
      if (!title.trim()) throw new Error("Add a title");
      const { data: auth } = await supabase.auth.getUser();
      const { data: row, error } = await supabase
        .from("notification_broadcasts")
        .insert({
          title: title.trim(),
          body: body.trim(),
          image_url: imageUrl || null,
          url: url || "/",
          action_label: actionLabel || null,
          audience,
          status: mode === "schedule" ? "scheduled" : "draft",
          scheduled_at: mode === "schedule" ? new Date(scheduledAt).toISOString() : null,
          created_by: auth.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      if (mode === "now") {
        const { data: res, error: e2 } = await supabase.rpc("admin_send_broadcast", { _id: row.id });
        if (e2) throw e2;
        return res as { recipients?: number };
      }
      return { recipients: 0 };
    },
    onSuccess: (res, mode) => {
      toast.success(mode === "now" ? `Sent to ${res?.recipients ?? 0} users` : "Scheduled");
      setTitle(""); setBody(""); setImageUrl(""); setScheduledAt("");
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function pickImage(file: File) {
    setUploading(true);
    try {
      setImageUrl(await uploadAndGetUrl("banners", file));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-brand" />
          <h2 className="font-semibold">Send a notification</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Big weekend bonus is live" />
          </div>
          <div className="sm:col-span-2">
            <Label>Message</Label>
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Invest today and enjoy an extra reward on every product." />
          </div>
          <div>
            <Label>Audience</Label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {AUDIENCES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" /> {sizes ?? "…"} recipients
            </p>
          </div>
          <div>
            <Label>Destination page</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/earn-more" />
          </div>
          <div>
            <Label>Action button label</Label>
            <Input value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} placeholder="Claim now" />
          </div>
          <div>
            <Label>Schedule (optional)</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Image (optional)</Label>
            <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickImage(f); }} />
            {uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send.mutate("now")} disabled={send.isPending} className="bg-brand text-white">
            <Send className="mr-1.5 h-4 w-4" /> {send.isPending ? "Sending…" : "Send now"}
          </Button>
          <Button
            variant="outline"
            disabled={send.isPending || !scheduledAt}
            onClick={() => send.mutate("schedule")}
          >
            <Clock className="mr-1.5 h-4 w-4" /> Schedule
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Scheduled announcements go out on the next hour. “Send now” delivers instantly.
        </p>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Preview</h3>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex gap-3 p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="break-words text-sm font-semibold">{title || "Notification title"}</div>
                <p className="mt-0.5 break-words text-xs text-muted-foreground">{body || "Your message appears here."}</p>
                <div className="mt-1 text-[10px] uppercase text-muted-foreground">announcement • now</div>
              </div>
            </div>
            {imageUrl && <img src={imageUrl} alt="" className="h-32 w-full object-cover" />}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Recent broadcasts</h3>
          <div className="space-y-2">
            {history.length === 0 && <p className="text-xs text-muted-foreground">No broadcasts yet.</p>}
            {history.map((b: any) => (
              <div key={b.id} className="rounded-lg border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-xs font-semibold">{b.title}</div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${b.status === "sent" ? "bg-success/15 text-success" : "bg-warning/20 text-warning"}`}>
                    {b.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {b.audience} • {b.recipients} sent • {b.delivered} delivered • {b.failed} failed
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
