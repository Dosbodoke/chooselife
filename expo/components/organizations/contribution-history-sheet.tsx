import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  useBottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LedgerObligation } from '~/lib/membership-ledger';
import {
  formatLedgerAmount,
  getHistoryCountLabel,
  getObligationMeta,
  getObligationPeriodName,
  getObligationStatusLabel,
  getRejectedClaimReason,
} from '~/lib/membership-ledger-copy';

import { Text } from '~/components/ui/text';

const STATUS_STYLE: Record<
  LedgerObligation['status'],
  { icon: LucideIcon; fg: string; bg: string }
> = {
  settled: { icon: CheckCircle2, fg: '#047857', bg: '#ECFDF5' },
  under_review: { icon: Clock3, fg: '#6D28D9', bg: '#F5F3FF' },
  overdue: { icon: AlertCircle, fg: '#B45309', bg: '#FFFBEB' },
  available: { icon: CalendarDays, fg: '#1D4ED8', bg: '#EFF6FF' },
  scheduled: { icon: CalendarDays, fg: '#52525B', bg: '#F4F4F5' },
  void: { icon: XCircle, fg: '#71717A', bg: '#F4F4F5' },
};

/** Newest first, grouped by the year each period falls in. */
function groupByYear(history: LedgerObligation[]) {
  const groups: { year: string; items: LedgerObligation[] }[] = [];
  for (const item of history) {
    const year = (item.period_start || item.due_on).slice(0, 4);
    const group = groups[groups.length - 1];
    if (group?.year === year) group.items.push(item);
    else groups.push({ year, items: [item] });
  }
  return groups;
}

function ContributionRow({
  obligation,
  isLast,
}: {
  obligation: LedgerObligation;
  isLast: boolean;
}) {
  const style = STATUS_STYLE[obligation.status] ?? STATUS_STYLE.scheduled;
  const StatusIcon = style.icon;
  const rejectedReason = getRejectedClaimReason(obligation);

  return (
    <View className="flex-row items-center gap-3 pl-4">
      <View
        className="size-9 items-center justify-center rounded-full"
        style={{ backgroundColor: style.bg }}
      >
        <StatusIcon color={style.fg} size={18} />
      </View>
      <View
        className={`flex-1 flex-row items-center gap-3 py-3 pr-4 ${isLast ? '' : 'border-b border-gray-100'}`}
      >
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-[15px] font-semibold text-gray-900">
            {getObligationPeriodName(obligation)}
          </Text>
          <Text className="text-[13px] leading-[18px] text-gray-500">
            {getObligationMeta(obligation)}
          </Text>
          {rejectedReason ? (
            <Text className="text-[13px] leading-[18px] text-amber-700">
              Motivo: {rejectedReason}
            </Text>
          ) : null}
        </View>
        <View className="items-end gap-0.5">
          <Text
            className="text-[15px] font-semibold text-gray-900"
            selectable
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatLedgerAmount(obligation.amount, obligation.currency)}
          </Text>
          <Text className="text-xs font-medium" style={{ color: style.fg }}>
            {getObligationStatusLabel(obligation.status)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function ContributionHistorySheet({
  ref,
  history,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  ref: React.Ref<BottomSheetModal>;
  history: LedgerObligation[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  const { top, bottom } = useSafeAreaInsets();
  const countLabel = getHistoryCountLabel(history.length, hasMore);
  const groups = groupByYear(history);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const { dismiss } = useBottomSheetModal();

  return (
    <BottomSheetModal
      ref={ref}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      topInset={top + 16}
      backgroundStyle={{ backgroundColor: '#F3F4F6' }}
      handleIndicatorStyle={{ backgroundColor: '#94a3b8' }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          gap: 16,
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: bottom + 16,
        }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text
              accessibilityRole="header"
              className="text-2xl font-bold text-gray-900"
            >
              Contribuições
            </Text>
            {countLabel ? (
              <Text className="text-[13px] text-gray-500">{countLabel}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={() => dismiss()}
            hitSlop={8}
            className="size-8 items-center justify-center rounded-full bg-gray-200 active:bg-gray-300"
          >
            <X color="#52525B" size={18} strokeWidth={2.4} />
          </Pressable>
        </View>

        {groups.length === 0 ? (
          <View
            className="items-center gap-2 rounded-xl bg-white px-6 py-8"
            style={{ borderCurve: 'continuous' }}
          >
            <CalendarDays color="#A1A1AA" size={28} />
            <Text className="text-center text-[15px] text-gray-500">
              Ainda não há contribuições registradas.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.year} className="gap-2">
              <Text className="ml-1 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
                {group.year}
              </Text>
              <View
                className="overflow-hidden rounded-xl bg-white"
                style={{ borderCurve: 'continuous' }}
              >
                {group.items.map((item, index) => (
                  <ContributionRow
                    key={
                      item.obligation_id ?? `${item.period_key}:${item.due_on}`
                    }
                    obligation={item}
                    isLast={index === group.items.length - 1}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        {hasMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver contribuições anteriores"
            disabled={isLoadingMore}
            onPress={onLoadMore}
            className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-white active:bg-gray-50"
          >
            {isLoadingMore ? (
              <ActivityIndicator color="#18181B" size="small" />
            ) : (
              <ChevronDown color="#2563EB" size={16} strokeWidth={2.4} />
            )}
            <Text className="text-[15px] font-medium text-blue-600">
              {isLoadingMore ? 'Carregando...' : 'Ver contribuições anteriores'}
            </Text>
          </Pressable>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
