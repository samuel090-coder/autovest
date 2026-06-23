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

          // 1) Build a realistic Nigerian masked phone locally (valid MNO prefixes)
          const ngPrefixes = [
            "0803","0806","0810","0813","0814","0816","0703","0706","0903","0906",
            "0805","0807","0815","0811","0705","0905","0915","0708","0802","0808",
            "0812","0701","0902","0907","0901","0904","0912","0913","0916",
          ];
          const pfx = ngPrefixes[Math.floor(Math.random() * ngPrefixes.length)]; // 0XXX
          const mid = String(Math.floor(100 + Math.random() * 900));            // 3 digits
          const last = String(Math.floor(1000 + Math.random() * 9000));         // 4 digits
          // Display as +234 XXX XXX **** XXX  → mask middle, show last 3
          const intlPfx = "+234" + pfx.slice(1); // drop the leading 0
          const masked = `${intlPfx}${mid.slice(0,1)}****${last.slice(-3)}`;

          // 2) AI caption + amount via chat completion (amount/caption only)
          const captionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "You generate a single fake but realistic withdrawal proof for a Nigerian investment app feed. Output strict JSON {\"amount\": number (between 1500 and 750000, varied, end in 00 or 50), \"caption\": short string max 60 chars in English with one emoji, no phone numbers, no names}. No prose, no markdown.",
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
