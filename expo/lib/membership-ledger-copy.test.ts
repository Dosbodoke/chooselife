import type {
  LedgerClaim,
  LedgerObligation,
  MembershipBillingLedger,
} from './membership-ledger';
import {
  formatLedgerAmount,
  formatLedgerDate,
  formatLedgerShortDate,
  getHistoryCountLabel,
  getLedgerStatus,
  getMemberSince,
  getObligationMeta,
  getObligationPeriodName,
  getObligationStatusLabel,
  getObligationTitle,
  getPaymentActionLabel,
  getPlanLabel,
  getRejectedClaimReason,
} from './membership-ledger-copy';

const obligation = (
  overrides: Partial<LedgerObligation> = {},
): LedgerObligation => ({
  obligation_id: 'obligation-1',
  purpose: 'recurring',
  status: 'available',
  period_key: 'monthly:2026-09-10',
  period_start: '2026-09-10',
  period_end: '2026-10-09',
  available_on: '2026-09-03',
  due_on: '2026-09-10',
  amount: 5000,
  currency: 'BRL',
  action: { type: 'open_obligation' },
  claims: [],
  ...overrides,
});

const claim = (overrides: Partial<LedgerClaim> = {}): LedgerClaim => ({
  claim_id: 'claim-1',
  status: 'under_review',
  payer: 'applicant',
  payer_name: null,
  created_at: '2026-09-05T14:00:00+00:00',
  decided_at: null,
  decision_reason: null,
  ...overrides,
});

const ledger = (
  overrides: Partial<MembershipBillingLedger> = {},
): MembershipBillingLedger => ({
  organization_id: 'org-1',
  organization_slug: 'associacao',
  organization_name: 'Associação',
  legal_membership_state: 'active',
  application_status: 'admitted',
  application_correction_reason: null,
  financial_standing: 'up_to_date',
  evaluated_at: '2026-09-01T12:00:00+00:00',
  plan_type: 'monthly',
  attention_obligation: null,
  next_contribution: null,
  history: [],
  history_limit: 24,
  history_has_more: false,
  history_next_cursor: null,
  ...overrides,
});

describe('formatLedgerAmount', () => {
  it('reads the amount in Brazilian currency', () => {
    // Intl separates the symbol with a non-breaking space.
    expect(formatLedgerAmount(5000, 'BRL')).toMatch(/^R\$\s50,00$/);
  });

  it('reads cents that are not whole reais', () => {
    expect(formatLedgerAmount(12345, 'BRL')).toMatch(/^R\$\s123,45$/);
  });
});

describe('formatLedgerDate', () => {
  it('keeps a plain due date on its own day', () => {
    expect(formatLedgerDate('2026-09-10')).toBe('10 de setembro de 2026');
  });

  it('reads a notice timestamp on the day the person sent it', () => {
    // 22:00 in Brazil is already the next day in UTC.
    expect(
      formatLedgerDate('2026-09-10T22:00:00-03:00', 'America/Sao_Paulo'),
    ).toBe('10 de setembro de 2026');
  });

  it('returns the raw value when the date cannot be read', () => {
    expect(formatLedgerDate('not-a-date')).toBe('not-a-date');
  });
});

describe('getObligationTitle', () => {
  it('names the admission contribution', () => {
    expect(
      getObligationTitle(obligation({ purpose: 'initial_admission' })),
    ).toBe('Primeira contribuição');
  });

  it('never shows the machine period key', () => {
    expect(getObligationTitle(obligation())).toBe(
      'Contribuição de setembro de 2026',
    );
  });

  it('names an annual contribution by its year', () => {
    expect(
      getObligationTitle(
        obligation({
          period_key: 'annual:2026-09-10',
          period_end: '2027-09-09',
        }),
      ),
    ).toBe('Contribuição anual de 2026');
  });

  it('falls back without leaking an unreadable period', () => {
    expect(
      getObligationTitle(
        obligation({ period_key: 'monthly:???', period_start: '', due_on: '' }),
      ),
    ).toBe('Contribuição');
  });
});

