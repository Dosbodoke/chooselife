import type { SupabaseClient } from "@supabase";
import type { PaymentCheckoutSession } from "./edge-functions.types.ts";
import type { Tables } from "./database.types.ts";

export const STRIPE_PROVIDER = "stripe" as const;

const PROVIDER_CHECKOUT_RESERVATION_PREFIX = "pending-stripe-checkout:";
const STRIPE_CHECKOUT_SESSION_URL =
  "https://api.stripe.com/v1/checkout/sessions";

type Payment = Pick<
  Tables<"payments">,
  | "id"
  | "user_id"
  | "amount"
  | "status"
  | "payment_provider"
  | "provider_payment_id"
  | "abacate_pay_charge_id"
>;

type StripeCheckoutSessionResult =
  | {
    data: {
      id: string;
      url: string;
    };
    error?: null;
  }
  | {
    data?: undefined;
    error: string;
  };

type CreateStripeCheckoutSession = (params: {
  amount: number;
  cancelUrl: string;
  customerEmail?: string;
  description: string;
  paymentId: string;
  successUrl: string;
}) => Promise<StripeCheckoutSessionResult>;

type FetchFn = typeof fetch;

export class PaymentNotFoundError extends Error {
  constructor(paymentId: string) {
    super(`Payment not found: ${paymentId}`);
    this.name = "PaymentNotFoundError";
  }
}

export class InvalidPaymentStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPaymentStateError";
  }
}

export class PaymentOwnerMismatchError extends Error {
  constructor() {
    super("Payment does not belong to the authenticated user.");
    this.name = "PaymentOwnerMismatchError";
  }
}

export type CreateCheckoutForPaymentArgs = {
  supabaseAdmin: SupabaseClient;
  paymentId: string;
  expectedUserId?: string;
  customerEmail?: string;
  createStripeCheckoutSession?: CreateStripeCheckoutSession;
};

type StripeCheckoutResponse = {
  id?: unknown;
  object?: unknown;
  url?: unknown;
  error?: {
    message?: unknown;
  };
};

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
}

function getPaymentReturnUrl(paymentId: string, status: "success" | "cancel") {
  const appScheme = Deno.env.get("APP_PAYMENT_RETURN_SCHEME") ??
    "com.bodok.chooselife";
  return `${appScheme}://payment?paymentId=${paymentId}&stripeStatus=${status}`;
}

function appendFormValue(
  body: URLSearchParams,
  key: string,
  value: string | number | undefined,
) {
  if (value !== undefined) {
    body.append(key, String(value));
  }
}

function getStripeErrorMessage(result: StripeCheckoutResponse): string {
  const message = result.error?.message;
  if (typeof message === "string") return message;
  return "Stripe API returned an error.";
}

