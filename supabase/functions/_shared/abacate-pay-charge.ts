import type { SupabaseClient } from "@supabase";
import type {
  AbacatePayCharge,
  CreateAbacatePayChargePayload,
} from "./edge-functions.types.ts";
import type { Tables } from "./database.types.ts";

type CustomerInfo = NonNullable<CreateAbacatePayChargePayload["customer"]>;

type Payment = Pick<
  Tables<"payments">,
  "id" | "user_id" | "amount" | "status" | "abacate_pay_charge_id"
>;

type PixQrCodeProviderError =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | unknown[];

type PixQrCodeResult =
  | {
    data: AbacatePayCharge;
    error?: null;
    success?: unknown;
  }
  | {
    data?: undefined;
    error: PixQrCodeProviderError;
    success?: unknown;
  };

type CreatePixQrCode = (params: {
  amount: number;
  description: string;
  expiresIn: number;
  customer?: CustomerInfo;
  externalId?: string;
}) => Promise<PixQrCodeResult>;

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

export type CreateChargeForPaymentArgs = {
  supabaseAdmin: SupabaseClient;
  paymentId: string;
  expectedUserId?: string;
  customer?: CustomerInfo;
  createPixQrCode?: CreatePixQrCode;
};

type FetchFn = typeof fetch;

type TransparentPixChargeResponse = {
  data?: {
    id?: unknown;
    brCode?: unknown;
    brCodeBase64?: unknown;
  };
  error?: unknown;
  success?: unknown;
};

function formatProviderError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function createTransparentPixCharge({
  apiKey,
  amount,
  description,
  expiresIn,
  customer,
  externalId,
  fetchFn = fetch,
}: {
  apiKey: string;
  amount: number;
  description: string;
  expiresIn: number;
  customer?: CustomerInfo;
  externalId?: string;
  fetchFn?: FetchFn;
}): Promise<PixQrCodeResult> {
  const response = await fetchFn(
    "https://api.abacatepay.com/v2/transparents/create",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "PIX",
        data: {
          amount,
          description,
          expiresIn,
          customer,
          externalId,
        },
      }),
    },
  );

  const result = await response.json() as TransparentPixChargeResponse;

  if (!response.ok || result.error != null) {
    return {
      error: result.error == null
        ? `Abacate Pay API returned HTTP ${response.status}`
        : formatProviderError(result.error),
    };
  }

  if (
    typeof result.data?.id !== "string" ||
    typeof result.data.brCode !== "string" ||
    typeof result.data.brCodeBase64 !== "string"
  ) {
    return { error: "Abacate Pay API response is missing Pix charge data." };
  }

  return {
    data: {
      id: result.data.id,
      brCode: result.data.brCode,
      brCodeBase64: result.data.brCodeBase64,
    },
    error: null,
    success: result.success,
  };
}

function getDefaultPixQrCodeCreator(): CreatePixQrCode {
  const apiKey = Deno.env.get("ABACATE_PAY_API_KEY");
  if (!apiKey) {
    throw new Error("Missing ABACATE_PAY_API_KEY environment variable.");
  }

  return (params) => createTransparentPixCharge({ apiKey, ...params });
}

export async function createChargeForPayment({
  supabaseAdmin,
  paymentId,
  expectedUserId,
  customer,
  createPixQrCode = getDefaultPixQrCodeCreator(),
}: CreateChargeForPaymentArgs): Promise<AbacatePayCharge> {
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, amount, status, abacate_pay_charge_id")
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

  if (expectedUserId && payment.user_id !== expectedUserId) {
    throw new PaymentOwnerMismatchError();
  }

  const pixCode = await createPixQrCode({
    amount: payment.amount,
    description: "Inscrição para se tornar associado da SL.A.C",
    expiresIn: 3600,
    externalId: payment.id,
    customer,
  });

  if (pixCode.error != null) {
    throw new Error(
      `Abacate Pay API error: ${formatProviderError(pixCode.error)}`,
    );
  }

  if (!pixCode.data) {
    throw new Error("Abacate Pay API response is missing Pix charge data.");
  }

  const { data: updatedPayments, error: updateError } = await supabaseAdmin
    .from("payments")
    .update({ abacate_pay_charge_id: pixCode.data.id })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id");

  if (updateError) {
    throw new Error(
      `Failed to update payment record: ${updateError.message}`,
    );
  }

  if ((updatedPayments ?? []).length !== 1) {
    throw new InvalidPaymentStateError(
      "Payment is no longer pending.",
    );
  }

  return pixCode.data;
}
