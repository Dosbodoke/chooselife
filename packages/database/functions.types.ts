export type CreateAbacatePayChargePayload = {
  paymentId: string;
  customer?: {
    name: string;
    email: string;
    cellphone: string;
    taxId: string;
  };
};

export type AbacatePayCharge = {
  brCode: string;
  brCodeBase64: string;
  id: string;
};

export type StartSubscriptionResponse = AbacatePayCharge;
