import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ActivityInput = {
  event?: string;
  path?: string;
  label?: string;
  meta?: Record<string, unknown>;
  geo?: boolean;
  device_id?: string;
  device_model?: string;
  browser?: string;
  os?: string;
  is_pwa?: boolean;
};

function clientIp(req: Request): string | null {
  const h = req.headers;
  const fwd = h.get("cf-connecting-ip") || h.get("x-real-ip") || h.get("x-forwarded-for");
  if (!fwd) return null;
  return fwd.split(",")[0]!.trim();
}

async function lookupGeo(ip: string) {
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
    if (!res.ok) return {};
    const j = (await res.json()) as { success?: boolean; country?: string; region?: string; city?: string };
    if (!j.success) return {};
    return { country: j.country ?? null, region: j.region ?? null, city: j.city ?? null };
  } catch {
    return {};
  }
}

export const logActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ActivityInput) => input ?? {})
  .handler(async ({ data, context }) => {
    const req = getRequest();
    const ip = clientIp(req);
    const ua = req.headers.get("user-agent");
    let geo: { country?: string | null; region?: string | null; city?: string | null } = {};
    if (data.geo && ip) geo = await lookupGeo(ip);

    const { error } = await context.supabase.from("user_activity").insert({
      user_id: context.userId,
      event: data.event ?? "page_view",
      path: data.path ?? null,
      label: data.label ?? null,
      meta: (data.meta ?? {}) as never,
      ip,
      user_agent: ua,
      country: geo.country ?? null,
      region: geo.region ?? null,
      city: geo.city ?? null,
      device_id: data.device_id ?? null,
      device_model: data.device_model ?? null,
      browser: data.browser ?? null,
      os: data.os ?? null,
      is_pwa: data.is_pwa ?? false,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
