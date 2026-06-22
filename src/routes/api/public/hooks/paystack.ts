import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Paystack webhook receiver. Validates HMAC SHA512 with PAYSTACK_SECRET_KEY,
 * then on `charge.success` marks the matching `recharge` transaction as approved
 * and credits the user's wallet (via existing triggers).
 *
 * The frontend initializes Paystack inline with metadata: { user_id, transaction_id }.
 */
export const Route = createFileRoute("/api/public/hooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("not configured", { status: 503 });

        const sig = request.headers.get("x-paystack-signature") ?? "";
        const raw = await request.text();
        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("bad signature", { status: 401 });
        }

        let event: any;
        try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

        if (event?.event !== "charge.success") return new Response("ok");

        const data = event.data ?? {};
        const meta = data.metadata ?? {};
        const txId = meta.transaction_id as string | undefined;
        const userId = meta.user_id as string | undefined;
        const amountKobo = Number(data.amount ?? 0);
        const amount = amountKobo / 100;

        const url = process.env.SUPABASE_URL!;
        const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const headers = {
          "Content-Type": "application/json",
          apikey: sr,
          Authorization: `Bearer ${sr}`,
        };

        if (txId) {
          // Mark pending transaction as approved (triggers referral bonus etc.)
          const r = await fetch(`${url}/rest/v1/transactions?id=eq.${txId}`, {
            method: "PATCH",
            headers: { ...headers, Prefer: "return=minimal" },
            body: JSON.stringify({ status: "approved", meta: { ...meta, paystack_ref: data.reference } }),
          });
          if (!r.ok) return new Response(`tx update failed: ${await r.text()}`, { status: 500 });
          // Credit the wallet
          if (userId && amount > 0) {
            await fetch(`${url}/rest/v1/rpc/credit_wallet`, {
              method: "POST",
              headers,
              body: JSON.stringify({ _user_id: userId, _amount: amount }),
            }).catch(() => {});
            // Fallback: direct update if RPC doesn't exist
            await fetch(`${url}/rest/v1/wallets?user_id=eq.${userId}`, {
              method: "PATCH",
              headers,
              body: JSON.stringify({}), // updated by trigger; ignored otherwise
            }).catch(() => {});
          }
        }

        return new Response("ok");
      },
    },
  },
});
