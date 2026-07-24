import { assertEquals, assertRejects } from "jsr:@std/assert";
import type { SupabaseClient } from "@supabase";
import {
  createChargeForPayment,
  createTransparentPixCharge,
  InvalidPaymentStateError,
  PaymentNotFoundError,
  PaymentOwnerMismatchError,
} from "../_shared/abacate-pay-charge.ts";

type PaymentRow = {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  payment_provider: string | null;
  provider_payment_id: string | null;
  abacate_pay_charge_id: string | null;
};

function createFakeSupabase(
  payment: PaymentRow | null,
  options: { updateRows?: Array<{ id: string }>[] } = {},
) {
  const state = {
    selectedColumns: "",
    filters: [] as Array<{ column: string; value: unknown }>,
    updates: [] as Array<Record<string, unknown>>,
    updateFilters: [] as Array<
      { operator: "eq" | "is"; column: string; value: unknown }
    >,
  };
  let updateIndex = 0;

  const client = {
    from(table: string) {
      assertEquals(table, "payments");

      const query = {
        select(columns: string) {
          state.selectedColumns = columns;
          return query;
        },
        eq(column: string, value: unknown) {
          state.filters.push({ column, value });
          return query;
        },
        async single() {
          if (!payment) {
            return {
              data: null,
              error: { code: "PGRST116", message: "Not found" },
            };
          }

          return { data: payment, error: null };
        },
        update(values: Record<string, unknown>) {
          state.updates.push(values);

          const updateQuery = {
            eq(column: string, value: unknown) {
              state.updateFilters.push({ operator: "eq", column, value });
              return updateQuery;
            },
            is(column: string, value: unknown) {
              state.updateFilters.push({ operator: "is", column, value });
              return updateQuery;
            },
            async select(_columns: string) {
              const data = options.updateRows?.[updateIndex] ??
                [{ id: payment?.id ?? "" }];
              updateIndex += 1;
              return {
                data,
                error: null,
              };
            },
          };

          return updateQuery;
        },
      };

      return query;
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

Deno.test("creates a Pix charge using the stored payment amount", async () => {
  const { client, state } = createFakeSupabase({
    id: "payment-1",
    user_id: "user-1",
    amount: 12900,
    status: "pending",
    payment_provider: null,
    provider_payment_id: null,
    abacate_pay_charge_id: null,
  });
  const providerAmounts: number[] = [];

  const charge = await createChargeForPayment({
    supabaseAdmin: client,
    paymentId: "payment-1",
    expectedUserId: "user-1",
    createPixQrCode: async (params) => {
      providerAmounts.push(params.amount);
      return {
        data: {
          id: "charge-1",
          brCode: "pix-code",
          brCodeBase64: "pix-code-base64",
        },
        error: null,
      };
    },
  });

  assertEquals(providerAmounts, [12900]);
  assertEquals(charge.providerPaymentId, "charge-1");
  assertEquals(charge.paymentId, "payment-1");
  assertEquals(state.updates, [
    {
      payment_provider: "abacate_pay",
      provider_payment_id: "pending-abacate-pay-charge:payment-1",
      abacate_pay_charge_id: "pending-abacate-pay-charge:payment-1",
    },
    {
      payment_provider: "abacate_pay",
      provider_payment_id: "charge-1",
      abacate_pay_charge_id: "charge-1",
    },
  ]);
  assertEquals(state.updateFilters, [
    { operator: "eq", column: "id", value: "payment-1" },
    { operator: "eq", column: "status", value: "pending" },
    { operator: "is", column: "provider_payment_id", value: null },
    { operator: "is", column: "abacate_pay_charge_id", value: null },
    { operator: "eq", column: "id", value: "payment-1" },
    { operator: "eq", column: "status", value: "pending" },
    {
      operator: "eq",
      column: "provider_payment_id",
      value: "pending-abacate-pay-charge:payment-1",
    },
    {
      operator: "eq",
      column: "abacate_pay_charge_id",
      value: "pending-abacate-pay-charge:payment-1",
    },
  ]);
});

Deno.test("ignores a forged request-body amount", async () => {
  const forgedRequestBody = { paymentId: "payment-1", amount: 1 };
  const { client } = createFakeSupabase({
    id: "payment-1",
    user_id: "user-1",
    amount: 5000,
    status: "pending",
    payment_provider: null,
    provider_payment_id: null,
    abacate_pay_charge_id: null,
  });
  const providerAmounts: number[] = [];

  await createChargeForPayment({
    supabaseAdmin: client,
    paymentId: forgedRequestBody.paymentId,
    expectedUserId: "user-1",
    createPixQrCode: async (params) => {
      providerAmounts.push(params.amount);
      return {
        data: {
          id: "charge-1",
          brCode: "pix-code",
          brCodeBase64: "pix-code-base64",
        },
        error: null,
      };
    },
  });

  assertEquals(forgedRequestBody.amount, 1);
  assertEquals(providerAmounts, [5000]);
});

Deno.test("accepts successful provider responses without an explicit error key", async () => {
  const { client } = createFakeSupabase({
    id: "payment-1",
    user_id: "user-1",
    amount: 5000,
    status: "pending",
    payment_provider: null,
    provider_payment_id: null,
    abacate_pay_charge_id: null,
  });

  const charge = await createChargeForPayment({
    supabaseAdmin: client,
    paymentId: "payment-1",
    expectedUserId: "user-1",
    createPixQrCode: async () => ({
      data: {
        id: "charge-1",
        brCode: "pix-code",
        brCodeBase64: "pix-code-base64",
      },
      success: true,
    }),
  });

  assertEquals(charge.providerPaymentId, "charge-1");
});

Deno.test("creates transparent Pix charges with the documented v2 payload", async () => {
  const requests: Array<{ input: string | URL | Request; init?: RequestInit }> =
    [];

  const charge = await createTransparentPixCharge({
    apiKey: "test-api-key",
    amount: 5000,
    description: "Membership",
    expiresIn: 3600,
    externalId: "payment-1",
    fetchFn: async (input, init) => {
      requests.push({ input, init });

      return new Response(
        JSON.stringify({
          data: {
            id: "charge-1",
            brCode: "pix-code",
            brCodeBase64: "pix-code-base64",
          },
          success: true,
        }),
        { status: 200 },
      );
    },
  });

  assertEquals(charge.data?.id, "charge-1");
  assertEquals(
    String(requests[0].input),
    "https://api.abacatepay.com/v2/transparents/create",
  );
  assertEquals(requests[0].init?.method, "POST");
  assertEquals(
    JSON.parse(String(requests[0].init?.body)),
    {
      method: "PIX",
      data: {
        amount: 5000,
        description: "Membership",
        expiresIn: 3600,
        externalId: "payment-1",
      },
    },
  );
});

Deno.test("rejects missing payment rows", async () => {
  const { client } = createFakeSupabase(null);

  await assertRejects(
    () =>
      createChargeForPayment({
        supabaseAdmin: client,
        paymentId: "missing-payment",
        createPixQrCode: async () => {
          throw new Error("Provider should not be called.");
        },
      }),
    PaymentNotFoundError,
  );
});

Deno.test("rejects non-pending payments", async () => {
  const { client } = createFakeSupabase({
    id: "payment-1",
    user_id: "user-1",
    amount: 5000,
    status: "succeeded",
    payment_provider: "abacate_pay",
    provider_payment_id: "charge-1",
    abacate_pay_charge_id: "charge-1",
  });

  await assertRejects(
    () =>
      createChargeForPayment({
        supabaseAdmin: client,
        paymentId: "payment-1",
        expectedUserId: "user-1",
        createPixQrCode: async () => {
          throw new Error("Provider should not be called.");
        },
      }),
    InvalidPaymentStateError,
  );
});

Deno.test("rejects owner mismatch for renewal calls", async () => {
  const { client } = createFakeSupabase({
    id: "payment-1",
    user_id: "user-1",
    amount: 5000,
    status: "pending",
    payment_provider: null,
    provider_payment_id: null,
    abacate_pay_charge_id: null,
  });

  await assertRejects(
    () =>
      createChargeForPayment({
        supabaseAdmin: client,
        paymentId: "payment-1",
        expectedUserId: "other-user",
        createPixQrCode: async () => {
          throw new Error("Provider should not be called.");
        },
      }),
    PaymentOwnerMismatchError,
  );
});

Deno.test("updates the payment only after a successful provider response", async () => {
  const { client, state } = createFakeSupabase({
    id: "payment-1",
    user_id: "user-1",
    amount: 5000,
    status: "pending",
    payment_provider: null,
    provider_payment_id: null,
    abacate_pay_charge_id: null,
  });

  await assertRejects(
    () =>
      createChargeForPayment({
        supabaseAdmin: client,
        paymentId: "payment-1",
        expectedUserId: "user-1",
        createPixQrCode: async () => ({
          error: { message: "provider error" },
        }),
      }),
    Error,
  );

  assertEquals(state.updates, [
    {
      payment_provider: "abacate_pay",
      provider_payment_id: "pending-abacate-pay-charge:payment-1",
      abacate_pay_charge_id: "pending-abacate-pay-charge:payment-1",
    },
    {
      payment_provider: null,
      provider_payment_id: null,
      abacate_pay_charge_id: null,
    },
  ]);
  assertEquals(state.updateFilters.slice(-4), [
    { operator: "eq", column: "id", value: "payment-1" },
    { operator: "eq", column: "status", value: "pending" },
    {
      operator: "eq",
      column: "provider_payment_id",
      value: "pending-abacate-pay-charge:payment-1",
    },
    {
      operator: "eq",
      column: "abacate_pay_charge_id",
      value: "pending-abacate-pay-charge:payment-1",
    },
  ]);
});

Deno.test("does not call the provider when another request already reserved the payment", async () => {
  const { client, state } = createFakeSupabase({
    id: "payment-1",
    user_id: "user-1",
    amount: 5000,
    status: "pending",
    payment_provider: null,
    provider_payment_id: null,
    abacate_pay_charge_id: null,
  }, { updateRows: [[]] });
  let providerCalls = 0;

  await assertRejects(
    () =>
      createChargeForPayment({
        supabaseAdmin: client,
        paymentId: "payment-1",
        expectedUserId: "user-1",
        createPixQrCode: async () => {
          providerCalls += 1;
          return {
            data: {
              id: "charge-should-not-exist",
              brCode: "pix-code",
              brCodeBase64: "pix-code-base64",
            },
            error: null,
          };
        },
      }),
    InvalidPaymentStateError,
    "Payment already has a provider charge.",
  );

  assertEquals(providerCalls, 0);
  assertEquals(state.updates, [{
    payment_provider: "abacate_pay",
    provider_payment_id: "pending-abacate-pay-charge:payment-1",
    abacate_pay_charge_id: "pending-abacate-pay-charge:payment-1",
  }]);
});

Deno.test("does not return a provider charge when finalizing the reservation loses the race", async () => {
  const { client, state } = createFakeSupabase({
    id: "payment-1",
    user_id: "user-1",
    amount: 5000,
    status: "pending",
    payment_provider: null,
    provider_payment_id: null,
    abacate_pay_charge_id: null,
  }, { updateRows: [[{ id: "payment-1" }], []] });

  await assertRejects(
    () =>
      createChargeForPayment({
        supabaseAdmin: client,
        paymentId: "payment-1",
        expectedUserId: "user-1",
        createPixQrCode: async () => ({
          data: {
            id: "charge-2",
            brCode: "pix-code",
            brCodeBase64: "pix-code-base64",
          },
          error: null,
        }),
      }),
    InvalidPaymentStateError,
    "Payment provider charge reservation was lost.",
  );

  assertEquals(state.updates.at(-1), {
    payment_provider: "abacate_pay",
    provider_payment_id: "charge-2",
    abacate_pay_charge_id: "charge-2",
  });
  assertEquals(state.updateFilters.slice(-4), [
    { operator: "eq", column: "id", value: "payment-1" },
    { operator: "eq", column: "status", value: "pending" },
    {
      operator: "eq",
      column: "provider_payment_id",
      value: "pending-abacate-pay-charge:payment-1",
    },
    {
      operator: "eq",
      column: "abacate_pay_charge_id",
      value: "pending-abacate-pay-charge:payment-1",
    },
  ]);
});

Deno.test("rejects payments that already have a provider charge", async () => {
  const { client } = createFakeSupabase({
    id: "payment-1",
    user_id: "user-1",
    amount: 5000,
    status: "pending",
    payment_provider: "abacate_pay",
    provider_payment_id: "charge-1",
    abacate_pay_charge_id: "charge-1",
  });

  await assertRejects(
    () =>
      createChargeForPayment({
        supabaseAdmin: client,
        paymentId: "payment-1",
        expectedUserId: "user-1",
        createPixQrCode: async () => {
          throw new Error("Provider should not be called.");
        },
      }),
    InvalidPaymentStateError,
  );
});
