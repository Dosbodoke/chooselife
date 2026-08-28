import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { getPaymentObligationRouteParams } from '~/lib/manual-payment';
import {
  fetchMembershipBillingLedger,
  type LedgerFinancialStanding,
  type LedgerObligation,
  type MembershipBillingLedger,
} from '~/lib/membership-ledger';
import { queryKeys } from '~/lib/query-keys';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(amount / 100);

const ledgerDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const formatDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;

  return ledgerDateFormatter.format(parsed);
};

const financialCopy: Record<
  LedgerFinancialStanding,
  { description: string; label: string; tone: string }
> = {
  up_to_date: {
    description:
      'Sua próxima contribuição ficará disponível antes do vencimento.',
    label: 'Contribuições em dia',
    tone: 'emerald',
  },
  payment_available: {
    description: 'Há uma contribuição pronta para pagamento no Ledger.',
    label: 'Pagamento disponível',
    tone: 'blue',
  },
  under_review: {
    description:
      'Seu aviso foi recebido e está aguardando conferência da associação.',
    label: 'Pagamento em análise',
    tone: 'violet',
  },
  overdue: {
    description:
      'Sua associação continua ativa. Regularize o período em atraso quando puder.',
    label: 'Contribuição em atraso',
    tone: 'amber',
  },
};

const obligationStatusCopy: Record<string, string> = {
  available: 'Disponível',
  overdue: 'Em atraso',
  scheduled: 'Agendado',
  settled: 'Confirmado',
  under_review: 'Em análise',
  void: 'Cancelado',
};

function ObligationIcon({ status }: { status: LedgerObligation['status'] }) {
  if (status === 'settled') return <CheckCircle2 color="#047857" size={18} />;
  if (status === 'under_review') return <Clock3 color="#6D28D9" size={18} />;
  if (status === 'overdue') return <AlertCircle color="#B45309" size={18} />;
  return <CalendarDays color="#52525B" size={18} />;
}

