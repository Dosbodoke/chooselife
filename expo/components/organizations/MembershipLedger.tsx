import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  RefreshCw,
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { getPaymentObligationRouteParams } from '~/lib/manual-payment';
import {
  fetchMembershipBillingLedger,
  type LedgerObligation,
  type MembershipBillingLedger,
} from '~/lib/membership-ledger';
import {
  formatLedgerAmount,
  formatLedgerDate,
  getHistoryCountLabel,
  getMembershipDescription,
  getMembershipTitle,
  getNextStepDescription,
  getObligationMeta,
  getObligationStatusLabel,
  getObligationTitle,
  getPaymentActionLabel,
  getPaymentSectionLabel,
  getRejectedClaimReason,
  isApplicantWithDraft,
  isRefusedApplicant,
} from '~/lib/membership-ledger-copy';
import { queryKeys } from '~/lib/query-keys';

import { BecomeMemberCard } from '~/components/organizations/become-member-card';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

function LedgerSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-xs font-bold uppercase tracking-[1.4px] text-zinc-500">
      {children}
    </Text>
  );
}

function ObligationIcon({ status }: { status: LedgerObligation['status'] }) {
  if (status === 'settled') return <CheckCircle2 color="#047857" size={18} />;
  if (status === 'under_review') return <Clock3 color="#6D28D9" size={18} />;
  if (status === 'overdue') return <AlertCircle color="#B45309" size={18} />;
  return <CalendarDays color="#52525B" size={18} />;
}

const getObligationIconBackground = (status: LedgerObligation['status']) => {
  if (status === 'settled') return 'bg-emerald-50';
  if (status === 'under_review') return 'bg-violet-50';
  if (status === 'overdue') return 'bg-amber-50';
  return 'bg-zinc-100';
};