export async function createStripeHostedCheckoutSession({
  secretKey,
  amount,
  cancelUrl,
  customerEmail,
  description,
  paymentId,
  successUrl,
  fetchFn = fetch,
}: {
  secretKey: string;
  amount: number;
  cancelUrl: string;
  customerEmail?: string;
  description: string;
  paymentId: string;
  successUrl: string;
  fetchFn?: FetchFn;
}): Promise<StripeCheckoutSessionResult> {
  const body = new URLSearchParams();
  appendFormValue(body, "mode", "payment");
  appendFormValue(body, "success_url", successUrl);
  appendFormValue(body, "cancel_url", cancelUrl);
  appendFormValue(body, "client_reference_id", paymentId);
  appendFormValue(body, "customer_email", customerEmail);
  appendFormValue(body, "line_items[0][quantity]", 1);
  appendFormValue(body, "line_items[0][price_data][currency]", "brl");
  appendFormValue(body, "line_items[0][price_data][unit_amount]", amount);
  appendFormValue(body, "line_items[0][price_data][product_data][name]", description);
  appendFormValue(body, "metadata[payment_id]", paymentId);
  appendFormValue(body, "payment_intent_data[metadata][payment_id]", paymentId);

  const response = await fetchFn(STRIPE_CHECKOUT_SESSION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const result = await response.json() as StripeCheckoutResponse;

  if (!response.ok || result.error != null) {
    return { error: getStripeErrorMessage(result) };
  }

  if (typeof result.id !== "string" || typeof result.url !== "string") {
    return { error: "Stripe API response is missing Checkout Session data." };
  }

  return {
    data: {
      id: result.id,
      url: result.url,
    },
    error: null,
  };
}

function getDefaultStripeCheckoutSessionCreator(): CreateStripeCheckoutSession {
  const secretKey = getRequiredEnv("STRIPE_SECRET_KEY");

  return (params) =>
    createStripeHostedCheckoutSession({
      secretKey,
      ...params,
    });
}

function getProviderCheckoutReservationId(paymentId: string): string {
  return `${PROVIDER_CHECKOUT_RESERVATION_PREFIX}${paymentId}`;
}

export async function createCheckoutForPayment({
  supabaseAdmin,
  paymentId,
  expectedUserId,
  customerEmail,
  createStripeCheckoutSession = getDefaultStripeCheckoutSessionCreator(),
}: CreateCheckoutForPaymentArgs): Promise<PaymentCheckoutSession> {
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select(
      "id, user_id, amount, status, payment_provider, provider_payment_id, abacate_pay_charge_id",
    )
    .eq("id", paymentId)
    .single<Payment>();

  if (paymentError) {
    if (paymentError.code === "PGRST116") {
      throw new PaymentNotFoundError(paymentId);
    }
    throw paymentError;
  }

  if (!payment) {
    throw new PaymentNotFoundError(paymentId);
  }

  if (payment.amount <= 0) {
    throw new InvalidPaymentStateError(
      "Payment amount must be greater than 0.",
    );
  }

  if (payment.status !== "pending") {
    throw new InvalidPaymentStateError("Payment is not pending.");
  }

  if (payment.provider_payment_id || payment.abacate_pay_charge_id) {
    throw new InvalidPaymentStateError(
      "Payment already has a provider checkout session.",
    );
  }

  if (expectedUserId && payment.user_id !== expectedUserId) {
    throw new PaymentOwnerMismatchError();
  }

  const providerCheckoutReservationId = getProviderCheckoutReservationId(
    payment.id,
  );

  const { data: reservedPayments, error: reservationError } =
    await supabaseAdmin
      .from("payments")
      .update({
        payment_provider: STRIPE_PROVIDER,
        provider_payment_id: providerCheckoutReservationId,
      })
      .eq("id", payment.id)
      .eq("status", "pending")
      .is("provider_payment_id", null)
      .select("id");

  if (reservationError) {
    throw new Error(
      `Failed to reserve payment for provider checkout: ${reservationError.message}`,
    );
  }

  if ((reservedPayments ?? []).length !== 1) {
    throw new InvalidPaymentStateError(
      "Payment already has a provider checkout session.",
    );
  }

  let checkoutSession: StripeCheckoutSessionResult;
  try {
    checkoutSession = await createStripeCheckoutSession({
      amount: payment.amount,
      cancelUrl: getPaymentReturnUrl(payment.id, "cancel"),
      customerEmail,
      description: "Associação SL.A.C",
      paymentId: payment.id,
      successUrl: getPaymentReturnUrl(payment.id, "success"),
    });

    if (checkoutSession.error != null) {
      throw new Error(`Stripe API error: ${checkoutSession.error}`);
    }

    if (!checkoutSession.data) {
      throw new Error("Stripe API response is missing Checkout Session data.");
    }
  } catch (error) {
    await supabaseAdmin
      .from("payments")
      .update({
        payment_provider: null,
        provider_payment_id: null,
      })
      .eq("id", payment.id)
      .eq("status", "pending")
      .eq("provider_payment_id", providerCheckoutReservationId);
    throw error;
  }

  const { data: updatedPayments, error: updateError } = await supabaseAdmin
    .from("payments")
    .update({
      payment_provider: STRIPE_PROVIDER,
      provider_payment_id: checkoutSession.data.id,
    })
    .eq("id", payment.id)
    .eq("status", "pending")
    .eq("provider_payment_id", providerCheckoutReservationId)
    .select("id");

  if (updateError) {
    throw new Error(
      `Failed to update payment record: ${updateError.message}`,
    );
  }

  if ((updatedPayments ?? []).length !== 1) {
    throw new InvalidPaymentStateError(
      "Payment provider checkout reservation was lost.",
    );
  }

  return {
    checkoutUrl: checkoutSession.data.url,
    method: "hosted_checkout",
    paymentId: payment.id,
    provider: STRIPE_PROVIDER,
    providerPaymentId: checkoutSession.data.id,
  };
}
