export type PaymentProvider = "abacate_pay" | "stripe";

export type PaymentMethod = "hosted_checkout" | "pix";

export type CreatePaymentCheckoutPayload = {
  paymentId: string;
  customer?: {
    name: string;
    email: string;
    cellphone: string;
    taxId: string;
  };
};

type PaymentCheckoutSessionBase = {
  method: PaymentMethod;
  paymentId: string;
  provider: PaymentProvider;
  providerPaymentId: string;
};

export type PixPaymentCheckoutSession = PaymentCheckoutSessionBase & {
  brCode: string;
  brCodeBase64: string;
  method: "pix";
};

export type HostedPaymentCheckoutSession = PaymentCheckoutSessionBase & {
  checkoutUrl: string;
  method: "hosted_checkout";
};

export type PaymentCheckoutSession =
  | PixPaymentCheckoutSession
  | HostedPaymentCheckoutSession;

export type CreateAbacatePayChargePayload = CreatePaymentCheckoutPayload;
export type AbacatePayCharge = PaymentCheckoutSession;
export type StartSubscriptionResponse = PaymentCheckoutSession;
