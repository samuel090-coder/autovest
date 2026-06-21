import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Edit the two welcome popups and the Recharge page content shown to users.
      </p>
      <Announce1 />
      <Announce2 />
      <RechargeEditor />
    </div>
  );
}

function useSetting(key: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["setting", key],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", key).maybeSingle();
      return data?.value ?? {};
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
      qc.invalidateQueries({ queryKey: ["announcements"] });
      qc.invalidateQueries({ queryKey: ["recharge-settings"] });
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
  useEffect(() => {
    if (!data) return;
    setEnabled(!!data.enabled);
    setTitle(data.title ?? "");
    setBody(data.body ?? "");
  }, [data]);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Welcome popup #1</h3>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div>
        <Label className="text-xs">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Body (URLs become clickable links)</Label>
        <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <Button onClick={() => save.mutate({ enabled, title, body })} disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save popup #1"}
      </Button>
    </Card>
  );
}

function Announce2() {
  const { data, save } = useSetting("announce_2");
  const [enabled, setEnabled] = useState(true);
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  useEffect(() => {
    if (!data) return;
    setEnabled(!!data.enabled);
    setBody(data.body ?? "");
    setCtaLabel(data.cta_label ?? "");
    setCtaUrl(data.cta_url ?? "");
  }, [data]);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Welcome popup #2</h3>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div>
        <Label className="text-xs">Body</Label>
        <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">CTA label</Label>
          <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">CTA URL</Label>
          <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <Button onClick={() => save.mutate({ enabled, body, cta_label: ctaLabel, cta_url: ctaUrl })} disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save popup #2"}
      </Button>
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
      const value = {
        presets: presets.split(",").map((s) => Number(s.trim())).filter((n) => n > 0),
        bonus_map: JSON.parse(bonusJson || "{}"),
        instructions,
        channels: JSON.parse(channelsJson || "[]"),
      };
      save.mutate(value);
    } catch (e: any) {
      toast.error(`Invalid JSON: ${e.message}`);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Recharge page</h3>
      <div>
        <Label className="text-xs">Amount presets (comma separated, in ₦)</Label>
        <Input value={presets} onChange={(e) => setPresets(e.target.value)} placeholder="2800, 16000, 35000" />
      </div>
      <div>
        <Label className="text-xs">Bonus map (JSON: {"{ \"66000\": \"2000\" }"})</Label>
        <Textarea rows={5} className="font-mono text-xs" value={bonusJson} onChange={(e) => setBonusJson(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Top-up instructions</Label>
        <Textarea rows={10} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Payment channels (JSON array)</Label>
        <Textarea
          rows={8}
          className="font-mono text-xs"
          value={channelsJson}
          onChange={(e) => setChannelsJson(e.target.value)}
          placeholder='[{"name":"Opay","bank":"Opay","account_name":"InvestPro","account_number":"9012345678","color":"#e53935"}]'
        />
      </div>
      <Button onClick={onSave} disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save recharge settings"}
      </Button>
    </Card>
  );
}
