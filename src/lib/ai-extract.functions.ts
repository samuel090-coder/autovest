import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  imageDataUrl: z.string().startsWith("data:image/"),
});

export const extractInvestmentFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Admin check
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");

    const gateway = createLovableAiGatewayProvider(apiKey);

    const prompt = `You are extracting investment product details from a screenshot of an investment app card.
Return ONLY a strict JSON object with these exact keys (no markdown, no commentary):
{
  "name": string,                  // e.g. "Compact car", "Senior partner", "VIP car"
  "price": number,                 // in Naira, no symbols, no commas
  "cycle_days": number,            // investment cycle in days
  "daily_income": number,          // daily income in Naira
  "total_income": number,          // total income in Naira
  "category": "welfare" | "product",
  "description": string            // short marketing description (1-3 sentences)
}
If a field is missing, infer a reasonable value. Numbers must be plain integers/floats.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: data.imageDataUrl },
          ],
        },
      ],
    });

    // Extract JSON
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
