import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { uploadAndGetUrl } from "@/lib/storage";

export const Route = createFileRoute("/admin/banners")({
  component: AdminBanners,
});

function AdminBanners() {
  const qc = useQueryClient();
  const { data: banners = [] } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => (await supabase.from("banners").select("*").order("sort_order")).data ?? [],
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Every banner image shown on the app is editable here. Upload a new image to replace it instantly.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {banners.map((b) => <BannerCard key={b.id} banner={b} onSaved={() => qc.invalidateQueries({ queryKey: ["banners"] })} />)}
      </div>
      <NewBanner onCreated={() => qc.invalidateQueries({ queryKey: ["admin-banners"] })} />
    </div>
  );
}

function BannerCard({ banner, onSaved }: { banner: any; onSaved: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(banner.title ?? "");
  const [subtitle, setSubtitle] = useState(banner.subtitle ?? "");
  const [link, setLink] = useState(banner.link ?? "");
  const [active, setActive] = useState(banner.is_active);
  const [url, setUrl] = useState(banner.image_url ?? "");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setTitle(banner.title ?? ""); setSubtitle(banner.subtitle ?? "");
    setLink(banner.link ?? ""); setActive(banner.is_active); setUrl(banner.image_url ?? "");
  }, [banner]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("banners").update({
        title, subtitle, link, is_active: active, image_url: url || null, updated_at: new Date().toISOString(),
      }).eq("id", banner.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Banner saved"); qc.invalidateQueries({ queryKey: ["admin-banners"] }); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { setUrl(await uploadAndGetUrl("banners", file)); toast.success("Image uploaded"); }
    catch (err: any) { toast.error(err.message); } finally { setUploading(false); }
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold">{banner.key}</div>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>
      <div className="mb-3 aspect-[16/7] w-full overflow-hidden rounded-lg bg-muted">
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="space-y-2">
        <div><Label className="text-xs">Image</Label><Input type="file" accept="image/*" onChange={onFile} disabled={uploading} /></div>
        <div><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label className="text-xs">Subtitle</Label><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
        <div><Label className="text-xs">Link</Label><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/wallet" /></div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </Card>
  );
}

function NewBanner({ onCreated }: { onCreated: () => void }) {
  const [key, setKey] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      if (!key.trim()) throw new Error("key required");
      const { error } = await supabase.from("banners").insert({ key: key.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Banner created"); setKey(""); onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="p-4">
      <h3 className="mb-2 font-semibold">Add new banner slot</h3>
      <div className="flex gap-2">
        <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. promo_top" />
        <Button onClick={() => create.mutate()} disabled={create.isPending}>Create</Button>
      </div>
    </Card>
  );
}
