import {
  formatBookingDayLabel,
  formatBookingOpensAt,
  getSectorKey,
  type FestivalHighlineScheduleCard,
  type FestivalScheduleSectorGroup,
  type FestivalScheduleSlotView,
  type ViewerFestivalBooking,
} from '@chooselife/ui';
import { useRouter } from 'expo-router';
import {
  CalendarCheckIcon,
  ChevronRightIcon,
  MegaphoneIcon,
  UsersIcon,
} from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';

import { useI18n } from '~/context/i18n';
import type { Highline } from '~/hooks/use-highline';

import { HighlineCard } from '~/components/highline/highline-card';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

type FestivalSectorGroup = FestivalScheduleSectorGroup;

const CARD_GAP = 16;
const CONTENT_SIDE_PADDING = 16;
const CARD_SIDE_PEEK = 48;
const MAX_CARD_WIDTH = 340;

function formatBookingTimeRange(
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

type FestivalSchedulePreview = {
  actionLabel: string;
  detail: string | null;
  eyebrow: string;
  tone: 'current' | 'empty' | 'upcoming';
  title: string;
};

function getFestivalSchedulePreview({
  card,
  festivalTimeZone,
  locale,
  t,
}: {
  card: FestivalHighlineScheduleCard;
  festivalTimeZone: string;
  locale: string;
  t: ReturnType<typeof useTranslation>['t'];
}): FestivalSchedulePreview {
  const day = card.defaultDay;

  if (!day) {
    return {
      actionLabel: t('app.(festival).highlines.previewViewDetails'),
      detail: t('app.(festival).highlines.previewNoScheduleDetail'),
      eyebrow: t('app.(festival).highlines.previewNoScheduleLabel'),
      tone: 'empty',
      title: t('app.(festival).highlines.previewNoScheduleTitle'),
    };
  }

  if (day.isCurrentDay) {
    const hasAvailableSlots = day.availableCount > 0;

    return {
      actionLabel: hasAvailableSlots
        ? t('app.(festival).highlines.previewViewSchedule')
        : t('app.(festival).highlines.previewViewDetails'),
      detail: hasAvailableSlots
        ? t('app.(festival).highlines.previewCurrentAvailableDetail')
        : t('app.(festival).highlines.previewCurrentUnavailableDetail'),
      eyebrow: t('app.(festival).highlines.previewTodayLabel'),
      tone: 'current',
      title: hasAvailableSlots
        ? t('app.(festival).highlines.previewCurrentAvailableTitle', {
            count: day.availableCount,
          })
        : t('app.(festival).highlines.previewCurrentUnavailableTitle'),
    };
  }

  const dayLabel = formatBookingDayLabel(day.dateKey, locale, festivalTimeZone);
  const bookingOpensAtLabel = card.bookingOpensAt
    ? formatBookingOpensAt(card.bookingOpensAt, locale, festivalTimeZone)
    : null;

  if (!day.isBookingOpen && bookingOpensAtLabel) {
    return {
      actionLabel: t('app.(festival).highlines.previewViewSchedule'),
      detail:
        day.preOpenAvailableCount > 0
          ? t('app.(festival).highlines.previewUpcomingPlannedDetail', {
              count: day.preOpenAvailableCount,
              day: dayLabel,
            })
          : t('app.(festival).highlines.previewUpcomingDetail', {
              day: dayLabel,
            }),
      eyebrow: t('app.(festival).highlines.previewUpcomingLabel'),
      tone: 'upcoming',
      title: t('app.(festival).highlines.previewUpcomingOpensTitle', {
        dateTime: bookingOpensAtLabel,
      }),
    };
  }

  return {
    actionLabel:
      day.availableCount > 0
        ? t('app.(festival).highlines.previewViewSchedule')
        : t('app.(festival).highlines.previewViewDetails'),
    detail:
      day.availableCount > 0
        ? t('app.(festival).highlines.previewUpcomingAvailableDetail', {
            count: day.availableCount,
          })
        : t('app.(festival).highlines.previewUpcomingUnavailableDetail'),
    eyebrow: t('app.(festival).highlines.previewUpcomingLabel'),
    tone: 'upcoming',
    title: t('app.(festival).highlines.previewUpcomingDayTitle', {
      day: dayLabel,
    }),
  };
}

function FestivalSchedulePreview({
  card,
  festivalTimeZone,
}: {
  card: FestivalHighlineScheduleCard;
  festivalTimeZone: string;
}) {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const preview = getFestivalSchedulePreview({
    card,
    festivalTimeZone,
    locale,
    t,
  });
  const featuredLabel = card.featuredSlot?.booking
    ? t('app.(festival).highlines.previewNowWalking', {
        name: card.featuredSlot.booking.participant.primaryText,
      })
    : null;
  const toneClassName = {
    current: 'text-emerald-700',
    empty: 'text-slate-500',
    upcoming: 'text-amber-700',
  }[preview.tone];

  return (
    <View className="gap-3 px-1 pt-0.5">
      <View className="gap-1">
        <View className="flex-row items-center gap-1.5">
          <Icon as={UsersIcon} className={`size-3.5 ${toneClassName}`} />
          <Text
            className={`text-xs font-bold uppercase tracking-[0.8px] ${toneClassName}`}
            numberOfLines={1}
          >
            {preview.eyebrow}
          </Text>
        </View>

        <Text
          className="text-base font-bold leading-5 text-slate-950"
          numberOfLines={2}
        >
          {preview.title}
        </Text>

        {preview.detail ? (
          <Text className="text-sm leading-5 text-slate-500" numberOfLines={2}>
            {preview.detail}
          </Text>
        ) : null}

        {featuredLabel ? (
          <View className="flex-row items-center gap-1.5 pt-0.5">
            <Icon as={MegaphoneIcon} className="size-3.5 text-green-600" />
            <Text
              className="flex-1 text-sm font-semibold text-green-600"
              numberOfLines={1}
            >
              {featuredLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="self-start flex-row items-center gap-1 rounded-full bg-[#101b2b] px-3.5 py-2">
        <Text className="text-sm font-semibold text-white">
          {preview.actionLabel}
        </Text>
        <Icon as={ChevronRightIcon} className="size-3.5 text-white" />
      </View>
    </View>
  );
}

export const FestivalHighlineCardView: React.FC<{
  card: FestivalHighlineScheduleCard;
  festivalTimeZone: string;
  onPress: () => void;
}> = ({ card, festivalTimeZone, onPress }) => {
  return (
    <Pressable className="gap-3" onPress={onPress}>
      <HighlineCard
        item={card.highline as Highline}
        className="mb-0 h-48"
        showStatus={false}
      />

      <FestivalSchedulePreview
        card={card}
        festivalTimeZone={festivalTimeZone}
      />
    </Pressable>
  );
};

export function FestivalLoadingState() {
  const { t } = useTranslation();

  return (
    <View className="mx-4 items-center gap-4 rounded-[28px] bg-white px-6 py-12">
      <ActivityIndicator size="large" color="#0f172a" />
      <Text className="text-base text-slate-500">
        {t('app.(festival).highlines.loading')}
      </Text>
    </View>
  );
}

export function FestivalEmptyState() {
  const { t } = useTranslation();

  return (
    <View className="mx-4 rounded-[28px] bg-white px-6 py-12">
      <Text className="text-center text-base leading-7 text-slate-500">
        {t('app.(festival).highlines.empty')}
      </Text>
    </View>
  );
}

export function FestivalErrorState({ isOffline }: { isOffline: boolean }) {
  const { t } = useTranslation();

  const message = React.useMemo(() => {
    if (isOffline) {
      return t('app.(festival).highlines.offlineCacheEmpty');
    }

    return t('app.(festival).highlines.genericError');
  }, [isOffline, t]);

  return (
    <View className="mx-4 rounded-[28px] bg-white px-6 py-12">
      <Text className="text-center text-base leading-7 text-slate-500">
        {message}
      </Text>
    </View>
  );
}

function FestivalSectorDescription({
  description,
}: {
  description?: string | null;
}) {
  if (!description) {
    return null;
  }

  return (
    <Text className="text-sm leading-6 text-slate-500">{description}</Text>
  );
}

function FestivalSectorHeader({ group }: { group: FestivalSectorGroup }) {
  return (
    <View className="gap-1">
      {group.sector?.name ? (
        <Text className="text-2xl font-bold text-slate-950">
          {group.sector.name}
        </Text>
      ) : null}

      <FestivalSectorDescription description={group.sector?.description} />
    </View>
  );
}

function FestivalHighlineCardList({
  cards,
  festivalTimeZone,
  onOpenSchedule,
}: {
  cards: FestivalHighlineScheduleCard[];
  festivalTimeZone: string;
  onOpenSchedule: (card: FestivalHighlineScheduleCard) => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(MAX_CARD_WIDTH, width - CARD_SIDE_PEEK);

  return (
    <ScrollView
      horizontal
      directionalLockEnabled
      nestedScrollEnabled
      decelerationRate="fast"
      disableIntervalMomentum
      snapToInterval={cardWidth + CARD_GAP}
      showsHorizontalScrollIndicator={false}
      scrollEnabled={cards.length > 1}
      contentContainerStyle={{
        gap: CARD_GAP,
        paddingLeft: CONTENT_SIDE_PADDING,
        paddingRight:
          CONTENT_SIDE_PADDING + (cards.length > 1 ? CARD_SIDE_PEEK / 2 : 0),
      }}
    >
      {cards.map((card) => (
        <View key={card.highline.id} style={{ width: cardWidth }}>
          <FestivalHighlineCardView
            card={card}
            festivalTimeZone={festivalTimeZone}
            onPress={() => onOpenSchedule(card)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function FestivalSector({
  group,
  festivalTimeZone,
  onOpenSchedule,
}: {
  group: FestivalSectorGroup;
  festivalTimeZone: string;
  onOpenSchedule: (card: FestivalHighlineScheduleCard) => void;
}) {
  return (
    <View className="gap-4">
      <View className="px-4">
        <FestivalSectorHeader group={group} />
      </View>

      <FestivalHighlineCardList
        cards={group.cards}
        festivalTimeZone={festivalTimeZone}
        onOpenSchedule={onOpenSchedule}
      />
    </View>
  );
}

export function FestivalSectorList({
  sectors,
  festivalTimeZone,
  onOpenSchedule,
}: {
  sectors: FestivalSectorGroup[];
  festivalTimeZone: string;
  onOpenSchedule: (card: FestivalHighlineScheduleCard) => void;
}) {
  return (
    <View className="gap-8">
      {sectors.map((group) => (
        <FestivalSector
          key={getSectorKey(group)}
          group={group}
          festivalTimeZone={festivalTimeZone}
          onOpenSchedule={onOpenSchedule}
        />
      ))}
    </View>
  );
}

export function ViewerScheduleSummary({
  bookingLimit,
  bookings,
  festivalTimeZone,
  hasAccount,
  isOffline,
  onOpenSchedule,
}: {
  bookingLimit?: number | null;
  bookings: ViewerFestivalBooking[];
  festivalTimeZone: string;
  hasAccount: boolean;
  isOffline: boolean;
  onOpenSchedule: (card: FestivalHighlineScheduleCard, dayKey: string) => void;
}) {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const router = useRouter();
  const emptyStateKey = isOffline
    ? 'offline'
    : hasAccount
      ? 'default'
      : 'guest';
  const descriptionKey =
    emptyStateKey === 'offline'
      ? 'app.(festival).highlines.viewerScheduleOfflineDescription'
      : emptyStateKey === 'guest'
        ? 'app.(festival).highlines.viewerScheduleGuestDescription'
        : 'app.(festival).highlines.viewerScheduleDescription';
  const placeholderLabelKey =
    emptyStateKey === 'offline'
      ? 'app.(festival).highlines.viewerScheduleOfflinePlaceholderLabel'
      : emptyStateKey === 'guest'
        ? 'app.(festival).highlines.viewerScheduleGuestPlaceholderLabel'
        : 'app.(festival).highlines.viewerSchedulePlaceholderLabel';
  const placeholderTitleKey =
    emptyStateKey === 'offline'
      ? 'app.(festival).highlines.viewerScheduleOfflinePlaceholderTitle'
      : emptyStateKey === 'guest'
        ? 'app.(festival).highlines.viewerScheduleGuestPlaceholderTitle'
        : 'app.(festival).highlines.viewerSchedulePlaceholderTitle';
  const summarySlots = Array.from(
    {
      length: bookingLimit
        ? Math.max(bookingLimit, bookings.length)
        : bookings.length,
    },
    (_, index) => ({
      booking: bookings[index] ?? null,
      key: bookings[index]?.slot.id ?? `placeholder-${index}`,
    }),
  );
  const shouldShowEmptyCta =
    emptyStateKey !== 'default' && bookings.length < summarySlots.length;

  const handleLoginPress = React.useCallback(() => {
    router.push('/(modals)/login');
  }, [router]);

  return (
    <View className="mx-4 gap-4 rounded-[28px] border border-slate-200 bg-white p-4">
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <View className="rounded-full bg-emerald-100 p-2">
            <Icon as={CalendarCheckIcon} className="size-4 text-emerald-700" />
          </View>
          <Text className="text-lg font-bold text-slate-950">
            {t('app.(festival).highlines.viewerScheduleTitle')}
          </Text>
        </View>

        <Text className="text-sm leading-5 text-slate-500">
          {t(descriptionKey, { count: bookingLimit })}
        </Text>
      </View>

      <View className="gap-2">
        {summarySlots.map(({ booking, key }) => {
          if (!booking) {
            if (emptyStateKey !== 'default') {
              return null;
            }

            return (
              <View
                key={key}
                className="gap-1 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3"
              >
                <Text className="text-sm font-semibold uppercase tracking-[0.8px] text-slate-400">
                  {t(placeholderLabelKey)}
                </Text>
                <Text className="text-base font-semibold text-slate-500">
                  {t(placeholderTitleKey)}
                </Text>
              </View>
            );
          }

          const { card, dayKey, slot } = booking;

          return (
            <Pressable
              key={key}
              className="flex-row items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"
              onPress={() => onOpenSchedule(card, dayKey)}
            >
              <View className="flex-1 gap-1">
                <Text className="text-sm font-semibold uppercase tracking-[0.8px] text-slate-500">
                  {formatBookingDayLabel(dayKey, locale, festivalTimeZone)} -{' '}
                  {formatBookingTimeRange(slot, locale, festivalTimeZone)}
                </Text>
                <Text
                  className="text-base font-semibold text-slate-950"
                  numberOfLines={1}
                >
                  {card.highline.name}
                </Text>
              </View>

              <Icon as={ChevronRightIcon} className="size-4 text-slate-400" />
            </Pressable>
          );
        })}

        {shouldShowEmptyCta ? (
          <Button
            className="w-full rounded-xl bg-[#101b2b]"
            onPress={handleLoginPress}
          >
            <Text className="font-semibold text-white">
              {t('app.(modals).login.EmailSection.loginButton')}
            </Text>
          </Button>
        ) : null}
      </View>
    </View>
  );
}
