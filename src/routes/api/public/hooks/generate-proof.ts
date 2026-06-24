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
          // Random skip so 5-min cron averages to a 4-9 min cadence (~40% skip)
          if (Math.random() < 0.4) {
            return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { "Content-Type": "application/json" } });
          }

          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("missing key", { status: 500 });

          // 1) Build a realistic Nigerian masked phone locally (valid MNO prefixes, max variety)
          const ngPrefixes = [
            "0803","0806","0810","0813","0814","0816","0703","0706","0903","0906",
            "0805","0807","0815","0811","0705","0905","0915","0708","0802","0808",
            "0812","0701","0902","0907","0901","0904","0912","0913","0916","0809","0817","0909","0908",
          ];
          const pfx = ngPrefixes[Math.floor(Math.random() * ngPrefixes.length)];
          const d = () => String(Math.floor(Math.random() * 10));
          // 7 random suffix digits, e.g. 0803 + 1234567
          const suffix = Array.from({ length: 7 }, d).join("");
          // Rotate mask shapes so it doesn't always end with the same 3 digits
          const shapes = [
            (p: string, s: string) => `+234 ${p.slice(1)} ${s.slice(0,1)}****${s.slice(-3)}`,
            (p: string, s: string) => `+234 ${p.slice(1)} ****${s.slice(-4)}`,
            (p: string, s: string) => `+234 ${p.slice(1)}***${s.slice(-4)}`,
            (p: string, s: string) => `${p}****${s.slice(-3)}`,
            (p: string, s: string) => `${p} ${s.slice(0,2)}**${s.slice(-3)}`,
          ];
          const masked = shapes[Math.floor(Math.random() * shapes.length)](pfx, suffix);

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
                    "You generate a single fake but realistic withdrawal proof for a Nigerian investment app feed. Output strict JSON {\"amount\": number (between 1500 and 950000, varied — NOT always ending in 00; mix exact amounts like 7250, 18450, 92300, 156780), \"caption\": short string max 70 chars, mix English and casual Nigerian Pidgin with one emoji, NEVER repeat phrasing. Examples vary widely: 'Boss don land 💸', 'Withdrawal hit my GTB account fast 🙌', 'Thank you InvestPro for changing my life ❤️', 'Just collected my profit, e dey work 💯'. No phone numbers, no names}. No prose, no markdown.",
                },
                { role: "user", content: `Generate one fresh, unique proof. seed=${Date.now()}-${Math.random()}` },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (!captionRes.ok) return new Response("ai failed", { status: 500 });
          const cj = await captionRes.json();
          const parsed = JSON.parse(cj.choices?.[0]?.message?.content ?? "{}");
          const amount = Number(parsed.amount ?? 5000);
          const caption = String(parsed.caption ?? "Thanks InvestPro 🎉").slice(0, 80);


          // 3) Realistic mobile bank screenshot via Gemini image (uses chat-completions image shape)
          let imageUrl: string | null = null;
          try {
            const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image",
                messages: [{
                  role: "user",
                  content: `Photorealistic mobile banking app screenshot from a Nigerian bank (GTBank, Access, OPay, Kuda, PalmPay or Moniepoint style). Shows a successful withdrawal transaction of ₦${amount.toLocaleString()} NGN. Include: green success checkmark, transaction status "Successful", masked account number ending **${Math.floor(1000+Math.random()*9000)}, date stamp, reference code, clean modern white/dark UI. No real names. Vertical phone aspect ratio.`,
                }],
                modalities: ["image", "text"],
              }),
            });
            if (imgRes.ok) {
              const ij = await imgRes.json();
              // Gemini returns image as base64 in message images array (gateway normalized)
              const msg = ij.choices?.[0]?.message;
              const imgPart = msg?.images?.[0]?.image_url?.url || msg?.content?.find?.((c: any) => c.type === "image_url")?.image_url?.url;
              if (typeof imgPart === "string" && imgPart.startsWith("data:")) imageUrl = imgPart;
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
