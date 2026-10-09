import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import SlacCabeMaisImage from '~/assets/images/slac-cabe-mais.png';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertCircle,
  Check,
  ChevronRight,
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
  formatLedgerShortDate,
  getLedgerStatus,
  getMemberSince,
  getObligationPeriodName,
  getPlanLabel,
  getRejectedClaimReason,
  isApplicantWithDraft,
  isRefusedApplicant,
  type LedgerStatusAction,
  type LedgerTone,
} from '~/lib/membership-ledger-copy';
import { queryKeys } from '~/lib/query-keys';

import { BecomeMemberCard } from '~/components/organizations/become-member-card';
import { ContributionHistorySheet } from '~/components/organizations/contribution-history-sheet';
import { SupabaseAvatar } from '~/components/supabase-avatar';
import { Text } from '~/components/ui/text';

const tabular = { fontVariant: ['tabular-nums' as const] };

const TONE: Record<LedgerTone, { fg: string; bg: string; solid: string }> = {
  ok: { fg: '#047857', bg: '#ECFDF5', solid: '#10B981' },
  due: { fg: '#1D4ED8', bg: '#EFF6FF', solid: '#2563EB' },
  review: { fg: '#6D28D9', bg: '#F5F3FF', solid: '#7C3AED' },
  late: { fg: '#B45309', bg: '#FFFBEB', solid: '#D97706' },
  neutral: { fg: '#3F3F46', bg: '#F4F4F5', solid: '#52525B' },
  refused: { fg: '#B91C1C', bg: '#FEF2F2', solid: '#DC2626' },
};

const TONE_LABEL: Record<LedgerTone, string> = {
  ok: 'Em dia',
  due: 'A pagar',
  review: 'Em conferência',
  late: 'Em atraso',
  neutral: 'Incompleta',
  refused: 'Não aprovada',
};

function useLedgerAction(ledger: MembershipBillingLedger, slug: string) {
  const router = useRouter();

  return (action: LedgerStatusAction) => {
    if (action.kind === 'application') {
      router.push(`/organizations/${slug}/member`);
      return;
    }

    const obligation = ledger.attention_obligation;
    if (!obligation?.obligation_id) return;

    router.push({
      pathname: '/payment',
      params: getPaymentObligationRouteParams({
        amount: obligation.amount,
        currency: obligation.currency,
        obligationId: obligation.obligation_id,
        paymentContext:
          ledger.legal_membership_state === 'applicant'
            ? 'new_member'
            : 'subscription_renewal',
        slug,
      }),
    });
  };
}

function ActionButton({
  action,
  onPress,
  inline = false,
}: {
  action: LedgerStatusAction;
  onPress: (action: LedgerStatusAction) => void;
  /** Sized to its label inside the timeline instead of full width. */
  inline?: boolean;
}) {
  const primary = action.emphasis === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={() => onPress(action)}
      className={`h-11 items-center justify-center rounded-full ${inline ? 'mt-3 self-start px-5' : ''} ${
        primary
          ? 'bg-gray-900 active:bg-gray-700'
          : 'bg-white active:bg-gray-100'
      }`}
      style={!primary && inline ? { backgroundColor: '#F4F4F5' } : undefined}
    >
      <Text
        className={`text-[15px] font-semibold ${primary ? 'text-white' : 'text-gray-900'}`}
      >
        {action.label}
      </Text>
    </Pressable>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </Text>
      <Text className="text-[13px] font-semibold text-white">{value}</Text>
    </View>
  );
}

/**
 * Active members carry a membership card that never changes colour, so it
 * reads as identity rather than a warning. What needs doing lives in the
 * band attached to its bottom.
 */
