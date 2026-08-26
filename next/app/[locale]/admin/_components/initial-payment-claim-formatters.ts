function intlLocale(locale: string) {
  return locale.toLowerCase().startsWith("pt") ? "pt-BR" : "en-US";
}

export function formatAmount(
  amount: number,
  currency: string,
  locale = "en-US",
) {
  return new Intl.NumberFormat(intlLocale(locale), {
    currency,
    style: "currency",
  }).format(amount / 100);
}

export function formatDate(
  value: string | null | undefined,
  locale = "en-US",
) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(intlLocale(locale), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(date);
}
