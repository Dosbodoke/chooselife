import {
  formatBookingDayLabel,
  formatBookingOpensAt,
  getSectorKey,
  getSectorName,
  getViewerFestivalBookings,
  type FestivalHighlineScheduleCard,
  type FestivalScheduleSectorGroup,
  type FestivalScheduleSlotView,
  type useFestivalSchedule,
  type ViewerFestivalBooking,
} from '@chooselife/ui';
import { useRouter } from 'expo-router';
import {
  CalendarCheckIcon,
  ChevronRightIcon,
  MegaphoneIcon,
  MoveHorizontalIcon,
  MoveVerticalIcon,
  UsersIcon,
} from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useI18n } from '~/context/i18n';

import { HighlineImage } from '~/components/highline/highline-image';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

type FestivalScheduleQuery = ReturnType<typeof useFestivalSchedule>;
type FestivalSectorGroup = FestivalScheduleSectorGroup;

const StatPill: React.FC<{
  icon: React.ComponentProps<typeof Icon>['as'];
  value: string;
}> = ({ icon, value }) => (
  <View className="flex-row items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
    <Icon as={icon} className="size-3 text-white" />
    <Text className="text-xs font-semibold text-white">{value}</Text>
  </View>
);

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

export const FestivalHighlineCardView: React.FC<{
  card: FestivalHighlineScheduleCard;
  festivalTimeZone: string;
  onPress: () => void;
}> = ({ card, festivalTimeZone, onPress }) => {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const featuredLabel = card.featuredSlot
    ? new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: festivalTimeZone,
      }).format(new Date(card.featuredSlot.startAt))
    : null;
  const bookingOpensAtLabel = card.bookingOpensAt
    ? formatBookingOpensAt(card.bookingOpensAt, locale, festivalTimeZone)
    : null;

  return (
    <Pressable
      className="overflow-hidden rounded-[28px] border border-black/5 bg-white"
      onPress={onPress}
    >
      <View className="relative h-52 overflow-hidden">
        <HighlineImage
          coverImageId={card.highline.cover_image}
          className="h-full w-full"
        />

        <View
          className="absolute inset-0"
          style={{
            backgroundColor: 'rgba(4, 8, 15, 0.18)',
          }}
        />
        <View
          className="absolute bottom-0 left-0 right-0 h-36"
          style={{
            experimental_backgroundImage:
              'linear-gradient(to top, rgba(7,15,26,0.95) 0%, rgba(7,15,26,0.65) 58%, rgba(7,15,26,0) 100%)',
          }}
        />

        <View className="absolute bottom-0 left-0 right-0 gap-3 p-4">
          <View>
            <Text
              className="text-2xl font-extrabold text-white"
              numberOfLines={2}
            >
              {card.highline.name}
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <StatPill
              icon={MoveVerticalIcon}
              value={`${card.highline.height}m`}
            />
            <StatPill
              icon={MoveHorizontalIcon}
              value={`${card.highline.length}m`}
            />
          </View>
        </View>
      </View>

      <View className="gap-4 bg-white p-4">
        <View className="gap-2">
          <View className="flex flex-row gap-2 items-center">
            <Icon as={UsersIcon} className="size-3 text-black" />
            <Text
              className={`font-semibold uppercase tracking-[1px] ${
                card.isBookingOpen ? 'text-slate-500' : 'text-amber-700'
              }`}
            >
              {card.isBookingOpen
                ? t('app.(festival).highlines.availableCount', {
                    count: card.availableCount,
                  })
                : t('app.(festival).highlines.preOpenAvailableCount', {
                    count: card.preOpenAvailableCount,
                  })}
            </Text>
          </View>

          {!card.isBookingOpen && bookingOpensAtLabel ? (
            <Text className="text-sm font-medium text-amber-700">
              {t('app.(festival).highlines.bookingOpensAtSummary', {
                dateTime: bookingOpensAtLabel,
              })}
            </Text>
          ) : null}

          {card.featuredSlot?.booking ? (
            <View className="max-w-[56%] flex-row items-center gap-1.5">
              <Icon as={MegaphoneIcon} className="size-3 text-green-500" />
              <Text className="font-semibold text-green-500" numberOfLines={1}>
                {card.featuredSlot.isCurrent
                  ? t('app.(festival).highlines.currentLabel')
                  : featuredLabel}
                : {card.featuredSlot.booking.participant.primaryText}
              </Text>
            </View>
          ) : null}
        </View>

        <Button
          className="h-12 w-full flex-row items-center justify-between rounded-2xl bg-[#101b2b] px-4"
          onPress={onPress}
        >
          <Text className="font-semibold text-white">
            {t('app.(festival).highlines.openScheduleButton')}
          </Text>
          <Icon as={ChevronRightIcon} className="size-4 text-white" />
        </Button>
      </View>
    </Pressable>
  );
};