function MemberCard({
  ledger,
  slug,
  history,
}: {
  ledger: MembershipBillingLedger;
  slug: string;
  history: {
    items: LedgerObligation[];
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
  };
}) {
  const historySheetRef = React.useRef<BottomSheetModal>(null);
  const { profile, session } = useAuth();
  const onAction = useLedgerAction(ledger, slug);
  const status = getLedgerStatus(ledger);
  const tone = TONE[status.tone];
  const attention = ledger.attention_obligation;
  const next = ledger.next_contribution;
  const rejectedReason = attention ? getRejectedClaimReason(attention) : null;
  const plan = getPlanLabel(ledger);
  const since = getMemberSince(ledger);
  const name = profile?.name?.trim() || profile?.username || 'Associado';
  const username = profile?.username
    ? `@${profile.username.replace(/^@/, '')}`
    : null;

  return (
    <View className="gap-3">
      <View
        className="overflow-hidden rounded-2xl bg-zinc-900"
        style={{
          borderCurve: 'continuous',
          boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
        }}
      >
        <View
          className="gap-6 p-5"
          style={{
            experimental_backgroundImage:
              'radial-gradient(circle at 0% 0%, rgba(16,185,129,0.45) 0%, rgba(24,24,27,0) 60%)',
          }}
        >
          <Image
            source={SlacCabeMaisImage}
            style={{
              position: 'absolute',
              bottom: -70,
              right: -60,
              width: 220,
              height: 220,
              transform: [{ rotate: '25deg' }],
              opacity: 0.06,
            }}
            contentFit="contain"
          />

          <View className="flex-row items-center justify-between">
            <Text className="text-base font-black tracking-wide text-white">
              {ledger.organization_name}
            </Text>
            <Text className="text-[11px] font-semibold uppercase tracking-[2px] text-zinc-400">
              Carteira de associado
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            <View
              className="size-[52px] overflow-hidden rounded-full"
              style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' }}
            >
              <SupabaseAvatar profileID={session?.user.id} />
            </View>
            <View className="min-w-0 flex-1">
              <Text
                accessibilityRole="header"
                className="text-xl font-bold text-white"
                numberOfLines={1}
              >
                {name}
              </Text>
              {username ? (
                <Text className="text-[13px] text-zinc-400">{username}</Text>
              ) : null}
            </View>
          </View>

          <View className="flex-row gap-6">
            {plan ? <CardField label="Plano" value={plan} /> : null}
            {since ? <CardField label="Desde" value={since} /> : null}
            {!attention && next ? (
              <CardField
                label="Válida até"
                value={formatLedgerShortDate(next.due_on)}
              />
            ) : null}
          </View>
        </View>

        {attention ? (
          <View
            className="gap-3 px-5 py-4"
            style={{ backgroundColor: tone.bg }}
          >
            <View className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1">
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: tone.fg }}
                >
                  {status.headline}
                </Text>
                <Text className="text-[13px] text-gray-600">
                  {getObligationPeriodName(attention)}
                  {attention.status === 'under_review'
                    ? ' · aviso enviado'
                    : ` · vence ${formatLedgerShortDate(attention.due_on)}`}
                </Text>
              </View>
              <Text
                className="text-xl font-bold text-gray-900"
                selectable
                style={tabular}
              >
                {formatLedgerAmount(attention.amount, attention.currency)}
              </Text>
            </View>
            {rejectedReason ? (
              <Text className="text-[13px] leading-[18px] text-amber-800">
                Aviso recusado: {rejectedReason}
              </Text>
            ) : null}
            {status.action ? (
              <ActionButton action={status.action} onPress={onAction} />
            ) : null}
          </View>
        ) : (
          <View className="flex-row items-center gap-2 bg-emerald-50 px-5 py-3">
            <View className="size-2 rounded-full bg-emerald-500" />
            <Text className="flex-1 text-[13px] font-semibold text-emerald-800">
              Em dia
            </Text>
            {next ? (
              <Text className="text-[13px] text-emerald-800" style={tabular}>
                Próxima {formatLedgerShortDate(next.due_on)} ·{' '}
                {formatLedgerAmount(next.amount, next.currency)}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => historySheetRef.current?.present()}
        className="flex-row items-center justify-center gap-0.5 py-1 active:opacity-60"
      >
        <Text className="text-[15px] font-medium text-blue-600">
          Histórico de contribuições
        </Text>
        <ChevronRight color="#2563EB" size={16} />
      </Pressable>

      <ContributionHistorySheet
        ref={historySheetRef}
        history={history.items}
        hasMore={history.hasMore}
        isLoadingMore={history.isLoadingMore}
        onLoadMore={history.onLoadMore}
      />
    </View>
  );
}

type StepState = 'done' | 'current' | 'upcoming';

const RAIL = 28;

function TimelineStep({
  state,
  tone,
  isFirst,
  isLast,
  children,
}: {
  state: StepState;
  tone: LedgerTone;
  isFirst: boolean;
  isLast: boolean;
  children: React.ReactNode;
}) {
  const colors = TONE[tone];
  const dot = state === 'done' ? 16 : state === 'current' ? 14 : 10;

  return (
    <View className="flex-row">
      <View style={{ width: RAIL }} className="items-center">
        <View
          style={{
            width: 2,
            height: 18 - dot / 2,
            backgroundColor: isFirst ? 'transparent' : '#E4E4E7',
          }}
        />
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: dot,
            height: dot,
            backgroundColor: state === 'upcoming' ? '#FFFFFF' : colors.solid,
            borderWidth: state === 'upcoming' ? 2 : 0,
            borderColor: '#D4D4D8',
            boxShadow:
              state === 'current' ? `0 0 0 4px ${colors.bg}` : undefined,
          }}
        >
          {state === 'done' ? (
            <Check color="#FFFFFF" size={10} strokeWidth={3.5} />
          ) : null}
        </View>
        {isLast ? null : (
          <View style={{ width: 2, flex: 1, backgroundColor: '#E4E4E7' }} />
        )}
      </View>
      <View className="min-w-0 flex-1 pb-4 pl-2 pt-2.5">{children}</View>
    </View>
  );
}

