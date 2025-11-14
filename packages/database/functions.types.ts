export type CreateAbacatePayChargePayload = {
  amount: number;
  paymentId: string;
  customer: {
    name: string;
    email: string;
    cellphone: string;
    taxId: string;
  } | undefined;
};

export type AbacatePayCharge = {
  brCode: string;
  brCodeBase64: string;
  id: string;
};

export type StartSubscriptionResponse = AbacatePayCharge;
