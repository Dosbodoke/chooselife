import {
  assertEquals,
  assertRejects,
} from "jsr:@std/assert";
import type { SupabaseClient } from "@supabase";
import {
  createChargeForPayment,
  InvalidPaymentStateError,
  PaymentNotFoundError,
  PaymentOwnerMismatchError,
} from "../_shared/abacate-pay-charge.ts";

type PaymentRow = {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  abacate_pay_charge_id: string | null;
};

function createFakeSupabase(
  payment: PaymentRow | null,
  options: { updateRows?: Array<{ id: string }> } = {},
) {
  const state = {
    selectedColumns: "",
    filters: [] as Array<{ column: string; value: unknown }>,
    updates: [] as Array<Record<string, unknown>>,
    updateFilters: [] as Array<{ column: string; value: unknown }>,
  };

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
              state.updateFilters.push({ column, value });
              return updateQuery;
            },
            async select(_columns: string) {
              return {
                data: options.updateRows ?? [{ id: payment?.id ?? "" }],
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
  assertEquals(charge.id, "charge-1");
  assertEquals(state.updates, [{ abacate_pay_charge_id: "charge-1" }]);
  assertEquals(state.updateFilters, [
    { column: "id", value: "payment-1" },
    { column: "status", value: "pending" },
  ]);
});

Deno.test("ignores a forged request-body amount", async () => {
  const forgedRequestBody = { paymentId: "payment-1", amount: 1 };
  const { client } = createFakeSupabase({
    id: "payment-1",
    user_id: "user-1",
    amount: 5000,
    status: "pending",
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

  assertEquals(state.updates, []);
});
