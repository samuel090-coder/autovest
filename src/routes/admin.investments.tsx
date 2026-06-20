import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";
import { uploadAndGetUrl } from "@/lib/storage";
import { formatNaira } from "@/lib/format";
import { Pencil, Trash2, Plus, Sparkles } from "lucide-react";

export const Route = createFileRoute("/admin/investments")({
  component: AdminInvestments,
});

type FormState = {
  id?: string;
  name: string;
  price: string;
  cycle_days: string;
  daily_income: string;
  total_income: string;
  description: string;
  category: "welfare" | "product";
  is_hot: boolean;
  is_active: boolean;
  sort_order: string;
  image_url: string;
  max_rounds: string;
  is_flash_sale: boolean;
  flash_sale_price: string;
  flash_sale_discount_pct: string;
  flash_sale_route: string;
};

const empty: FormState = {
  name: "", price: "", cycle_days: "10", daily_income: "", total_income: "",
  description: "", category: "product", is_hot: false, is_active: true, sort_order: "0", image_url: "",
  max_rounds: "2", is_flash_sale: false, flash_sale_price: "", flash_sale_discount_pct: "", flash_sale_route: "/orders",
};

function AdminInvestments() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [uploading, setUploading] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["admin-investments"],
    queryFn: async () => (await supabase.from("investments").select("*").order("sort_order")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        name: f.name, price: Number(f.price), cycle_days: Number(f.cycle_days),
        daily_income: Number(f.daily_income), total_income: Number(f.total_income),
        description: f.description, category: f.category, is_hot: f.is_hot,
        is_active: f.is_active, sort_order: Number(f.sort_order), image_url: f.image_url || null,
        max_rounds: Number(f.max_rounds) || 2,
        is_flash_sale: f.is_flash_sale,
        flash_sale_price: f.is_flash_sale && f.flash_sale_price ? Number(f.flash_sale_price) : null,
        flash_sale_discount_pct: f.is_flash_sale && f.flash_sale_discount_pct ? Number(f.flash_sale_discount_pct) : null,
        flash_sale_route: f.is_flash_sale ? f.flash_sale_route : null,
      };
      if (f.id) {
        const { error } = await supabase.from("investments").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("investments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-investments"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["welfare-items"] });
      qc.invalidateQueries({ queryKey: ["flash-sale"] });
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-investments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const url = await uploadAndGetUrl("investment-images", file); setForm((s) => ({ ...s, image_url: url })); toast.success("Image uploaded"); }
    catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">All Investments ({items.length})</h2>
          <Link to="/admin/ai-create" className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white">
            <Sparkles className="h-4 w-4" /> AI Create
          </Link>
        </div>
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm text-muted-foreground">No investments yet.</p>}
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-md border p-3">
              <div className="h-14 w-16 overflow-hidden rounded bg-muted">
                {p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <div className="font-medium">{p.name} <span className="ml-2 text-xs text-muted-foreground">[{p.category}]</span></div>
                <div className="text-xs text-muted-foreground">{formatNaira(p.price)} · {p.cycle_days}d · daily {formatNaira(p.daily_income)}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setForm({
                id: p.id, name: p.name, price: String(p.price), cycle_days: String(p.cycle_days),
                daily_income: String(p.daily_income), total_income: String(p.total_income),
                description: p.description ?? "", category: p.category, is_hot: p.is_hot, is_active: p.is_active,
                sort_order: String(p.sort_order), image_url: p.image_url ?? "",
                max_rounds: String(p.max_rounds ?? 2),
                is_flash_sale: !!p.is_flash_sale,
                flash_sale_price: p.flash_sale_price != null ? String(p.flash_sale_price) : "",
                flash_sale_discount_pct: p.flash_sale_discount_pct != null ? String(p.flash_sale_discount_pct) : "",
                flash_sale_route: p.flash_sale_route ?? "/orders",
              })}><Pencil className="h-3 w-3" /></Button>
              <Button size="sm" variant="destructive" onClick={() => confirm("Delete?") && del.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 self-start">
        <h2 className="mb-3 text-base font-semibold inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> {form.id ? "Edit" : "New"} Investment
        </h2>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Price (₦)"><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></Field>
            <Field label="Cycle (days)"><Input type="number" value={form.cycle_days} onChange={(e) => setForm({ ...form, cycle_days: e.target.value })} required /></Field>
            <Field label="Daily income"><Input type="number" value={form.daily_income} onChange={(e) => setForm({ ...form, daily_income: e.target.value })} required /></Field>
            <Field label="Total income"><Input type="number" value={form.total_income} onChange={(e) => setForm({ ...form, total_income: e.target.value })} required /></Field>
          </div>
          <Field label="Category">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as "welfare" | "product" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Product (Product Center)</SelectItem>
                <SelectItem value="welfare">Welfare (Hero card)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description (one bullet per line)">
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Cover image">
            <div className="flex items-center gap-2">
              <Input type="file" accept="image/*" onChange={onFile} disabled={uploading} />
              {form.image_url && <img src={form.image_url} alt="" className="h-10 w-14 rounded object-cover" />}
            </div>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Sort"><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></Field>
            <Field label="Rounds"><Input type="number" value={form.max_rounds} onChange={(e) => setForm({ ...form, max_rounds: e.target.value })} /></Field>
            <Field label="Hot"><div className="pt-2"><Switch checked={form.is_hot} onCheckedChange={(v) => setForm({ ...form, is_hot: v })} /></div></Field>
          </div>
          <Field label="Active"><div className="pt-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div></Field>

          <div className="rounded-md border border-dashed p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Flash sale popup</Label>
              <Switch checked={form.is_flash_sale} onCheckedChange={(v) => setForm({ ...form, is_flash_sale: v })} />
            </div>
            {form.is_flash_sale && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Sale price (₦)"><Input type="number" value={form.flash_sale_price} onChange={(e) => setForm({ ...form, flash_sale_price: e.target.value })} /></Field>
                  <Field label="Discount %"><Input type="number" value={form.flash_sale_discount_pct} onChange={(e) => setForm({ ...form, flash_sale_discount_pct: e.target.value })} /></Field>
                </div>
                <Field label="Show popup on page">
                  <Select value={form.flash_sale_route} onValueChange={(v) => setForm({ ...form, flash_sale_route: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="/">Home</SelectItem>
                      <SelectItem value="/orders">Orders</SelectItem>
                      <SelectItem value="/wallet">Wallet</SelectItem>
                      <SelectItem value="/team">Team</SelectItem>
                      <SelectItem value="/chat">Chat</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending} className="flex-1">{save.isPending ? "Saving…" : form.id ? "Update" : "Create"}</Button>
            {form.id && <Button type="button" variant="outline" onClick={() => setForm(empty)}>Cancel</Button>}
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
