export type PaymentProvider = "abacate_pay";

export type PaymentMethod = "pix";

export type CreatePaymentCheckoutPayload = {
  paymentId: string;
  customer?: {
    name: string;
    email: string;
    cellphone: string;
    taxId: string;
  };
};

export type PaymentCheckoutSession = {
  brCode: string;
  brCodeBase64: string;
  method: PaymentMethod;
  paymentId: string;
  provider: PaymentProvider;
  providerPaymentId: string;
};

export type CreateAbacatePayChargePayload = CreatePaymentCheckoutPayload;
export type AbacatePayCharge = PaymentCheckoutSession;
export type StartSubscriptionResponse = PaymentCheckoutSession;
