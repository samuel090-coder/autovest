import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  imageDataUrl: z.string().startsWith("data:image/"),
});

export const extractInvestmentFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");

    const prompt = `You are extracting investment product details from a screenshot of an investment app card.
Return ONLY a strict JSON object with these exact keys (no markdown, no commentary):
{
  "name": string,
  "price": number,
  "cycle_days": number,
  "daily_income": number,
  "total_income": number,
  "category": "welfare" | "product",
  "description": string
}
If a field is missing, infer a reasonable value. Numbers must be plain integers/floats (no symbols, no commas).`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 402) {
        throw new Error("AI credits exhausted on the workspace. Please top up Lovable AI credits in Settings → Workspace → Usage, then retry. In the meantime you can fill the form manually.");
      }
      if (res.status === 429) {
        throw new Error("AI is rate-limited right now — wait ~30 seconds and try again.");
      }
      throw new Error(`AI gateway error ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI did not return JSON");
    const parsed = JSON.parse(match[0]);
    return parsed as {
      name: string;
      price: number;
      cycle_days: number;
      daily_income: number;
      total_income: number;
      category: "welfare" | "product";
      description: string;
    };
  });