describe('getObligationMeta', () => {
  it('shows the due date when no notice was sent', () => {
    expect(getObligationMeta(obligation())).toBe(
      'Vencimento em 10 de setembro de 2026',
    );
  });

  it('shows when a notice is waiting for review', () => {
    expect(
      getObligationMeta(
        obligation({ status: 'under_review', claims: [claim()] }),
      ),
    ).toBe('Aviso enviado em 05 de setembro de 2026');
  });

  it('shows when a notice was refused', () => {
    expect(
      getObligationMeta(
        obligation({
          claims: [
            claim({
              status: 'rejected',
              decided_at: '2026-09-06T14:00:00+00:00',
              decision_reason: 'Comprovante ilegível',
            }),
          ],
        }),
      ),
    ).toBe('Aviso recusado em 06 de setembro de 2026');
  });

  it('prefers the approval date of a confirmed contribution', () => {
    expect(
      getObligationMeta(
        obligation({
          status: 'settled',
          settled_at: '2026-09-08T10:00:00+00:00',
          claims: [
            claim({
              status: 'approved',
              decided_at: '2026-09-07T10:00:00+00:00',
            }),
          ],
        }),
      ),
    ).toBe('Pagamento confirmado em 07 de setembro de 2026');
  });

  it('uses the settlement date when the association confirmed without a notice', () => {
    expect(
      getObligationMeta(
        obligation({
          status: 'settled',
          settled_at: '2026-09-08T10:00:00+00:00',
        }),
      ),
    ).toBe('Pagamento confirmado em 08 de setembro de 2026');
  });

  it('states plainly that a cancelled contribution is not owed', () => {
    expect(getObligationMeta(obligation({ status: 'void' }))).toBe(
      'Esta contribuição foi cancelada.',
    );
  });
});

describe('getRejectedClaimReason', () => {
  it('keeps the latest refusal reason', () => {
    expect(
      getRejectedClaimReason(
        obligation({
          claims: [
            claim({ status: 'rejected', decision_reason: 'Valor divergente' }),
            claim({
              status: 'rejected',
              decision_reason: 'Comprovante ilegível',
            }),
          ],
        }),
      ),
    ).toBe('Comprovante ilegível');
  });

  it('stays silent when nothing was refused', () => {
    expect(
      getRejectedClaimReason(obligation({ claims: [claim()] })),
    ).toBeNull();
  });
});

describe('getObligationStatusLabel', () => {
  it('translates every status the read model can return', () => {
    expect(
      [
        'scheduled',
        'available',
        'under_review',
        'overdue',
        'settled',
        'void',
      ].map(getObligationStatusLabel),
    ).toEqual([
      'Programada',
      'Disponível',
      'Em conferência',
      'Em atraso',
      'Confirmada',
      'Cancelada',
    ]);
  });

  it('shows an unknown status instead of an empty label', () => {
    expect(getObligationStatusLabel('surprise')).toBe('surprise');
  });
});

describe('getPaymentActionLabel', () => {
  it('sends a reviewed payment to its details instead of a new payment', () => {
    expect(
      getPaymentActionLabel(ledger(), obligation({ status: 'under_review' })),
    ).toBe('Ver detalhes do pagamento');
  });

  it('asks an applicant to pay and notice, and a member only to pay', () => {
    expect(
      getPaymentActionLabel(
        ledger({
          legal_membership_state: 'applicant',
          application_status: 'submitted',
        }),
        obligation({ purpose: 'initial_admission' }),
      ),
    ).toBe('Ver PIX e avisar pagamento');
    expect(getPaymentActionLabel(ledger(), obligation())).toBe(
      'Abrir PIX da contribuição',
    );
  });
});

describe('getHistoryCountLabel', () => {
  it('says nothing when the history is empty', () => {
    expect(getHistoryCountLabel(0, false)).toBeNull();
  });

  it('counts loaded records', () => {
    expect(getHistoryCountLabel(1, false)).toBe('1 registro');
    expect(getHistoryCountLabel(3, false)).toBe('3 registros');
  });

  it('never claims a total while older records are unread', () => {
    expect(getHistoryCountLabel(24, true)).toBe('mais de 24 registros');
  });
});

describe('formatLedgerShortDate', () => {
  const today = new Date('2026-10-07T12:00:00Z');

  it('drops the year within the current year', () => {
    expect(formatLedgerShortDate('2026-11-10', today)).toBe('10 de nov.');
  });

  it('keeps the year when it is not the current one', () => {
    expect(formatLedgerShortDate('2027-04-10', today)).toBe(
      '10 de abr. de 2027',
    );
  });
});

