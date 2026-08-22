type BillingPayment = {
  amount: number;
  created_at: string;
  id: string;
  status: string;
};

export const findPendingRenewalPayment = <T extends BillingPayment>(
  payments: T[],
): T | undefined => {
  const latestSuccessfulPaymentTime = payments
    .filter((payment) => payment.status === 'succeeded')
    .reduce(
      (latest, payment) =>
        Math.max(latest, new Date(payment.created_at).getTime()),
      Number.NEGATIVE_INFINITY,
    );

  return payments
    .filter(
      (payment) =>
        payment.status === 'pending' &&
        new Date(payment.created_at).getTime() > latestSuccessfulPaymentTime,
    )
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    )[0];
};

export const formatBillingAmount = (amountInCents: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);

export const formatBillingDate = (date: string | null) => {
  if (!date) return null;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsedDate);
};
