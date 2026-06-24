import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { uploadAndGetUrl } from "@/lib/storage";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  return (
    <Tabs defaultValue="popups" className="space-y-4">
      <div className="-mx-2 overflow-x-auto px-2">
        <TabsList className="inline-flex w-max flex-nowrap gap-1">
          <TabsTrigger value="popups">Popups</TabsTrigger>
          <TabsTrigger value="recharge">Recharge</TabsTrigger>
          <TabsTrigger value="paystack">Paystack</TabsTrigger>
          <TabsTrigger value="apk">APK</TabsTrigger>
          <TabsTrigger value="lucky">Lucky draw</TabsTrigger>
          <TabsTrigger value="freecash">Free cash</TabsTrigger>
          <TabsTrigger value="bonus">Bonus</TabsTrigger>
          <TabsTrigger value="proofs">Proofs</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="popups" className="space-y-4"><Announce1 /><Announce2 /></TabsContent>
      <TabsContent value="recharge"><RechargeEditor /></TabsContent>
      <TabsContent value="paystack"><PaystackEditor /></TabsContent>
      <TabsContent value="apk"><ApkEditor /></TabsContent>
      <TabsContent value="lucky"><LuckyEditor /></TabsContent>
      <TabsContent value="freecash"><FreeCashAdmin /></TabsContent>
      <TabsContent value="bonus"><CashBenefitsEditor /></TabsContent>
      <TabsContent value="proofs"><ProofsAdmin /></TabsContent>
    </Tabs>

  );
}

function useSetting(key: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["setting", key],
    queryFn: async (): Promise<Record<string, any>> => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", key).maybeSingle();
      const v = data?.value;
      if (v == null) return {};
      if (typeof v === "string") return { _raw: v };
      return v as Record<string, any>;
    },
  });
  const save = useMutation({
    mutationFn: async (value: any) => {
      const { error } = await supabase.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["setting", key] });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return { ...q, save };
}

function Announce1() {
  const { data, save } = useSetting("announce_1");
  const [enabled, setEnabled] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  useEffect(() => { if (!data) return; setEnabled(!!data.enabled); setTitle(data.title ?? ""); setBody(data.body ?? ""); }, [data]);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between"><h3 className="font-semibold">Welcome popup #1</h3><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
      <div><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><Label className="text-xs">Body (URLs become clickable)</Label><Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <Button onClick={() => save.mutate({ enabled, title, body })} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save popup #1"}</Button>
    </Card>
  );
}

function Announce2() {
  const { data, save } = useSetting("announce_2");
  const [enabled, setEnabled] = useState(true);
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  useEffect(() => { if (!data) return; setEnabled(!!data.enabled); setBody(data.body ?? ""); setCtaLabel(data.cta_label ?? ""); setCtaUrl(data.cta_url ?? ""); }, [data]);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between"><h3 className="font-semibold">Welcome popup #2</h3><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
      <div><Label className="text-xs">Body</Label><Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">CTA label</Label><Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} /></div>
        <div><Label className="text-xs">CTA URL</Label><Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…" /></div>
      </div>
      <Button onClick={() => save.mutate({ enabled, body, cta_label: ctaLabel, cta_url: ctaUrl })} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save popup #2"}</Button>
    </Card>
  );
}

