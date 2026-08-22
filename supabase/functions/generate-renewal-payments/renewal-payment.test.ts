import { assertEquals, assertStringIncludes } from "@std/assert";
import type { Tables } from "../_shared/database.types.ts";
import {
  buildRenewalNotification,
  processSubscription,
  type RenewalNotification,
  type RenewalOrganization,
  type RenewalPaymentDependencies,
} from "./renewal-payment.ts";

const subscription: Tables<"subscriptions"> = {
  current_period_end: "2026-09-01T00:00:00.000Z",
  id: "subscription-1",
  organization_id: "organization-1",
  plan_type: "monthly",
  status: "active",
  user_id: "user-1",
};

const organization: RenewalOrganization = {
  annual_price_amount: 12000,
  monthly_price_amount: 1290,
  name: "Choose Life Club",
  slug: "choose-life",
};

const quietLogger = {
  error() {},
  log() {},
};

Deno.test("builds a localized, actionable renewal notification", () => {
  const notification = buildRenewalNotification({
    amount: 1290,
    organization,
    paymentId: "payment-1",
    subscription,
  });

  assertEquals(notification.user_id, "user-1");
  assertEquals(notification.title, {
    en: "Your next membership charge is ready",
    pt: "Sua próxima cobrança está disponível",
  });
  assertStringIncludes(notification.body.pt, "R$\u00a012,90");
  assertStringIncludes(notification.body.pt, "01/09/2026");
  assertStringIncludes(notification.body.en, "R$12.90");
  assertStringIncludes(notification.body.en, "09/01/2026");
  assertEquals(notification.data, {
    amount: "1290",
    organization_id: "organization-1",
    organization_slug: "choose-life",
    payment_context: "subscription_renewal",
    payment_id: "payment-1",
    subscription_id: "subscription-1",
    type: "subscription_renewal_payment_ready",
    url:
      "/payment?amount=1290&paymentContext=subscription_renewal&paymentId=payment-1&slug=choose-life",
  });
});

Deno.test("uses the annual organization price for annual renewals", async () => {
  const annualSubscription: Tables<"subscriptions"> = {
    ...subscription,
    plan_type: "annual",
  };
  let insertedAmount: number | null = null;
  const insertedNotifications: RenewalNotification[] = [];
  const dependencies: RenewalPaymentDependencies = {
    findPendingPayment() {
      return Promise.resolve(null);
    },
    hasRenewalNotification() {
      return Promise.resolve(false);
    },
    fetchOrganization() {
      return Promise.resolve(organization);
    },
    createPendingPayment(input) {
      insertedAmount = input.amount;
      return Promise.resolve({ id: "annual-payment" });
    },
    createNotification(notification) {
      insertedNotifications.push(notification);
      return Promise.resolve();
    },
  };

  const result = await processSubscription(
    annualSubscription,
    dependencies,
    quietLogger,
  );

  assertEquals(result, { paymentId: "annual-payment", status: "created" });
  assertEquals(insertedAmount, 12000);
  assertEquals(insertedNotifications.length, 1);
  const insertedNotification = insertedNotifications[0];
  assertEquals(insertedNotification.data.amount, "12000");
  assertStringIncludes(insertedNotification.body.pt, "R$\u00a0120,00");
});

Deno.test("does not create a payment or notification when one is already pending", async () => {
  const calls: string[] = [];
  const dependencies: RenewalPaymentDependencies = {
    findPendingPayment(subscriptionId) {
      calls.push(`pending:${subscriptionId}`);
      return Promise.resolve({ amount: 1290, id: "payment-1" });
    },
    hasRenewalNotification(paymentId) {
      calls.push(`notification-check:${paymentId}`);
      return Promise.resolve(true);
    },
    fetchOrganization() {
      calls.push("organization");
      return Promise.resolve(organization);
    },
    createPendingPayment() {
      calls.push("payment");
      return Promise.resolve({ id: "payment-1" });
    },
    createNotification() {
      calls.push("notification");
      return Promise.resolve();
    },
  };

  const result = await processSubscription(
    subscription,
    dependencies,
    quietLogger,
  );

  assertEquals(result, { status: "skipped_pending" });
  assertEquals(calls, [
    "pending:subscription-1",
    "notification-check:payment-1",
  ]);
});

Deno.test("retries only the notification when a pending payment was not notified", async () => {
  const calls: string[] = [];
  const dependencies: RenewalPaymentDependencies = {
    findPendingPayment() {
      calls.push("pending-check");
      return Promise.resolve({ amount: 1290, id: "payment-1" });
    },
    hasRenewalNotification() {
      calls.push("notification-check");
      return Promise.resolve(false);
    },
    fetchOrganization() {
      calls.push("organization");
      return Promise.resolve(organization);
    },
    createPendingPayment() {
      calls.push("payment");
      return Promise.resolve({ id: "unexpected-payment" });
    },
    createNotification(notification) {
      calls.push(`notification:${notification.data.payment_id}`);
      return Promise.resolve();
    },
  };

  const result = await processSubscription(
    subscription,
    dependencies,
    quietLogger,
  );

  assertEquals(result, {
    paymentId: "payment-1",
    status: "notified_existing",
  });
  assertEquals(calls, [
    "pending-check",
    "notification-check",
    "organization",
    "notification:payment-1",
  ]);
});

Deno.test("notifies the target user immediately after creating the renewal payment", async () => {
  const calls: string[] = [];
  const insertedNotifications: RenewalNotification[] = [];
  const dependencies: RenewalPaymentDependencies = {
    findPendingPayment() {
      calls.push("pending-check");
      return Promise.resolve(null);
    },
    hasRenewalNotification() {
      return Promise.resolve(false);
    },
    fetchOrganization() {
      calls.push("organization");
      return Promise.resolve(organization);
    },
    createPendingPayment(input) {
      calls.push("payment");
      assertEquals(input, {
        amount: 1290,
        organization_id: "organization-1",
        subscription_id: "subscription-1",
        user_id: "user-1",
      });
      return Promise.resolve({ id: "payment-1" });
    },
    createNotification(notification) {
      calls.push("notification");
      insertedNotifications.push(notification);
      return Promise.resolve();
    },
  };

  const result = await processSubscription(
    subscription,
    dependencies,
    quietLogger,
  );

  assertEquals(result, { paymentId: "payment-1", status: "created" });
  assertEquals(calls, [
    "pending-check",
    "organization",
    "payment",
    "notification",
  ]);
  assertEquals(insertedNotifications.length, 1);
  const insertedNotification = insertedNotifications[0];
  assertEquals(insertedNotification.data.payment_id, "payment-1");
  assertEquals(insertedNotification.data.subscription_id, "subscription-1");
  assertEquals(insertedNotification.data.organization_id, "organization-1");
});

Deno.test("does not create a payment or notification when the plan has no price", async () => {
  const calls: string[] = [];
  const dependencies: RenewalPaymentDependencies = {
    findPendingPayment() {
      calls.push("pending-check");
      return Promise.resolve(null);
    },
    hasRenewalNotification() {
      return Promise.resolve(false);
    },
    fetchOrganization() {
      calls.push("organization");
      return Promise.resolve({ ...organization, monthly_price_amount: null });
    },
    createPendingPayment() {
      calls.push("payment");
      return Promise.resolve({ id: "payment-1" });
    },
    createNotification() {
      calls.push("notification");
      return Promise.resolve();
    },
  };

  const result = await processSubscription(
    subscription,
    dependencies,
    quietLogger,
  );

  assertEquals(result, { status: "skipped_missing_price" });
  assertEquals(calls, ["pending-check", "organization"]);
});