function ObligationRow({ obligation }: { obligation: LedgerObligation }) {
  const rejectedReason = getRejectedClaimReason(obligation);

  return (
    <View className="flex-row items-start gap-3 border-t border-zinc-100 px-5 py-4">
      <View
        className={`mt-0.5 h-9 w-9 items-center justify-center rounded-full ${getObligationIconBackground(obligation.status)}`}
      >
        <ObligationIcon status={obligation.status} />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-bold text-zinc-900">
          {getObligationTitle(obligation)}
        </Text>
        <Text className="text-xs leading-4 text-zinc-500">
          {getObligationMeta(obligation)}
        </Text>
        {rejectedReason ? (
          <Text className="text-xs leading-4 text-amber-700">
            Motivo: {rejectedReason}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-1">
        <Text className="font-bold text-zinc-900" selectable>
          {formatLedgerAmount(obligation.amount, obligation.currency)}
        </Text>
        <Text className="text-xs font-semibold text-zinc-500">
          {getObligationStatusLabel(obligation.status)}
        </Text>
      </View>
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
  const label = getPaymentActionLabel(ledger, obligation);

  return (
    <Button
      accessibilityLabel={label}
      accessibilityHint="Abre os dados oficiais desta contribuição"
      className="min-h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3"
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
      <ArrowUpRight color="#FFFFFF" size={18} strokeWidth={2.4} />
      <Text className="text-sm font-bold text-white">{label}</Text>
    </Button>
  );
}

function ApplicationActionButton({
  label,
  slug,
}: {
  label: string;
  slug: string;
}) {
  const router = useRouter();

  return (
    <Button
      accessibilityLabel={label}
      accessibilityHint="Abre o cadastro para continuar sua associação"
      className="mt-3 min-h-11 flex-row items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3"
      onPress={() => router.push(`/organizations/${slug}/member`)}
    >
      <ArrowUpRight color="#FFFFFF" size={18} strokeWidth={2.4} />
      <Text className="text-sm font-bold text-white">{label}</Text>
    </Button>
  );
}

function LedgerContent({
  hasMoreHistory,
  history,
  isLoadingMoreHistory,
  ledger,
  onLoadMoreHistory,
  slug,
}: {
  hasMoreHistory: boolean;
  history: LedgerObligation[];
  isLoadingMoreHistory: boolean;
  ledger: MembershipBillingLedger;
  onLoadMoreHistory: () => void;
  slug: string;
}) {
  const attention = ledger.attention_obligation;
  const next = ledger.next_contribution;
  const isApplicant = ledger.legal_membership_state === 'applicant';
  const showApplicationAction =
    isApplicantWithDraft(ledger) || isRefusedApplicant(ledger);
  const applicationActionLabel = isApplicantWithDraft(ledger)
    ? 'Continuar cadastro'
    : 'Enviar nova candidatura';
  const showNextStep = isApplicant || Boolean(attention);
  const showNextContribution = !isApplicant && Boolean(next);
  const historyCountLabel = getHistoryCountLabel(
    history.length,
    hasMoreHistory,
  );

  return (
    <View className="overflow-hidden rounded-3xl bg-white">
      <View className="gap-1 px-5 pb-5 pt-5">
        <LedgerSectionLabel>Minha associação</LedgerSectionLabel>
        <Text
          accessibilityRole="header"
          className="text-2xl font-black text-zinc-950"
          selectable
        >
          {getMembershipTitle(ledger)}
        </Text>
        <Text className="text-sm leading-5 text-zinc-600">
          {getMembershipDescription(ledger)}
        </Text>
      </View>

      {attention ? (
        <View className="gap-4 border-y border-zinc-200 px-5 py-4">
          <View className="flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1 gap-1">
              <LedgerSectionLabel>
                {getPaymentSectionLabel(ledger, attention)}
              </LedgerSectionLabel>
              <Text className="text-sm text-zinc-600">
                Vencimento em {formatLedgerDate(attention.due_on)}
              </Text>
            </View>
            <View className="items-end gap-1">
              <Text className="text-xl font-black text-zinc-950" selectable>
                {formatLedgerAmount(attention.amount, attention.currency)}
              </Text>
              <Text className="text-xs font-semibold text-zinc-500">
                {getObligationStatusLabel(attention.status)}
              </Text>
            </View>
          </View>
          <ActionButton ledger={ledger} obligation={attention} slug={slug} />
        </View>
      ) : null}

      {showNextStep ? (
        <View className="flex-row items-center gap-3 px-5 py-4">
          <CalendarDays color="#52525B" size={22} />
          <View className="min-w-0 flex-1 gap-1">
            <LedgerSectionLabel>
              {isRefusedApplicant(ledger) ? 'Como continuar' : 'Próximo passo'}
            </LedgerSectionLabel>
            <Text className="text-sm leading-5 text-zinc-600">
              {getNextStepDescription(ledger, attention)}
            </Text>
            {showApplicationAction ? (
              <ApplicationActionButton
                label={applicationActionLabel}
                slug={slug}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {showNextContribution && next ? (
        <View
          className={`flex-row items-center gap-3 px-5 py-4 ${attention || showNextStep ? 'border-t border-zinc-200' : 'border-y border-zinc-200'}`}
        >
          <CalendarDays color="#52525B" size={22} />
          <View className="min-w-0 flex-1 gap-1">
            <LedgerSectionLabel>Próxima contribuição</LedgerSectionLabel>
            <Text className="font-bold text-zinc-950">
              {formatLedgerAmount(next.amount, next.currency)} ·{' '}
              {formatLedgerDate(next.due_on)}
            </Text>
          </View>
        </View>
      ) : null}

      <View className="border-t border-zinc-200">
        <View className="flex-row items-center justify-between gap-3 px-5 py-4">
          <Text className="font-black text-zinc-950">
            Histórico de contribuições
          </Text>
          {historyCountLabel ? (
            <Text className="text-xs font-semibold text-zinc-500">
              {historyCountLabel}
            </Text>
          ) : null}
        </View>
        {history.length > 0 ? (
          history.map((obligation) => (
            <ObligationRow
              key={
                obligation.obligation_id ??
                `${obligation.period_key}:${obligation.due_on}`
              }
              obligation={obligation}
            />
          ))
        ) : (
          <Text className="border-t border-zinc-100 px-5 py-5 text-sm text-zinc-500">
            Ainda não há contribuições registradas.
          </Text>
        )}
        {hasMoreHistory ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver contribuições anteriores"
            className="min-h-12 flex-row items-center justify-center gap-2 border-t border-zinc-100 px-5 py-4"
            disabled={isLoadingMoreHistory}
            onPress={onLoadMoreHistory}
          >
            {isLoadingMoreHistory ? (
              <ActivityIndicator color="#18181B" size="small" />
            ) : (
              <ChevronDown color="#18181B" size={16} strokeWidth={2.4} />
            )}
            <Text className="text-sm font-bold text-zinc-950">
              {isLoadingMoreHistory
                ? 'Carregando...'
                : 'Ver contribuições anteriores'}
            </Text>
          </Pressable>
        ) : null}
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
  const ledgerQuery = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchMembershipBillingLedger(organizationId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage?.history_has_more ? lastPage.history_next_cursor : null,
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
        <Text className="text-sm text-zinc-500">
          Carregando sua situação...
        </Text>
      </View>
    );
  }

  const pages = ledgerQuery.data?.pages;

  if (ledgerQuery.isError || pages === undefined) {
    return (
      <View className="items-center gap-3 rounded-2xl border border-red-200 bg-white p-6">
        <AlertCircle color="#DC2626" size={32} />
        <Text className="text-center text-base font-bold text-zinc-950">
          Não foi possível carregar sua situação
        </Text>
        <Text className="text-center text-sm leading-5 text-zinc-600">
          O perfil público e as notícias continuam disponíveis. Tente consultar
          suas contribuições novamente.
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

  const ledger = pages[0];

  if (!ledger) return <BecomeMemberCard slug={slug} />;

  return (
    <LedgerContent
      hasMoreHistory={ledgerQuery.hasNextPage}
      history={pages.flatMap((page) => page?.history ?? [])}
      isLoadingMoreHistory={ledgerQuery.isFetchingNextPage}
      ledger={ledger}
      onLoadMoreHistory={() => void ledgerQuery.fetchNextPage()}
      slug={slug}
    />
  );
}
