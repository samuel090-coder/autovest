import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional(),
});

const SYSTEM_PROMPT = `You are "InvestPro Support" — a friendly, concise customer support assistant for the InvestPro investment platform.

About the site:
- Users register with phone + password, get a wallet with a Naira (₦) balance.
- They recharge via Paystack (card / bank transfer), then buy Investment or Welfare products.
- Each investment has a daily income, total income and a cycle (in days).
- Earnings grow every second in real time on the Orders page.
- When an investment matures, users can start a free "Round 2" or claim the total income into their wallet.
- Users withdraw earnings to a bound Nigerian bank account. Withdrawals need admin approval.
- Referral system: share your link, earn a commission when invited users invest.
- Lucky Draw: spin a wheel to win cash, extra spins unlocked by inviting friends.
- Certification page: users post real withdrawal screenshots to earn ₦70.

Rules:
- Answer in short, clear paragraphs. Use bullet points for steps.
- Never promise guaranteed profit — say "estimated based on the plan".
- If you don't know something specific, tell the user to contact live support.
- Never ask for passwords, OTP, PIN or card details.`;

export const askSupport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(data.history ?? []),
      { role: "user", content: data.message },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 402) throw new Error("Support AI is temporarily unavailable. Please try again shortly or use live chat.");
      if (res.status === 429) throw new Error("Support is busy — try again in a few seconds.");
      throw new Error(`Support AI error ${res.status}: ${t.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = json.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
    return { reply };
  });
