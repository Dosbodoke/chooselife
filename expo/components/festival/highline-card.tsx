import type { FestivalHighlineScheduleCard } from '@chooselife/ui';
import {
  ChevronRightIcon,
  MegaphoneIcon,
  MoveHorizontalIcon,
  MoveVerticalIcon,
  UsersIcon,
} from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useI18n } from '~/context/i18n';

import { HighlineImage } from '~/components/highline/highline-image';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const StatPill: React.FC<{
  icon: React.ComponentProps<typeof Icon>['as'];
  value: string;
}> = ({ icon, value }) => (
  <View className="flex-row items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
    <Icon as={icon} className="size-3 text-white" />
    <Text className="text-xs font-semibold text-white">{value}</Text>
  </View>
);

function formatBookingOpensAt(
  dateTime: string,
  locale: string,
  timeZone: string,
) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(dateTime));
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
