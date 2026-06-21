import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import {
  processWebhook,
  type WebhookPayload,
} from "../_shared/payment-webhook.ts";

const ABACATE_PAY_WEBHOOK_SECRET = Deno.env.get("ABACATE_PAY_WEBHOOK_SECRET")!;
const ABACATEPAY_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

/**
 * Verifies if the webhook signature matches the expected HMAC.
 */
export function verifyAbacateSignature(
  rawBody: string,
  signatureFromHeader: string,
): boolean {
  const bodyBuffer = Buffer.from(rawBody, "utf8");

  const expectedSig = crypto
    .createHmac("sha256", ABACATEPAY_PUBLIC_KEY)
    .update(bodyBuffer)
    .digest("base64");

  const A = Buffer.from(expectedSig);
  const B = Buffer.from(signatureFromHeader);

  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

/**
 * Validates the webhook secret from query parameters.
 */
export function validateWebhookSecret(url: URL): boolean {
  const webhookSecret = url.searchParams.get("webhookSecret");
  return webhookSecret === ABACATE_PAY_WEBHOOK_SECRET;
}

/**
 * Main webhook handler.
 */
Deno.serve(async (req) => {
  try {
    // Validate webhook secret
    const url = new URL(req.url);
    if (!validateWebhookSecret(url)) {
      return new Response("Invalid webhook secret.", { status: 401 });
    }

    // Verify signature
    const signature = req.headers.get("X-Webhook-Signature");
    if (!signature) {
      return new Response("Missing signature header.", { status: 401 });
    }
    const rawBody = await req.text();
    if (!verifyAbacateSignature(rawBody, signature)) {
      return new Response("Signature verification failed.", { status: 401 });
    }

    // Parse and process webhook
    const payload: WebhookPayload = JSON.parse(rawBody);
    const result = await processWebhook(supabaseAdmin, payload);

    return new Response(
      JSON.stringify({ received: true, ...result }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
});
