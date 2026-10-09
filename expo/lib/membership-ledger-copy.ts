import type {
  LedgerObligation,
  MembershipBillingLedger,
} from './membership-ledger';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const dateParts = {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
} as const;

const ledgerAmountFormatters = new Map<string, Intl.NumberFormat>();

const getLedgerAmountFormatter = (currency: string) => {
  const cached = ledgerAmountFormatters.get(currency);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  });
  ledgerAmountFormatters.set(currency, formatter);
  return formatter;
};

export const formatLedgerAmount = (amount: number, currency: string) =>
  getLedgerAmountFormatter(currency).format(amount / 100);

/**
 * Due dates arrive as plain dates and payment notices as ISO timestamps. Plain
 * dates are read in UTC so they never drift a day, while timestamps follow the
 * device clock so a notice sent at night keeps the day the person saw.
 */
export const formatLedgerDate = (value: string, timeZone?: string) => {
  const isDateOnly = DATE_ONLY.test(value);
  const parsed = new Date(isDateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    ...dateParts,
    ...(isDateOnly ? { timeZone: 'UTC' } : timeZone ? { timeZone } : {}),
  }).format(parsed);
};

/** "10 de out." — the year only when it isn't the current one. */
export const formatLedgerShortDate = (value: string, today = new Date()) => {
  const isDateOnly = DATE_ONLY.test(value);
  const parsed = new Date(isDateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    ...(parsed.getUTCFullYear() === today.getUTCFullYear()
      ? {}
      : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(parsed);
};

const monthYearFormatter = () =>
  new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

const getPeriodAnchor = (obligation: LedgerObligation) => {
  const anchor = obligation.period_start || obligation.due_on;
  if (!anchor || !DATE_ONLY.test(anchor)) return null;

  const parsed = new Date(`${anchor}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * `period_key` is a machine key such as `monthly:2026-09-10`. Only its cadence
 * is shown to people; the readable period comes from the period dates.
 */
export const getObligationPeriodLabel = (obligation: LedgerObligation) => {
  const anchor = getPeriodAnchor(obligation);
  if (!anchor) return null;

  const isAnnual = obligation.period_key?.startsWith('annual');
  if (isAnnual) return `anual de ${anchor.getUTCFullYear()}`;

  return `de ${monthYearFormatter().format(anchor)}`;
};

/** The period on its own: "Outubro de 2026", "Anual 2026". */
export const getObligationPeriodName = (obligation: LedgerObligation) => {
  if (obligation.purpose === 'initial_admission') {
    return 'Primeira contribuição';
  }

  const anchor = getPeriodAnchor(obligation);
  if (!anchor) return 'Contribuição';
  if (obligation.period_key?.startsWith('annual')) {
    return `Anual ${anchor.getUTCFullYear()}`;
  }

  const label = monthYearFormatter().format(anchor);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const getObligationTitle = (obligation: LedgerObligation) => {
  if (obligation.purpose === 'initial_admission')
    return 'Primeira contribuição';

  const period = getObligationPeriodLabel(obligation);
  return period ? `Contribuição ${period}` : 'Contribuição';
};

export const getObligationMeta = (obligation: LedgerObligation) => {
  if (obligation.status === 'void') return 'Esta contribuição foi cancelada.';

  const claims = obligation.claims ?? [];
  const approved = claims.filter((claim) => claim.status === 'approved').pop();

  if (approved) {
    return `Pagamento confirmado em ${formatLedgerDate(approved.decided_at ?? approved.created_at)}`;
  }

  if (obligation.status === 'settled') {
    return obligation.settled_at
      ? `Pagamento confirmado em ${formatLedgerDate(obligation.settled_at)}`
      : 'Pagamento confirmado';
  }

  const latest = claims[claims.length - 1];

  if (latest?.status === 'under_review') {
    return `Aviso enviado em ${formatLedgerDate(latest.created_at)}`;
  }

  if (latest?.status === 'rejected') {
    return `Aviso recusado em ${formatLedgerDate(latest.decided_at ?? latest.created_at)}`;
  }

  return `Vencimento em ${formatLedgerDate(obligation.due_on)}`;
};

export const getRejectedClaimReason = (obligation: LedgerObligation) =>
  obligation.claims
    ?.filter((claim) => claim.status === 'rejected' && claim.decision_reason)
    .pop()?.decision_reason ?? null;

const obligationStatusCopy: Record<string, string> = {
  available: 'Disponível',
  overdue: 'Em atraso',
  scheduled: 'Programada',
  settled: 'Confirmada',
  under_review: 'Em conferência',
  void: 'Cancelada',
};

export const getObligationStatusLabel = (status: string) =>
  obligationStatusCopy[status] ?? status;

export const isApplicantWithDraft = (ledger: MembershipBillingLedger) =>
  ledger.legal_membership_state === 'applicant' &&
  ledger.application_status === 'draft';

export const isRefusedApplicant = (ledger: MembershipBillingLedger) =>
  ledger.legal_membership_state === 'applicant' &&
  ledger.application_status === 'refused';

export const getPaymentActionLabel = (
  ledger: MembershipBillingLedger,
  obligation: LedgerObligation,
) => {
  if (obligation.status === 'under_review') return 'Ver detalhes do pagamento';

  return ledger.legal_membership_state === 'applicant'
    ? 'Ver PIX e avisar pagamento'
    : 'Abrir PIX da contribuição';
};

/**
 * The history is paginated, so the count only claims a total when every record
 * has already been loaded.
 */
export const getHistoryCountLabel = (count: number, hasMore: boolean) => {
  if (count === 0) return null;
  if (hasMore) return `mais de ${count} registros`;

  return count === 1 ? '1 registro' : `${count} registros`;
};

export type LedgerTone =
  | 'ok'
  | 'due'
  | 'review'
  | 'late'
  | 'neutral'
  | 'refused';

export type LedgerStatusAction = {
  label: string;
  /** `payment` opens the obligation; `application` reopens the member form. */
  kind: 'payment' | 'application';
  emphasis: 'primary' | 'secondary';
};

export type LedgerStatus = {
  tone: LedgerTone;
  /** What a glance should take away, in a few words. */
  headline: string;
  /** One sentence: only what the person needs to do or know next. */
  body: string;
  action: LedgerStatusAction | null;
};

/**
 * The single read of where a person stands. Every surface (member card,
 * admission timeline) renders from this, so they never disagree.
 */
export const getLedgerStatus = (
  ledger: MembershipBillingLedger,
): LedgerStatus => {
  const attention = ledger.attention_obligation;
  const isApplicant = ledger.legal_membership_state === 'applicant';
  const paymentAction: LedgerStatusAction | null = attention?.obligation_id
    ? {
        label: getPaymentActionLabel(ledger, attention),
        kind: 'payment',
        emphasis: attention.status === 'under_review' ? 'secondary' : 'primary',
      }
    : null;

  if (isApplicantWithDraft(ledger)) {
    return {
      tone: 'neutral',
      headline: 'Cadastro incompleto',
      body: 'Termine o cadastro para enviar sua candidatura.',
      action: {
        label: 'Continuar cadastro',
        kind: 'application',
        emphasis: 'primary',
      },
    };
  }

  if (isRefusedApplicant(ledger)) {
    return {
      tone: 'refused',
      headline: 'Candidatura não aprovada',
      body:
        ledger.application_correction_reason?.trim() ||
        'A associação encerrou esta candidatura.',
      action: {
        label: 'Enviar nova candidatura',
        kind: 'application',
        emphasis: 'primary',
      },
    };
  }

  if (isApplicant) {
    return ledger.financial_standing === 'under_review'
      ? {
          tone: 'review',
          headline: 'Candidatura em análise',
          body: 'A associação está conferindo seu pagamento. Você será avisado quando for aprovado.',
          action: paymentAction,
        }
      : {
          tone: 'due',
          headline: 'Falta a primeira contribuição',
          body: 'Pague via PIX e avise pelo app para concluir sua entrada.',
          action: paymentAction,
        };
  }

  switch (ledger.financial_standing) {
    case 'payment_available':
      return {
        tone: 'due',
        headline: 'Contribuição disponível',
        body: 'Pague via PIX e avise pelo app quando concluir.',
        action: paymentAction,
      };
    case 'under_review':
      return {
        tone: 'review',
        headline: 'Pagamento em conferência',
        body: 'Recebemos seu aviso. A associação confirma em breve.',
        action: paymentAction,
      };
    case 'overdue':
      return {
        tone: 'late',
        headline: 'Contribuição em atraso',
        body:
          attention && getRejectedClaimReason(attention)
            ? 'Seu aviso foi recusado. Envie um novo comprovante.'
            : 'Sua associação segue ativa. Regularize quando puder.',
        action: paymentAction,
      };
    default:
      return {
        tone: 'ok',
        headline: 'Em dia',
        body: 'Nenhuma contribuição pendente.',
        action: null,
      };
  }
};

export const getPlanLabel = (ledger: MembershipBillingLedger) => {
  if (ledger.plan_type === 'annual') return 'Anual';
  if (ledger.plan_type === 'monthly') return 'Mensal';
  return null;
};

/**
 * "abr. de 2026", read from the settled admission. The history is paginated,
 * so this is null for a member whose admission is not loaded yet.
 */
export const getMemberSince = (ledger: MembershipBillingLedger) => {
  const admission = ledger.history.find(
    (item) => item.purpose === 'initial_admission' && item.status === 'settled',
  );
  if (!admission) return null;

  const value = admission.settled_at ?? admission.due_on;
  const parsed = new Date(DATE_ONLY.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
};
