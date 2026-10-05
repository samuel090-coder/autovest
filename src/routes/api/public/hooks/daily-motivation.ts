import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily AI-written motivation push for every user, plus an alert about a REAL
 * recent approved withdrawal (masked). Called once a day by the database scheduler.
 */
export const Route = createFileRoute("/api/public/hooks/daily-motivation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PUSH_DISPATCH_SECRET;
        if (!secret || request.headers.get("x-dispatch-secret") !== secret) {
          return new Response("unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const day = new Date().toISOString().slice(0, 10);

        // 1) AI messages (one batched call)
        let messages: Array<{ title: string; body: string }> = [];
        const apiKey = process.env.LOVABLE_API_KEY;
        if (apiKey) {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "openai/gpt-6-astra",
              input:
                "Write 6 short, energetic push notifications for AutoVest, a Nigerian investment app, encouraging users to open the app, check their running investments and invest today. Friendly Nigerian tone, an emoji or two. Never promise guaranteed returns or specific profits. Title max 40 chars, body max 110 chars. Reply ONLY with a JSON array of {\"title\",\"body\"}.",
            }),
          });
          if (res.ok) {
            const j: any = await res.json();
            const text: string = j.output_text ?? (j.output ?? []).flatMap((o: any) => o.content ?? []).map((c: any) => c.text ?? "").join("");
            try {
              const m = text.match(/\[[\s\S]*\]/);
              if (m) messages = (JSON.parse(m[0]) as any[]).filter((x) => x?.title && x?.body).slice(0, 6);
            } catch { /* fall back below */ }
          } else {
            console.error("AI gateway", res.status, await res.text());
          }
        }
        if (!messages.length) {
          messages = [{ title: "Your money is waiting 💰", body: "Open AutoVest to check your investments and pick today's best plan." }];
        }

        const { data: users } = await supabaseAdmin.from("profiles").select("id").is("restricted_at", null);
        let sent = 0;
        for (const u of users ?? []) {
          const m = messages[Math.floor(Math.random() * messages.length)];
          const { error } = await supabaseAdmin.rpc("notify_user", {
            _user_id: u.id, _category: "promo", _title: String(m.title).slice(0, 60), _body: String(m.body).slice(0, 160),
            _url: "/", _image_url: null as any, _dedupe_key: `daily-motivation-${day}`, _data: {} as any,
          });
          if (!error) sent++;
        }

        // 2) Real withdrawal alert (only if one was actually approved in the last 24h)
        let withdrawalAlert = false;
        const since = new Date(Date.now() - 86_400_000).toISOString();
        const { data: tx } = await supabaseAdmin.from("transactions").select("id,user_id,amount")
          .eq("type", "withdraw").eq("status", "approved").gte("created_at", since)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (tx) {
          const { data: p } = await supabaseAdmin.from("profiles").select("full_name,phone").eq("id", tx.user_id).maybeSingle();
          const { data: masked } = await supabaseAdmin.rpc("mask_identity", { _name: p?.full_name ?? "", _phone: p?.phone ?? "" });
          const amt = Number(tx.amount).toLocaleString("en-NG");
          for (const u of users ?? []) {
            if (u.id === tx.user_id) continue;
            await supabaseAdmin.rpc("notify_user", {
              _user_id: u.id, _category: "promo", _title: "Someone just withdrew 💸",
              _body: `${masked || "A user"} just withdrew ₦${amt}. Your turn — invest today!`,
              _url: "/", _image_url: null as any, _dedupe_key: `wd-alert-${tx.id}`, _data: {} as any,
            });
          }
          withdrawalAlert = true;
        }

        return new Response(JSON.stringify({ ok: true, sent, withdrawalAlert }), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
