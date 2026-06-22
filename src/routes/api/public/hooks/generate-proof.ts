import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint — called every 30 min via pg_cron.
 * Generates 1 AI withdrawal proof (caption + tiny generated image) and inserts it
 * into withdrawal_proofs so the feed always looks alive.
 */
export const Route = createFileRoute("/api/public/hooks/generate-proof")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("missing key", { status: 500 });

          // 1) AI caption + amount via chat completion
          const captionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content:
                    "You generate a single fake but realistic withdrawal proof for a Nigerian investment app feed. Output strict JSON {\"amount\": number (between 1000 and 800000, varied), \"caption\": short string max 60 chars in English with one emoji, \"phone_last3\": 3 digits, \"phone_mid4\": 4 digits}. No prose, no markdown.",
                },
                { role: "user", content: "Generate one." },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (!captionRes.ok) return new Response("ai failed", { status: 500 });
          const cj = await captionRes.json();
          const parsed = JSON.parse(cj.choices?.[0]?.message?.content ?? "{}");
          const amount = Number(parsed.amount ?? 5000);
          const caption = String(parsed.caption ?? "Thanks InvestPro 🎉").slice(0, 80);
          const mid = String(parsed.phone_mid4 ?? "1234").slice(0, 4);
          const last3 = String(parsed.phone_last3 ?? "567").slice(0, 3);
          const masked = `+234${mid}****${last3}`;

          // 2) Tiny screenshot-style image via Gemini image (cheaper than gpt-image-2)
          let imageUrl: string | null = null;
          try {
            const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image",
                prompt: `A tiny mobile bank app screenshot showing a successful Naira withdrawal of ${amount} to a Nigerian bank account. Clean white UI, green success checkmark, faint text. No real names.`,
                size: "512x768",
                n: 1,
              }),
            });
            if (imgRes.ok) {
              const ij = await imgRes.json();
              const b64 = ij.data?.[0]?.b64_json;
              if (b64) imageUrl = `data:image/png;base64,${b64}`;
            }
          } catch {}

          // 3) Insert into DB using service role
          const url = process.env.SUPABASE_URL!;
          const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          const ins = await fetch(`${url}/rest/v1/withdrawal_proofs`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: sr,
              Authorization: `Bearer ${sr}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              phone_masked: masked,
              amount,
              caption,
              image_url: imageUrl,
              is_ai: true,
            }),
          });
          if (!ins.ok) return new Response(`insert failed ${await ins.text()}`, { status: 500 });

          return new Response(JSON.stringify({ ok: true, amount, caption }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          return new Response(`err: ${e.message}`, { status: 500 });
        }
      },
    },
  },
});
