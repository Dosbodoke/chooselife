import type { FestivalScheduleSlotView } from '@chooselife/ui';
import { cva } from 'class-variance-authority';
import type { TFunction } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useI18n } from '~/context/i18n';
import { cn } from '~/lib/utils';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

const slotRowVariants = cva('gap-3 rounded-2xl border px-4 py-4', {
  variants: {
    tone: {
      current: 'border-emerald-200 bg-emerald-50',
      past: 'border-dashed border-slate-300 bg-slate-50',
      available: 'border-emerald-300 bg-emerald-50/50',
      blocked: 'border-amber-200 bg-amber-50',
      default: 'border-slate-200 bg-white',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

const slotTimeVariants = cva('text-sm font-semibold uppercase tracking-[1px]', {
  variants: {
    tone: {
      default: 'text-slate-500',
      muted: 'text-slate-400',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

const slotTitleVariants = cva('text-base font-semibold', {
  variants: {
    tone: {
      default: 'text-slate-900',
      muted: 'text-slate-500',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

const slotSubtitleVariants = cva('text-sm', {
  variants: {
    tone: {
      default: 'text-slate-500',
      muted: 'text-slate-400',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

const slotBadgeVariants = cva('rounded-full px-2 py-1', {
  variants: {
    tone: {
      default: 'bg-slate-100',
      available: 'bg-emerald-100',
      past: 'bg-slate-200',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

const slotBadgeTextVariants = cva(
  'text-[11px] font-semibold uppercase tracking-[0.8px]',
  {
    variants: {
      tone: {
        default: 'text-slate-500',
        available: 'text-emerald-700',
        past: 'text-slate-400',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  },
);

const cancelButtonTextVariants = cva('font-semibold', {
  variants: {
    tone: {
      viewer: 'text-white',
      staff: 'text-red-600',
    },
  },
  defaultVariants: {
    tone: 'staff',
  },
});

type FestivalScheduleSlotRowProps = {
  canManage: boolean;
  festivalTimeZone: string;
  isAuthenticated: boolean;
  isOnline: boolean;
  onCancelBooking: (slot: FestivalScheduleSlotView) => void;
  onSelfBook: (slotId: string) => void;
  onStaffBook: (slotId: string) => void;
  slot: FestivalScheduleSlotView;
};

function formatSlotTimeRange(
  slot: FestivalScheduleSlotView,
  locale: string,
  timeZone: string,
) {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });

  return `${formatter.format(new Date(slot.startAt))} - ${formatter.format(
    new Date(slot.endAt),
  )}`;
}

function isPastSlot(slot: FestivalScheduleSlotView) {
  return !slot.isCurrent && new Date(slot.endAt).getTime() <= Date.now();
}

function getSlotStatusLabel(slot: FestivalScheduleSlotView, t: TFunction) {
  if (slot.isCurrent) {
    return t('app.(festival).highlines.currentLabel');
  }

  switch (slot.state) {
    case 'available':
      return t('app.(festival).highlines.availableState');
    case 'booked':
      return t('app.(festival).highlines.bookedState');
    case 'completed':
      return t('app.(festival).highlines.completedLabel');
    case 'blocked':
      return t('app.(festival).highlines.blockedTitle');
    default:
      return t('app.(festival).highlines.expiredLabel');
  }
}

function getSlotRowTone(slot: FestivalScheduleSlotView) {
  if (slot.isCurrent) {
    return 'current' as const;
  }

  if (isPastSlot(slot)) {
    return 'past' as const;
  }

  switch (slot.state) {
    case 'available':
      return 'available' as const;
    case 'blocked':
      return 'blocked' as const;
    default:
      return 'default' as const;
  }
}

function getSlotBadgeTone(slot: FestivalScheduleSlotView) {
  if (isPastSlot(slot)) {
    return 'past' as const;
  }

  if (slot.state === 'available') {
    return 'available' as const;
  }

  return 'default' as const;
}

function getDisabledSelfBookingLabel(
  slot: FestivalScheduleSlotView,
  t: TFunction,
) {
  switch (slot.bookingBlockedReason) {
    case 'overlap':
      return t('app.(festival).highlines.claimSlotBlockedOverlap');
    case 'limit':
      return t('app.(festival).highlines.claimSlotBlockedLimit');
    default:
      return null;
  }
}

export const FestivalScheduleSlotRow: React.FC<
  FestivalScheduleSlotRowProps
> = ({
  canManage,
  festivalTimeZone,
  isAuthenticated,
  isOnline,
  onCancelBooking,
  onSelfBook,
  onStaffBook,
  slot,
}) => {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const pastSlot = isPastSlot(slot);
  const title = slot.booking?.participant.primaryText ?? null;
  const subtitle =
    slot.state === 'blocked'
      ? slot.blockReason
      : (slot.booking?.participant.secondaryText ?? null);
  const disabledSelfBookingLabel = getDisabledSelfBookingLabel(slot, t);
  const slotStatusLabel = getSlotStatusLabel(slot, t);
  const rowTone = getSlotRowTone(slot);
  const badgeTone = getSlotBadgeTone(slot);
  const textTone = pastSlot ? 'muted' : 'default';
  const isViewerBooking = !!slot.booking?.isViewer;

  let cancelButtonVariant: 'destructive' | 'secondary' = 'secondary';
  let cancelButtonTextTone: 'viewer' | 'staff' = 'staff';
  let cancelButtonLabel = t('app.(festival).highlines.cancelBookingButton');
  let cancelButtonClassName = 'rounded-xl bg-red-50';

  if (isViewerBooking) {
    cancelButtonVariant = 'destructive';
    cancelButtonTextTone = 'viewer';
    cancelButtonLabel = t('app.(festival).highlines.cancelOwnBookingButton');
    cancelButtonClassName = 'rounded-xl';
  }

  return (
    <View className={cn(slotRowVariants({ tone: rowTone }))}>
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text className={cn(slotTimeVariants({ tone: textTone }))}>
            {formatSlotTimeRange(slot, locale, festivalTimeZone)}
          </Text>
          {title ? (
            <Text className={cn(slotTitleVariants({ tone: textTone }))}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text className={cn(slotSubtitleVariants({ tone: textTone }))}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View className={cn(slotBadgeVariants({ tone: badgeTone }))}>
          <Text className={cn(slotBadgeTextVariants({ tone: badgeTone }))}>
            {slotStatusLabel}
          </Text>
        </View>
      </View>

      {slot.state === 'available' && isAuthenticated && isOnline ? (
        <View className="gap-2">
          {slot.bookingBlockedReason === null ? (
            <Button
              className="w-full rounded-xl bg-[#101b2b]"
              onPress={() => onSelfBook(slot.id)}
            >
              <Text className="font-semibold text-white">
                {canManage
                  ? t('app.(festival).highlines.claimSlotForMeButton')
                  : t('app.(festival).highlines.claimSlotButton')}
              </Text>
            </Button>
          ) : disabledSelfBookingLabel ? (
            <View className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <Text className="text-center text-sm font-semibold text-red-700">
                {disabledSelfBookingLabel}
              </Text>
            </View>
          ) : null}

          {canManage ? (
            <Button
              className="w-full rounded-xl"
              variant="secondary"
              onPress={() => onStaffBook(slot.id)}
            >
              <Text className="font-semibold text-slate-900">
                {t('app.(festival).highlines.bookForSomeoneButton')}
              </Text>
            </Button>
          ) : null}
        </View>
      ) : null}

      {slot.booking &&
      (slot.booking.isViewer || canManage) &&
      isOnline &&
      slot.state === 'booked' ? (
        <Button
          className={cancelButtonClassName}
          variant={cancelButtonVariant}
          onPress={() => onCancelBooking(slot)}
        >
          <Text
            className={cn(
              cancelButtonTextVariants({ tone: cancelButtonTextTone }),
            )}
          >
            {cancelButtonLabel}
          </Text>
        </Button>
      ) : null}
    </View>
  );
};
