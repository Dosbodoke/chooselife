import type {
  LedgerFinancialStanding,
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

const financialDescription: Record<LedgerFinancialStanding, string> = {
  up_to_date: 'Sua próxima contribuição ficará disponível antes do vencimento.',
  payment_available: 'Há uma contribuição pronta para pagamento.',
  under_review: 'Seu aviso foi recebido e aguarda conferência da associação.',
  overdue:
    'Sua associação continua ativa. Regularize a contribuição em atraso quando puder.',
};

export const isApplicantWithDraft = (ledger: MembershipBillingLedger) =>
  ledger.legal_membership_state === 'applicant' &&
  ledger.application_status === 'draft';

export const isRefusedApplicant = (ledger: MembershipBillingLedger) =>
  ledger.legal_membership_state === 'applicant' &&
  ledger.application_status === 'refused';

export const getMembershipTitle = (ledger: MembershipBillingLedger) => {
  if (ledger.legal_membership_state === 'active') return 'Associado ativo';
  if (isApplicantWithDraft(ledger)) return 'Cadastro incompleto';
  if (isRefusedApplicant(ledger)) return 'Candidatura não aprovada';

  return ledger.financial_standing === 'under_review'
    ? 'Candidatura em análise'
    : 'Candidatura em andamento';
};

export const getMembershipDescription = (ledger: MembershipBillingLedger) => {
  if (ledger.legal_membership_state === 'active') {
    return financialDescription[ledger.financial_standing];
  }

  if (isApplicantWithDraft(ledger)) {
    return 'Você começou seu cadastro, mas ainda não enviou a candidatura.';
  }

  if (isRefusedApplicant(ledger)) {
    return 'Esta candidatura foi encerrada pela associação.';
  }

  if (ledger.financial_standing === 'under_review') {
    return 'Seu pagamento foi informado. A associação está conferindo o pagamento antes de confirmar sua entrada.';
  }

  return 'Complete a primeira contribuição para que a associação possa verificar sua admissão.';
};

export const getPaymentSectionLabel = (
  ledger: MembershipBillingLedger,
  obligation: LedgerObligation,
) => {
  if (obligation.status === 'under_review') return 'Pagamento informado';
  if (obligation.status === 'overdue') return 'Contribuição em atraso';
  if (obligation.purpose === 'initial_admission') {
    return 'Primeira contribuição';
  }

  return ledger.legal_membership_state === 'applicant'
    ? 'Contribuição pendente'
    : 'Próxima contribuição';
};

export const getPaymentActionLabel = (
  ledger: MembershipBillingLedger,
  obligation: LedgerObligation,
) => {
  if (obligation.status === 'under_review') return 'Ver detalhes do pagamento';

  return ledger.legal_membership_state === 'applicant'
    ? 'Ver PIX e avisar pagamento'
    : 'Abrir PIX da contribuição';
};

export const getNextStepDescription = (
  ledger: MembershipBillingLedger,
  attention: LedgerObligation | null,
) => {
  if (ledger.legal_membership_state === 'applicant') {
    if (isApplicantWithDraft(ledger)) {
      return 'Complete seu cadastro para enviar a candidatura.';
    }

    if (isRefusedApplicant(ledger)) {
      const reason = ledger.application_correction_reason?.trim();
      return reason
        ? `Motivo informado: ${reason}`
        : 'Você pode enviar uma nova candidatura.';
    }

    return ledger.financial_standing === 'under_review'
      ? 'A associação confere o pagamento informado.'
      : 'Faça a primeira contribuição e avise pelo app.';
  }

  if (attention?.status === 'under_review') {
    return 'A associação confere o pagamento informado.';
  }

  if (attention?.status === 'overdue') {
    return 'Regularize a contribuição para manter sua associação em dia.';
  }

  return 'Abra os dados de pagamento e avise quando concluir.';
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
