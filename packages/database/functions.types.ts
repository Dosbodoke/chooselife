export type CreateAbacatePayChargePayload = {
  amount: number;
  paymentId: string;
};

export type AbacatePayCharge = {
  brCode: string;
  brCodeBase64: string;
  id: string;
};

export type StartSubscriptionResponse = AbacatePayCharge;
