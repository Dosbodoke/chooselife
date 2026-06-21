import AbacatePay from "abacatepay-nodejs-sdk";
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
    error: null;
  }
  | {
    data?: undefined;
    error: PixQrCodeProviderError;
  };

type CreatePixQrCode = (params: {
  amount: number;
  description: string;
  expiresIn: number;
  customer?: CustomerInfo;
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

function getDefaultPixQrCodeCreator(): CreatePixQrCode {
  const apiKey = Deno.env.get("ABACATE_PAY_API_KEY");
  if (!apiKey) {
    throw new Error("Missing ABACATE_PAY_API_KEY environment variable.");
  }

  const abacatePay = AbacatePay.default(apiKey);
  return (params) => abacatePay.pixQrCode.create(params);
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
    throw new InvalidPaymentStateError("Payment amount must be greater than 0.");
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
    customer,
  });

  if (pixCode.error !== null) {
    throw new Error(
      `Abacate Pay SDK error: ${JSON.stringify(pixCode.error)}`,
    );
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