function FestivalLoadingState() {
  const { t } = useTranslation();

  return (
    <View className="items-center gap-4 rounded-[28px] bg-white px-6 py-12">
      <ActivityIndicator size="large" color="#0f172a" />
      <Text className="text-base text-slate-500">
        {t('app.(festival).highlines.loading')}
      </Text>
    </View>
  );
}

function FestivalEmptyState() {
  const { t } = useTranslation();

  return (
    <View className="rounded-[28px] bg-white px-6 py-12">
      <Text className="text-center text-base leading-7 text-slate-500">
        {t('app.(festival).highlines.empty')}
      </Text>
    </View>
  );
}

function FestivalErrorState({ isOffline }: { isOffline: boolean }) {
  const { t } = useTranslation();

  const message = React.useMemo(() => {
    if (isOffline) {
      return t('app.(festival).highlines.offlineCacheEmpty');
    }

    return t('app.(festival).highlines.genericError');
  }, [isOffline, t]);

  return (
    <View className="rounded-[28px] bg-white px-6 py-12">
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
  const { t } = useTranslation();

  return (
    <View className="gap-1">
      <Text className="text-2xl font-bold text-slate-950">
        {getSectorName(group, t('app.(festival).highlines.sectorFallback'))}
      </Text>

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
  return (
    <View className="gap-5">
      {cards.map((card) => (
        <FestivalHighlineCardView
          key={card.highline.id}
          card={card}
          festivalTimeZone={festivalTimeZone}
          onPress={() => onOpenSchedule(card)}
        />
      ))}
    </View>
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
      <FestivalSectorHeader group={group} />

      <FestivalHighlineCardList
        cards={group.cards}
        festivalTimeZone={festivalTimeZone}
        onOpenSchedule={onOpenSchedule}
      />
    </View>
  );
}

function FestivalSectorList({
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

function ViewerScheduleSummary({
  bookings,
  festivalTimeZone,
  hasAccount,
  isOffline,
  onOpenSchedule,
}: {
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
  const summarySlots = Array.from({ length: 2 }, (_, index) => ({
    booking: bookings[index] ?? null,
    key: bookings[index]?.slot.id ?? `placeholder-${index}`,
  }));
  const shouldShowEmptyCta =
    emptyStateKey !== 'default' && bookings.length < summarySlots.length;

  const handleLoginPress = React.useCallback(() => {
    router.push('/(modals)/login');
  }, [router]);

  return (
    <View className="gap-4 rounded-[28px] border border-slate-200 bg-white p-4">
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
          {t(descriptionKey)}
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

export function FestivalContent({
  query,
  isOffline,
  festivalTimeZone,
  onOpenSchedule,
}: {
  query: FestivalScheduleQuery;
  isOffline: boolean;
  festivalTimeZone: string;
  onOpenSchedule: (
    card: FestivalHighlineScheduleCard,
    dayKey?: string | null,
  ) => void;
}) {
  if (query.isPending && !query.data) {
    return <FestivalLoadingState />;
  }

  if (query.data?.sectors.length) {
    const viewerBookings = getViewerFestivalBookings(query.data.sectors);

    return (
      <View className="gap-8">
        <ViewerScheduleSummary
          bookings={viewerBookings}
          festivalTimeZone={festivalTimeZone}
          hasAccount={!!query.data.viewer.userId}
          isOffline={isOffline}
          onOpenSchedule={onOpenSchedule}
        />

        <FestivalSectorList
          sectors={query.data.sectors}
          festivalTimeZone={festivalTimeZone}
          onOpenSchedule={onOpenSchedule}
        />
      </View>
    );
  }

  if (query.error) {
    return <FestivalErrorState isOffline={isOffline} />;
  }

  return <FestivalEmptyState />;
}
