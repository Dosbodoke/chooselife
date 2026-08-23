const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const CURRENCY_FORMATTERS = new Map([
  [
    "BRL",
    new Intl.NumberFormat("pt-BR", {
      currency: "BRL",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency",
    }),
  ],
]);

export function formatAmount(amount: number, currency: string) {
  return (
    CURRENCY_FORMATTERS.get(currency) ?? CURRENCY_FORMATTERS.get("BRL")!
  ).format(amount / 100);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : DATE_FORMATTER.format(date);
}