function RechargeEditor() {
  const { data, save } = useSetting("recharge");
  const [presets, setPresets] = useState("");
  const [bonusJson, setBonusJson] = useState("");
  const [instructions, setInstructions] = useState("");
  const [channelsJson, setChannelsJson] = useState("");
  useEffect(() => {
    if (!data) return;
    setPresets((data.presets ?? []).join(", "));
    setBonusJson(JSON.stringify(data.bonus_map ?? {}, null, 2));
    setInstructions(data.instructions ?? "");
    setChannelsJson(JSON.stringify(data.channels ?? [], null, 2));
  }, [data]);
  function onSave() {
    try {
      save.mutate({
        presets: presets.split(",").map((s) => Number(s.trim())).filter((n) => n > 0),
        bonus_map: JSON.parse(bonusJson || "{}"),
        instructions,
        channels: JSON.parse(channelsJson || "[]"),
      });
    } catch (e: any) { toast.error(`Invalid JSON: ${e.message}`); }
  }
  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Recharge page</h3>
      <div><Label className="text-xs">Amount presets (comma separated, ₦)</Label><Input value={presets} onChange={(e) => setPresets(e.target.value)} /></div>
      <div><Label className="text-xs">Bonus map (JSON)</Label><Textarea rows={5} className="font-mono text-xs" value={bonusJson} onChange={(e) => setBonusJson(e.target.value)} /></div>
      <div><Label className="text-xs">Top-up instructions</Label><Textarea rows={8} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></div>
      <div><Label className="text-xs">Payment channels (JSON array)</Label><Textarea rows={8} className="font-mono text-xs" value={channelsJson} onChange={(e) => setChannelsJson(e.target.value)} /></div>
      <Button onClick={onSave} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save recharge settings"}</Button>
    </Card>
  );
}

