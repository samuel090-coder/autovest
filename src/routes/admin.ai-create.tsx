import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Upload as UploadIcon, ImageIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { extractInvestmentFromImage } from "@/lib/ai-extract.functions";
import { uploadAndGetUrl } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/ai-create")({
  component: AiCreate,
});

type Extracted = {
  name: string; price: number; cycle_days: number; daily_income: number;
  total_income: number; description: string; category: "welfare" | "product";
};

function AiCreate() {
  const navigate = useNavigate();
  const extract = useServerFn(extractInvestmentFromImage);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [data, setData] = useState<Extracted | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  async function onScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function runExtract() {
    if (!screenshot) return;
    setExtracting(true);
    try {
      const result = await extract({ data: { imageDataUrl: screenshot } });
      setData(result);
      toast.success("AI extracted the investment");
    } catch (err: any) {
      toast.error(err?.message ?? "Extraction failed");
    } finally { setExtracting(false); }
  }

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const url = await uploadAndGetUrl("investment-images", file); setCoverUrl(url); toast.success("Cover uploaded"); }
    catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  }

  async function postNow() {
    if (!data) return;
    setPosting(true);
    try {
      const { error } = await supabase.from("investments").insert({
        ...data, image_url: coverUrl || null, is_active: true, sort_order: 0,
      });
      if (error) throw error;
      toast.success("Investment posted");
      navigate({ to: "/admin/investments" });
    } catch (err: any) { toast.error(err.message); }
    finally { setPosting(false); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="mb-1 text-base font-semibold inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /> 1. Upload screenshot</h2>
        <p className="mb-3 text-sm text-muted-foreground">Upload a screenshot of an investment card. AI will fill the fields automatically.</p>
        <Input type="file" accept="image/*" onChange={onScreenshot} />
        {screenshot && (
          <div className="mt-3">
            <img src={screenshot} alt="screenshot" className="max-h-80 w-full rounded-lg border object-contain" />
            <Button onClick={runExtract} disabled={extracting} className="mt-3 w-full">
              {extracting ? "Analyzing…" : <><Sparkles className="mr-2 h-4 w-4" /> Extract with AI</>}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-base font-semibold">2. Review & Post</h2>
        {!data ? (
          <p className="text-sm text-muted-foreground">Run AI extraction first. The form will appear here.</p>
        ) : (
          <div className="space-y-3">
            <Field label="Name"><Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Price (₦)"><Input type="number" value={data.price} onChange={(e) => setData({ ...data, price: Number(e.target.value) })} /></Field>
              <Field label="Cycle (days)"><Input type="number" value={data.cycle_days} onChange={(e) => setData({ ...data, cycle_days: Number(e.target.value) })} /></Field>
              <Field label="Daily income"><Input type="number" value={data.daily_income} onChange={(e) => setData({ ...data, daily_income: Number(e.target.value) })} /></Field>
              <Field label="Total income"><Input type="number" value={data.total_income} onChange={(e) => setData({ ...data, total_income: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Description"><Textarea rows={4} value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} /></Field>
            <Field label="Category">
              <select className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={data.category}
                onChange={(e) => setData({ ...data, category: e.target.value as "welfare" | "product" })}>
                <option value="product">Product</option>
                <option value="welfare">Welfare (hero)</option>
              </select>
            </Field>
            <Field label="Investment cover image (upload yours)">
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*" onChange={onCover} disabled={uploading} />
                {coverUrl ? (
                  <img src={coverUrl} alt="cover" className="h-10 w-14 rounded object-cover" />
                ) : (
                  <div className="grid h-10 w-14 place-items-center rounded border bg-muted"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                )}
              </div>
            </Field>
            <Button onClick={postNow} disabled={posting} className="w-full">
              <UploadIcon className="mr-2 h-4 w-4" /> {posting ? "Posting…" : "Post investment"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