describe('getObligationPeriodName', () => {
  it('names a monthly period by month and year', () => {
    expect(getObligationPeriodName(obligation())).toBe('Setembro de 2026');
  });

  it('names an annual period by its year', () => {
    expect(
      getObligationPeriodName(
        obligation({
          period_key: 'annual:2026-04-10',
          period_start: '2026-04-10',
        }),
      ),
    ).toBe('Anual 2026');
  });

  it('names the admission contribution', () => {
    expect(
      getObligationPeriodName(obligation({ purpose: 'initial_admission' })),
    ).toBe('Primeira contribuição');
  });
});

describe('getLedgerStatus', () => {
  const applicant = (overrides: Partial<MembershipBillingLedger> = {}) =>
    ledger({
      legal_membership_state: 'applicant',
      application_status: 'submitted',
      ...overrides,
    });

  it('covers every membership state with a headline and next step', () => {
    const cases: [MembershipBillingLedger, string][] = [
      [ledger(), 'Em dia'],
      [
        ledger({ financial_standing: 'payment_available' }),
        'Contribuição disponível',
      ],
      [
        ledger({ financial_standing: 'under_review' }),
        'Pagamento em conferência',
      ],
      [ledger({ financial_standing: 'overdue' }), 'Contribuição em atraso'],
      [applicant({ application_status: 'draft' }), 'Cadastro incompleto'],
      [
        applicant({ application_status: 'refused' }),
        'Candidatura não aprovada',
      ],
      [
        applicant({ financial_standing: 'under_review' }),
        'Candidatura em análise',
      ],
      [
        applicant({ financial_standing: 'payment_available' }),
        'Falta a primeira contribuição',
      ],
    ];

    for (const [state, headline] of cases) {
      const status = getLedgerStatus(state);
      expect(status.headline).toBe(headline);
      expect(status.body.length).toBeGreaterThan(0);
    }
  });

  it('asks nothing of a member who is up to date', () => {
    expect(getLedgerStatus(ledger()).action).toBeNull();
  });

  it('opens the payment of the obligation that needs attention', () => {
    const status = getLedgerStatus(
      ledger({
        financial_standing: 'payment_available',
        attention_obligation: obligation(),
      }),
    );

    expect(status.action).toEqual({
      label: 'Abrir PIX da contribuição',
      kind: 'payment',
      emphasis: 'primary',
    });
  });

  it('demotes the action to details while a notice is under review', () => {
    const status = getLedgerStatus(
      ledger({
        financial_standing: 'under_review',
        attention_obligation: obligation({ status: 'under_review' }),
      }),
    );

    expect(status.action?.emphasis).toBe('secondary');
  });

  it('asks for a new receipt when an overdue notice was refused', () => {
    const status = getLedgerStatus(
      ledger({
        financial_standing: 'overdue',
        attention_obligation: obligation({
          status: 'overdue',
          claims: [claim({ status: 'rejected', decision_reason: 'Ilegível' })],
        }),
      }),
    );

    expect(status.body).toContain('Envie um novo comprovante');
  });

  it('sends draft and refused applicants back to the application', () => {
    expect(
      getLedgerStatus(applicant({ application_status: 'draft' })).action,
    ).toMatchObject({ kind: 'application', label: 'Continuar cadastro' });
    expect(
      getLedgerStatus(applicant({ application_status: 'refused' })).action,
    ).toMatchObject({ kind: 'application', label: 'Enviar nova candidatura' });
  });

  it('keeps the reason a candidacy was refused', () => {
    expect(
      getLedgerStatus(
        applicant({
          application_status: 'refused',
          application_correction_reason: '  CPF divergente  ',
        }),
      ).body,
    ).toBe('CPF divergente');
  });
});

describe('getPlanLabel', () => {
  it('names the plan cadence', () => {
    expect(getPlanLabel(ledger({ plan_type: 'monthly' }))).toBe('Mensal');
    expect(getPlanLabel(ledger({ plan_type: 'annual' }))).toBe('Anual');
    expect(getPlanLabel(ledger({ plan_type: null }))).toBeNull();
  });
});

describe('getMemberSince', () => {
  it('reads the month the admission was confirmed', () => {
    expect(
      getMemberSince(
        ledger({
          history: [
            obligation({
              purpose: 'initial_admission',
              status: 'settled',
              settled_at: '2026-04-12T15:00:00Z',
            }),
          ],
        }),
      ),
    ).toBe('abr. de 2026');
  });

  it('stays silent while the admission is not loaded', () => {
    expect(getMemberSince(ledger({ history: [obligation()] }))).toBeNull();
  });
});