function PaystackEditor() {
  const { data, save } = useSetting("paystack");
  const [enabled, setEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [mode, setMode] = useState<"live" | "test">("live");
  useEffect(() => { if (!data) return; setEnabled(!!data.enabled); setPublicKey(data.public_key ?? ""); setMode((data.mode ?? "live") as any); }, [data]);
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/hooks/paystack` : "/api/public/hooks/paystack";
  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Paystack payment integration</h3>
      <p className="text-xs text-muted-foreground">
        Paste your Paystack <b>public key</b> below — it must start with <code>pk_live_</code> (live) or <code>pk_test_</code> (sandbox).
        If you see "Please enter a valid Key" on the Paystack checkout it means the key here is wrong, blank, or doesn't match the mode.
      </p>
      <div className="flex items-center justify-between"><Label>Enabled</Label><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
      <div><Label className="text-xs">Public key</Label><Input value={publicKey} onChange={(e) => setPublicKey(e.target.value.trim())} placeholder="pk_live_…" /></div>
      <div className="flex items-center gap-2"><Label>Mode</Label>
        <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="rounded border px-2 py-1 text-sm">
          <option value="live">Live</option><option value="test">Test</option>
        </select>
      </div>
      <Button onClick={() => save.mutate({ enabled, public_key: publicKey, mode })} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>

      <div className="mt-4 rounded-lg border bg-muted/40 p-3">
        <div className="text-xs font-semibold">Webhook URL (paste this into Paystack → Settings → API Keys & Webhooks)</div>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 break-all rounded bg-background p-2 text-[11px]">{webhookUrl}</code>
          <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Webhook URL copied"); }}>Copy</Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Set the same URL as your Webhook URL and Test Webhook URL. The <code>PAYSTACK_SECRET_KEY</code> server secret is already saved — it's used to verify signatures.
        </p>
      </div>
    </Card>
  );
}

function LuckyEditor() {
  const { data: rulesData, save: saveRules } = useSetting("lucky_draw_rules");
  const { data: cfgData, save: saveCfg } = useSetting("lucky_draw_config");
  const [rules, setRules] = useState("");
  const [goal, setGoal] = useState("100000");
  const [base, setBase] = useState("10");
  const [refTarget, setRefTarget] = useState("15");
  const [curve, setCurve] = useState("");
  const [refMin, setRefMin] = useState("150");
  const [refMax, setRefMax] = useState("650");
  useEffect(() => {
    if (rulesData) setRules(rulesData._raw ?? "");
    if (cfgData) {
      setGoal(String(cfgData.goal ?? 100000));
      setBase(String(cfgData.base_spins ?? 10));
      setRefTarget(String(cfgData.referral_target ?? 15));
      setCurve(JSON.stringify(cfgData.base_curve ?? []));
      setRefMin(String(cfgData.referral_reward_min ?? 150));
      setRefMax(String(cfgData.referral_reward_max ?? 650));
    }
  }, [rulesData, cfgData]);
  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Lucky draw rules & curve</h3>
      <div><Label className="text-xs">Rules text (shown in popup & Rules button)</Label><Textarea rows={10} value={rules} onChange={(e) => setRules(e.target.value)} /></div>
      <Button variant="secondary" onClick={() => saveRules.mutate(rules)} disabled={saveRules.isPending}>Save rules</Button>
      <hr />
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Goal (₦)</Label><Input value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
        <div><Label className="text-xs">Base spins</Label><Input value={base} onChange={(e) => setBase(e.target.value)} /></div>
        <div><Label className="text-xs">Referral target</Label><Input value={refTarget} onChange={(e) => setRefTarget(e.target.value)} /></div>
        <div><Label className="text-xs">Referral reward min</Label><Input value={refMin} onChange={(e) => setRefMin(e.target.value)} /></div>
        <div><Label className="text-xs">Referral reward max</Label><Input value={refMax} onChange={(e) => setRefMax(e.target.value)} /></div>
      </div>
      <div><Label className="text-xs">Base curve (JSON array, length = base spins)</Label>
        <Textarea rows={3} className="font-mono text-xs" value={curve} onChange={(e) => setCurve(e.target.value)} />
        <p className="text-[11px] text-muted-foreground">Sum must stay under the goal so users don't auto-hit it on base spins.</p>
      </div>
      <Button onClick={() => {
        try {
          saveCfg.mutate({
            goal: Number(goal), base_spins: Number(base), referral_target: Number(refTarget),
            base_curve: JSON.parse(curve), referral_reward_min: Number(refMin), referral_reward_max: Number(refMax),
          });
        } catch (e: any) { toast.error(`Invalid curve: ${e.message}`); }
      }}>Save curve</Button>
    </Card>
  );
}

function FreeCashAdmin() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [max, setMax] = useState("1");
  const [days, setDays] = useState("7");

  const { data: codes = [] } = useQuery({
    queryKey: ["free-cash-codes"],
    queryFn: async () => (await supabase.from("free_cash_codes").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const c = code.trim().toUpperCase() || Math.random().toString(36).slice(2, 10).toUpperCase();
      const expires_at = days ? new Date(Date.now() + Number(days) * 86400_000).toISOString() : null;
      const { error } = await supabase.from("free_cash_codes").insert({
        code: c, amount: Number(amount), max_redemptions: Number(max), expires_at, is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Code created"); setCode(""); setAmount(""); qc.invalidateQueries({ queryKey: ["free-cash-codes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Free cash codes</h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Input placeholder="Code (blank = random)" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input placeholder="Amount ₦" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} />
        <Input placeholder="Max redemptions" value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9]/g, ""))} />
        <Input placeholder="Expires in days" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))} />
      </div>
      <Button onClick={() => create.mutate()} disabled={create.isPending || !amount}>{create.isPending ? "Creating…" : "Create code"}</Button>

      <div className="mt-4 space-y-1 text-sm">
        {codes.map((c: any) => (
          <div key={c.id} className="flex items-center justify-between rounded border p-2">
            <div>
              <div className="font-mono font-bold">{c.code}</div>
              <div className="text-xs text-muted-foreground">
                ₦{Number(c.amount).toLocaleString()} · {c.redeemed_count}/{c.max_redemptions} used · {c.expires_at ? `expires ${new Date(c.expires_at).toLocaleDateString()}` : "no expiry"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!c.is_active} onCheckedChange={async (v) => { await supabase.from("free_cash_codes").update({ is_active: v }).eq("id", c.id); qc.invalidateQueries({ queryKey: ["free-cash-codes"] }); }} />
              <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("free_cash_codes").delete().eq("id", c.id); qc.invalidateQueries({ queryKey: ["free-cash-codes"] }); }}><Trash2 className="h-4 w-4 text-red-600" /></Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CashBenefitsEditor() {
  const { data, save } = useSetting("cash_benefits");
  const [video, setVideo] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [minWith, setMinWith] = useState("6000");
  const [uploading, setUploading] = useState(false);
  useEffect(() => { if (!data) return; setVideo(data.video_url ?? ""); setHeadline(data.headline ?? "Bonus Task"); setBody(data.body ?? ""); setMinWith(String(data.min_withdrawal ?? 6000)); }, [data]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try {
      const url = await uploadAndGetUrl("banners", f, `cash-benefits/${Date.now()}_${f.name}`);
      setVideo(url);
      toast.success("Uploaded");
    } catch (err: any) { toast.error(err.message); }
    setUploading(false);
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Cash Benefits page (Bonus Task)</h3>
      <div><Label className="text-xs">Headline</Label><Input value={headline} onChange={(e) => setHeadline(e.target.value)} /></div>
      <div><Label className="text-xs">Min withdrawal (₦)</Label><Input value={minWith} onChange={(e) => setMinWith(e.target.value.replace(/[^0-9]/g, ""))} /></div>
      <div><Label className="text-xs">Body text</Label><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <div>
        <Label className="text-xs">Video URL</Label>
        <Input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://… or upload below" />
        <Input type="file" accept="video/*" onChange={onUpload} className="mt-2" />
        {uploading && <div className="text-xs">Uploading…</div>}
      </div>
      <Button onClick={() => save.mutate({ video_url: video, headline, body, min_withdrawal: Number(minWith) })} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
    </Card>
  );
}

function ProofsAdmin() {
  const qc = useQueryClient();
  const { data: proofs = [] } = useQuery({
    queryKey: ["admin-proofs"],
    queryFn: async () => (await supabase.from("withdrawal_proofs").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  async function generateNow() {
    const url = `${window.location.origin}/api/public/hooks/generate-proof`;
    const r = await fetch(url, { method: "POST" });
    if (r.ok) { toast.success("New AI proof generated"); qc.invalidateQueries({ queryKey: ["admin-proofs"] }); }
    else toast.error(await r.text());
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Withdrawal proofs feed</h3>
        <Button size="sm" onClick={generateNow}>Generate AI proof now</Button>
      </div>
      <p className="text-xs text-muted-foreground">Cron job posts a fresh AI proof every 30 minutes. Manage entries below.</p>
      <div className="max-h-[600px] space-y-1 overflow-y-auto">
        {proofs.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
            <div className="flex items-center gap-3">
              {p.image_url && <img src={p.image_url} className="h-12 w-12 rounded object-cover" alt="" />}
              <div>
                <div className="font-semibold">{p.phone_masked} <span className="text-red-600">+₦{Number(p.amount).toLocaleString()}</span> {p.is_ai && <span className="ml-1 rounded bg-purple-100 px-1.5 text-[10px] text-purple-700">AI</span>}</div>
                <div className="text-xs text-muted-foreground">{p.caption}</div>
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("withdrawal_proofs").delete().eq("id", p.id); qc.invalidateQueries({ queryKey: ["admin-proofs"] }); }}><Trash2 className="h-4 w-4 text-red-600" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ApkEditor() {
  const { data, save } = useSetting("app_download");
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("");
  const [uploading, setUploading] = useState(false);
  useEffect(() => { if (!data) return; setUrl(data.url ?? ""); setVersion(data.version ?? ""); }, [data]);
  async function onUpload(f: File | null) {
    if (!f) return;
    setUploading(true);
    try {
      const signed = await uploadAndGetUrl("banners", f, `apk/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
      setUrl(signed);
      toast.success("APK uploaded — click Save");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  }
  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">APK download link</h3>
      <p className="text-xs text-muted-foreground">
        Paste a direct .apk URL OR upload the APK file. The login page's "APP Download" button
        downloads this file without leaving the site.
      </p>
      <div><Label className="text-xs">Direct APK URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/app.apk" /></div>
      <div><Label className="text-xs">Upload .apk</Label><Input type="file" accept=".apk,application/vnd.android.package-archive" onChange={(e) => onUpload(e.target.files?.[0] ?? null)} disabled={uploading} /></div>
      <div><Label className="text-xs">Version (optional)</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" /></div>
      <Button onClick={() => save.mutate({ url, version })} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
    </Card>
  );
}