function ObligationRow({ obligation }: { obligation: LedgerObligation }) {
  return (
    <View className="gap-2 border-t border-zinc-100 px-4 py-4">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-zinc-100">
          <ObligationIcon status={obligation.status} />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-bold text-zinc-900">
            Período {obligation.period_key}
          </Text>
          <Text className="text-xs text-zinc-500">
            Vencimento: {formatDate(obligation.due_on)}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Text className="font-bold text-zinc-900">
            {formatAmount(obligation.amount, obligation.currency)}
          </Text>
          <Text className="text-xs font-semibold text-zinc-500">
            {obligationStatusCopy[obligation.status] ?? obligation.status}
          </Text>
        </View>
      </View>
      {obligation.claims?.length ? (
        <View className="gap-1 pl-12">
          {obligation.claims.map((claim) => (
            <Text
              key={claim.claim_id}
              className="text-right text-[11px] leading-4 text-zinc-500"
            >
              {claim.status === 'rejected'
                ? `Aviso rejeitado${claim.decision_reason ? `: ${claim.decision_reason}` : ''}`
                : claim.status === 'under_review'
                  ? 'Aviso aguardando conferência'
                  : 'Pagamento conferido'}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({
  ledger,
  obligation,
  slug,
}: {
  ledger: MembershipBillingLedger;
  obligation: LedgerObligation;
  slug: string;
}) {
  const router = useRouter();
  if (!obligation.obligation_id) return null;

  const isApplicant = ledger.legal_membership_state === 'applicant';
  const label =
    obligation.status === 'under_review'
      ? 'Ver pagamento em análise'
      : isApplicant
        ? 'Ver PIX e avisar pagamento'
        : 'Abrir PIX da contribuição';

  return (
    <Button
      accessibilityLabel={label}
      accessibilityHint="Abre os dados oficiais desta obrigação"
      className="min-h-11 flex-row items-center justify-center gap-2 rounded-xl bg-zinc-950"
      onPress={() =>
        router.push({
          pathname: '/payment',
          params: getPaymentObligationRouteParams({
            amount: obligation.amount,
            currency: obligation.currency,
            obligationId: obligation.obligation_id!,
            paymentContext: isApplicant ? 'new_member' : 'subscription_renewal',
            slug,
          }),
        })
      }
    >
      <ArrowRight color="#FFFFFF" size={18} />
      <Text className="font-bold text-white">{label}</Text>
    </Button>
  );
}

function LedgerContent({
  ledger,
  slug,
}: {
  ledger: MembershipBillingLedger;
  slug: string;
}) {
  const financial = financialCopy[ledger.financial_standing];
  const attention = ledger.attention_obligation;
  const next = ledger.next_contribution;
  const isApplicant = ledger.legal_membership_state === 'applicant';

  return (
    <View className="gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            {isApplicant ? 'Admissão' : 'Ledger da associação'}
          </Text>
          <Text
            accessibilityRole="header"
            className="text-xl font-black text-zinc-950"
          >
            {isApplicant ? 'Candidatura em andamento' : 'Associado ativo'}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2">
          <ShieldCheck color="#047857" size={15} />
          <Text className="text-xs font-bold text-emerald-700">
            {isApplicant ? 'Em análise' : 'Vínculo ativo'}
          </Text>
        </View>
      </View>

      <View
        className={`gap-2 rounded-2xl border p-4 ${
          financial.tone === 'amber'
            ? 'border-amber-200 bg-amber-50'
            : financial.tone === 'violet'
              ? 'border-violet-200 bg-violet-50'
              : financial.tone === 'blue'
                ? 'border-blue-200 bg-blue-50'
                : 'border-emerald-200 bg-emerald-50'
        }`}
      >
        <Text className="text-xs font-bold uppercase tracking-wide text-zinc-600">
          Situação financeira
        </Text>
        <Text className="text-lg font-black text-zinc-950">
          {isApplicant && ledger.financial_standing === 'payment_available'
            ? 'Primeira contribuição disponível'
            : isApplicant && ledger.financial_standing === 'under_review'
              ? 'Admissão em análise'
              : financial.label}
        </Text>
        <Text className="text-sm leading-5 text-zinc-700">
          {isApplicant && ledger.financial_standing === 'under_review'
            ? 'Seu PIX foi informado. A associação ainda precisa verificar o pagamento e admitir você.'
            : isApplicant
              ? 'Complete a primeira contribuição para que a associação possa verificar sua admissão.'
              : financial.description}
        </Text>
      </View>

      {attention ? (
        <View className="gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-xs font-bold uppercase tracking-wide text-zinc-500">
              Precisa de atenção
            </Text>
            <Text className="text-xs font-bold text-zinc-600">
              {formatDate(attention.due_on)}
            </Text>
          </View>
          <View className="flex-row items-end justify-between gap-3">
            <Text className="text-lg font-black text-zinc-950">
              {formatAmount(attention.amount, attention.currency)}
            </Text>
            <Text className="text-sm font-semibold text-zinc-600">
              {obligationStatusCopy[attention.status] ?? attention.status}
            </Text>
          </View>
          <ActionButton ledger={ledger} obligation={attention} slug={slug} />
        </View>
      ) : null}

      {!isApplicant && next ? (
        <View className="flex-row items-center gap-3 rounded-2xl bg-zinc-50 p-4">
          <CalendarDays color="#52525B" size={22} />
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-xs font-bold uppercase tracking-wide text-zinc-500">
              Próxima contribuição
            </Text>
            <Text className="font-bold text-zinc-950">
              {formatAmount(next.amount, next.currency)} ·{' '}
              {formatDate(next.due_on)}
            </Text>
          </View>
        </View>
      ) : null}

      <View className="overflow-hidden rounded-2xl border border-zinc-200">
        <View className="flex-row items-center justify-between px-4 py-4">
          <Text className="font-black text-zinc-950">
            Histórico de contribuições
          </Text>
          <Text className="text-xs font-semibold text-zinc-500">
            {ledger.history.length} períodos
          </Text>
        </View>
        {ledger.history.length > 0 ? (
          ledger.history.map((obligation) => (
            <ObligationRow
              key={
                obligation.obligation_id ??
                `${obligation.period_key}:${obligation.due_on}`
              }
              obligation={obligation}
            />
          ))
        ) : (
          <Text className="border-t border-zinc-100 px-4 py-5 text-sm text-zinc-500">
            Ainda não há períodos no histórico.
          </Text>
        )}
      </View>
    </View>
  );
}

export function MembershipLedger({
  organizationId,
  slug,
}: {
  organizationId: string;
  slug: string;
}) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const queryKey = queryKeys.membershipBilling.byOrg(organizationId, userId);
  const ledgerQuery = useQuery({
    queryKey,
    queryFn: () => fetchMembershipBillingLedger(organizationId),
    enabled: Boolean(userId && organizationId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  useFocusEffect(() => {
    if (!userId) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.membershipBilling.byOrg(organizationId, userId),
    });
  });

  if (!userId) return null;

  if (ledgerQuery.isLoading) {
    return (
      <View className="items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white p-8">
        <ActivityIndicator color="#18181B" />
        <Text className="text-sm text-zinc-500">Carregando seu Ledger...</Text>
      </View>
    );
  }

  if (ledgerQuery.isError || !ledgerQuery.data) {
    return (
      <View className="items-center gap-3 rounded-2xl border border-red-200 bg-white p-6">
        <AlertCircle color="#DC2626" size={32} />
        <Text className="text-center text-base font-bold text-zinc-950">
          Não foi possível carregar o Ledger
        </Text>
        <Text className="text-center text-sm leading-5 text-zinc-600">
          O perfil público e as notícias continuam disponíveis. Tente consultar
          sua situação financeira novamente.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
          className="min-h-11 flex-row items-center gap-2 rounded-xl bg-zinc-950 px-4 py-3"
          onPress={() => void ledgerQuery.refetch()}
        >
          <RefreshCw color="#FFFFFF" size={16} />
          <Text className="font-bold text-white">Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return <LedgerContent ledger={ledgerQuery.data} slug={slug} />;
}
