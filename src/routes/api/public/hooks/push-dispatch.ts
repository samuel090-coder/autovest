import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload } from "@block65/webcrypto-web-push";

/**
 * Delivers pending notifications as Web Push messages.
 * Called by the database the instant a notification row is created,
 * plus an hourly catch-up for retries. Protected by a shared secret.
 */
export const Route = createFileRoute("/api/public/hooks/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PUSH_DISPATCH_SECRET;
        if (!secret || request.headers.get("x-dispatch-secret") !== secret) {
          return new Response("unauthorized", { status: 401 });
        }

        const vapid = {
          subject: process.env.VAPID_SUBJECT || "mailto:support@autovest.app",
          publicKey: process.env.VAPID_PUBLIC_KEY,
          privateKey: process.env.VAPID_PRIVATE_KEY,
        };
        if (!vapid.publicKey || !vapid.privateKey) {
          return new Response("missing vapid keys", { status: 500 });
        }

        let body: { id?: string } = {};
        try { body = (await request.json()) as { id?: string }; } catch { /* empty body is fine */ }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let q = supabaseAdmin
          .from("notifications")
          .select("id,user_id,title,body,url,image_url,icon_url,data,created_at,push_attempts")
          .in("push_state", ["pending", "retry"])
          .lt("push_attempts", 5)
          .order("created_at", { ascending: true })
          .limit(body.id ? 1 : 200);
        if (body.id) q = q.eq("id", body.id);

        const { data: rows, error } = await q;
        if (error) return new Response(error.message, { status: 500 });
        if (!rows?.length) return json({ ok: true, sent: 0 });

        const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id,user_id,endpoint,p256dh,auth,failure_count")
          .in("user_id", userIds)
          .is("disabled_at", null);

        const byUser = new Map<string, typeof subs>();
        (subs ?? []).forEach((s) => {
          const list = byUser.get(s.user_id) ?? [];
          list.push(s);
          byUser.set(s.user_id, list as typeof subs);
        });

        let delivered = 0;
        let failed = 0;

        for (const n of rows) {
          const targets = byUser.get(n.user_id) ?? [];
          if (!targets.length) {
            // No device registered — the in-app notification still exists.
            await supabaseAdmin
              .from("notifications")
              .update({ push_state: "no_device", push_attempts: (n.push_attempts ?? 0) + 1 })
              .eq("id", n.id);
            continue;
          }

          let anyOk = false;
          for (const t of targets) {
            try {
              const payload = await buildPushPayload(
                {
                  data: {
                    id: n.id,
                    title: n.title,
                    body: n.body,
                    url: n.url ?? "/",
                    image: n.image_url ?? null,
                    icon: n.icon_url ?? "/favicon.png",
                    tag: n.id,
                    timestamp: new Date(n.created_at).getTime(),
                    action_label:
                      (((n.data as Record<string, unknown> | null)?.["action_label"] as string | null) ?? null),
                  },
                  options: { ttl: 60 * 60 * 24, urgency: "high" },
                },
                { endpoint: t.endpoint, expirationTime: null, keys: { p256dh: t.p256dh, auth: t.auth } },
                vapid,
              );

              const res = await fetch(t.endpoint, {
                method: payload.method,
                headers: payload.headers,
                body: payload.body as unknown as BodyInit,
              });

              if (res.ok || res.status === 201 || res.status === 202) {
                anyOk = true;
                delivered++;
                if ((t.failure_count ?? 0) > 0) {
                  await supabaseAdmin
                    .from("push_subscriptions")
                    .update({ failure_count: 0, last_seen_at: new Date().toISOString() })
                    .eq("id", t.id);
                }
              } else if (res.status === 404 || res.status === 410) {
                // Subscription is gone for good.
                await supabaseAdmin.from("push_subscriptions").delete().eq("id", t.id);
              } else {
                failed++;
                const count = (t.failure_count ?? 0) + 1;
                await supabaseAdmin
                  .from("push_subscriptions")
                  .update({ failure_count: count, disabled_at: count >= 5 ? new Date().toISOString() : null })
                  .eq("id", t.id);
              }
            } catch {
              failed++;
            }
          }

          const attempts = (n.push_attempts ?? 0) + 1;
          await supabaseAdmin
            .from("notifications")
            .update({
              push_state: anyOk ? "sent" : attempts >= 5 ? "failed" : "retry",
              push_attempts: attempts,
              pushed_at: anyOk ? new Date().toISOString() : null,
            })
            .eq("id", n.id);
        }

        // Roll up broadcast delivery stats.
        const broadcastIds = Array.from(
          new Set(rows.map((r) => (r as { broadcast_id?: string | null }).broadcast_id).filter(Boolean)),
        ) as string[];
        for (const bid of broadcastIds) {
          const { count: ok } = await supabaseAdmin
            .from("notifications").select("*", { count: "exact", head: true })
            .eq("broadcast_id", bid).eq("push_state", "sent");
          const { count: bad } = await supabaseAdmin
            .from("notifications").select("*", { count: "exact", head: true })
            .eq("broadcast_id", bid).in("push_state", ["failed", "no_device"]);
          await supabaseAdmin
            .from("notification_broadcasts")
            .update({ delivered: ok ?? 0, failed: bad ?? 0 })
            .eq("id", bid);
        }

        return json({ ok: true, processed: rows.length, delivered, failed });
      },
    },
  },
});

function json(v: unknown) {
  return new Response(JSON.stringify(v), { headers: { "Content-Type": "application/json" } });
}