/** Applicants follow their admission as a vertical stepper. */
function AdmissionTimeline({
  ledger,
  slug,
}: {
  ledger: MembershipBillingLedger;
  slug: string;
}) {
  const onAction = useLedgerAction(ledger, slug);
  const status = getLedgerStatus(ledger);
  const tone = TONE[status.tone];
  const attention = ledger.attention_obligation;
  const rejectedReason = attention ? getRejectedClaimReason(attention) : null;
  const current = isApplicantWithDraft(ledger)
    ? 0
    : isRefusedApplicant(ledger) || ledger.financial_standing === 'under_review'
      ? 2
      : 1;

  const steps = [
    { title: 'Cadastro', done: 'Candidatura enviada' },
    {
      title: 'Primeira contribuição',
      done: attention
        ? `Aviso de ${formatLedgerAmount(attention.amount, attention.currency)} enviado`
        : 'Pagamento informado',
    },
    { title: 'Conferência da associação', done: 'Aprovada' },
    { title: 'Associado', done: '' },
  ];

  return (
    <View
      className="gap-2 rounded-xl bg-white px-4 pb-2 pt-4"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-center justify-between">
        <Text
          accessibilityRole="header"
          className="text-base font-bold text-gray-900"
        >
          Sua candidatura
        </Text>
        <View
          className="rounded-full px-2.5 py-1"
          style={{ backgroundColor: tone.bg }}
        >
          <Text className="text-xs font-semibold" style={{ color: tone.fg }}>
            {TONE_LABEL[status.tone]}
          </Text>
        </View>
      </View>

      <View>
        {steps.map((step, index) => {
          const state: StepState =
            index < current
              ? 'done'
              : index === current
                ? 'current'
                : 'upcoming';

          return (
            <TimelineStep
              key={step.title}
              state={state}
              tone={
                state === 'done'
                  ? 'ok'
                  : state === 'current'
                    ? status.tone
                    : 'neutral'
              }
              isFirst={index === 0}
              isLast={index === steps.length - 1}
            >
              <Text
                className={
                  state === 'current'
                    ? 'text-lg font-bold text-gray-900'
                    : state === 'upcoming'
                      ? 'text-[15px] text-gray-400'
                      : 'text-[15px] text-gray-900'
                }
              >
                {state === 'current' ? status.headline : step.title}
              </Text>
              {state === 'done' && step.done ? (
                <Text className="text-[13px] text-gray-500">{step.done}</Text>
              ) : null}
              {state === 'current' ? (
                <>
                  {attention && attention.status !== 'under_review' ? (
                    <Text
                      className="mt-0.5 text-2xl font-bold text-gray-900"
                      selectable
                      style={tabular}
                    >
                      {formatLedgerAmount(attention.amount, attention.currency)}
                    </Text>
                  ) : null}
                  <Text className="mt-0.5 text-[15px] leading-5 text-gray-600">
                    {status.body}
                  </Text>
                  {rejectedReason ? (
                    <Text className="mt-1 text-[13px] leading-[18px] text-amber-700">
                      Aviso recusado: {rejectedReason}
                    </Text>
                  ) : null}
                  {status.action ? (
                    <ActionButton
                      action={status.action}
                      onPress={onAction}
                      inline
                    />
                  ) : null}
                </>
              ) : null}
            </TimelineStep>
          );
        })}
      </View>
    </View>
  );
}

function useMembershipLedgerQuery(organizationId: string | undefined) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useInfiniteQuery({
    // Disabled until the organization resolves, so the empty key never fetches.
    queryKey: queryKeys.membershipBilling.byOrg(organizationId ?? '', userId),
    queryFn: ({ pageParam }) =>
      fetchMembershipBillingLedger(organizationId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage?.history_has_more ? lastPage.history_next_cursor : null,
    enabled: Boolean(userId && organizationId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
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
  const ledgerQuery = useMembershipLedgerQuery(organizationId);

  useFocusEffect(
    React.useCallback(() => {
      if (!userId) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.membershipBilling.byOrg(organizationId, userId),
      });
    }, [organizationId, queryClient, userId]),
  );

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

  return ledger.legal_membership_state === 'active' ? (
    <MemberCard
      ledger={ledger}
      slug={slug}
      history={{
        items: pages.flatMap((page) => page?.history ?? []),
        hasMore: ledgerQuery.hasNextPage,
        isLoadingMore: ledgerQuery.isFetchingNextPage,
        onLoadMore: () => void ledgerQuery.fetchNextPage(),
      }}
    />
  ) : (
    <AdmissionTimeline ledger={ledger} slug={slug} />
  );
}
