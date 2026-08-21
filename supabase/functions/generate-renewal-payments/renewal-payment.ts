import type { Tables } from "../_shared/database.types.ts";

type Subscription = Tables<"subscriptions">;

export interface RenewalOrganization {
  name: string;
  slug: string;
  monthly_price_amount: number | null;
  annual_price_amount: number | null;
}

export interface RenewalNotification {
  user_id: string;
  title: { en: string; pt: string };
  body: { en: string; pt: string };
  data: {
    amount: string;
    organization_id: string;
    organization_slug: string;
    payment_context: "subscription_renewal";
    payment_id: string;
    subscription_id: string;
    type: "subscription_renewal_payment_ready";
    url: string;
  };
}

export interface RenewalPaymentDependencies {
  findPendingPayment(
    subscriptionId: string,
  ): Promise<{ amount: number; id: string } | null>;
  hasRenewalNotification(paymentId: string): Promise<boolean>;
  fetchOrganization(organizationId: string): Promise<RenewalOrganization>;
  createPendingPayment(input: {
    amount: number;
    organization_id: string;
    subscription_id: string;
    user_id: string;
  }): Promise<{ id: string }>;
  createNotification(notification: RenewalNotification): Promise<void>;
}

interface RenewalLogger {
  error(...data: unknown[]): void;
  log(...data: unknown[]): void;
}

export type RenewalProcessingResult =
  | { status: "created"; paymentId: string }
  | { status: "failed"; error: unknown }
  | { status: "notified_existing"; paymentId: string }
  | { status: "skipped_pending" }
  | { status: "skipped_missing_price" };

function formatAmount(amount: number, locale: "en" | "pt"): string {
  return new Intl.NumberFormat(locale === "pt" ? "pt-BR" : "en-US", {
    currency: "BRL",
    style: "currency",
  }).format(amount / 100);
}

function formatDueDate(
  currentPeriodEnd: string | null,
  locale: "en" | "pt",
): string | null {
  if (!currentPeriodEnd) return null;

  const dueDate = new Date(currentPeriodEnd);
  if (Number.isNaN(dueDate.getTime())) return null;

  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(dueDate);
}

export function buildRenewalPaymentUrl({
  amount,
  organizationSlug,
  paymentId,
}: {
  amount: number;
  organizationSlug: string;
  paymentId: string;
}): string {
  const params = new URLSearchParams({
    amount: String(amount),
    paymentContext: "subscription_renewal",
    paymentId,
    slug: organizationSlug,
  });

  return `/payment?${params.toString()}`;
}

export function buildRenewalNotification({
  amount,
  organization,
  paymentId,
  subscription,
}: {
  amount: number;
  organization: RenewalOrganization;
  paymentId: string;
  subscription: Subscription;
}): RenewalNotification {
  const amountPt = formatAmount(amount, "pt");
  const amountEn = formatAmount(amount, "en");
  const dueDatePt = formatDueDate(subscription.current_period_end, "pt");
  const dueDateEn = formatDueDate(subscription.current_period_end, "en");

  const bodyPt = dueDatePt
    ? `A cobrança de ${amountPt} da sua assinatura ${organization.name} está disponível. Pague até ${dueDatePt}.`
    : `A cobrança de ${amountPt} da sua assinatura ${organization.name} está disponível para pagamento.`;
  const bodyEn = dueDateEn
    ? `Your ${amountEn} renewal for ${organization.name} is ready. Pay by ${dueDateEn}.`
    : `Your ${amountEn} renewal for ${organization.name} is ready to pay.`;

  return {
    user_id: subscription.user_id,
    title: {
      en: "Your next membership charge is ready",
      pt: "Sua próxima cobrança está disponível",
    },
    body: { en: bodyEn, pt: bodyPt },
    data: {
      amount: String(amount),
      organization_id: subscription.organization_id,
      organization_slug: organization.slug,
      payment_context: "subscription_renewal",
      payment_id: paymentId,
      subscription_id: subscription.id,
      type: "subscription_renewal_payment_ready",
      url: buildRenewalPaymentUrl({
        amount,
        organizationSlug: organization.slug,
        paymentId,
      }),
    },
  };
}

export async function processSubscription(
  subscription: Subscription,
  dependencies: RenewalPaymentDependencies,
  logger: RenewalLogger = console,
): Promise<RenewalProcessingResult> {
  try {
    const pendingPayment = await dependencies.findPendingPayment(
      subscription.id,
    );

    if (pendingPayment) {
      if (await dependencies.hasRenewalNotification(pendingPayment.id)) {
        logger.log(
          `Subscription ${subscription.id} already has a notified pending payment.`,
        );
        return { status: "skipped_pending" };
      }
    }

    const organization = await dependencies.fetchOrganization(
      subscription.organization_id,
    );

    if (pendingPayment) {
      await dependencies.createNotification(
        buildRenewalNotification({
          amount: pendingPayment.amount,
          organization,
          paymentId: pendingPayment.id,
          subscription,
        }),
      );
      logger.log(
        `Recovered missing notification for pending payment ${pendingPayment.id}.`,
      );
      return { status: "notified_existing", paymentId: pendingPayment.id };
    }
    const amount = subscription.plan_type === "annual"
      ? organization.annual_price_amount
      : organization.monthly_price_amount;

    if (amount == null) {
      logger.error(
        `Missing price for plan ${subscription.plan_type} on subscription ${subscription.id}`,
      );
      return { status: "skipped_missing_price" };
    }

    const payment = await dependencies.createPendingPayment({
      amount,
      organization_id: subscription.organization_id,
      subscription_id: subscription.id,
      user_id: subscription.user_id,
    });

    logger.log(
      `Created pending payment ${payment.id} for subscription ${subscription.id}.`,
    );

    await dependencies.createNotification(
      buildRenewalNotification({
        amount,
        organization,
        paymentId: payment.id,
        subscription,
      }),
    );

    logger.log(`Notification created for user ${subscription.user_id}.`);
    return { status: "created", paymentId: payment.id };
  } catch (error) {
    logger.error(`Error processing subscription ${subscription.id}:`, error);
    return { status: "failed", error };
  }
}
