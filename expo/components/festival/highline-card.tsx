import type { FestivalHighlineQueueCard } from '@chooselife/ui';
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

export const FestivalHighlineCardView: React.FC<{
  card: FestivalHighlineQueueCard;
  onPress: () => void;
}> = ({ card, onPress }) => {
  const { t } = useTranslation();
  const nextNames = card.queueSummary.nextEntries
    .slice(0, 3)
    .map((entry) => entry.display_name)
    .join(' • ');

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
          <View className="flex-row justify-between">
            <View className="flex flex-row gap-2 items-center">
              <Icon as={UsersIcon} className="size-3 text-black" />
              <Text className="font-semibold uppercase tracking-[1px] text-slate-500">
                {t('app.(festival).highlines.queueCount', {
                  count: card.queueSummary.waitingCount,
                })}
              </Text>
            </View>

            {card.queueSummary.calledEntry ? (
              <View className="max-w-[56%] flex-row items-center gap-1.5">
                <Icon as={MegaphoneIcon} className="size-3 text-green-500" />
                <Text
                  className="font-semibold text-green-500"
                  numberOfLines={1}
                >
                  {t('app.(festival).highlines.currentLabel')}:{' '}
                  {card.queueSummary.calledEntry.display_name}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Button
          className="h-12 w-full flex-row items-center justify-between rounded-2xl bg-[#101b2b] px-4"
          onPress={onPress}
        >
          <Text className="font-semibold text-white">
            {t('app.(festival).highlines.openQueueButton')}
          </Text>
          <Icon as={ChevronRightIcon} className="size-4 text-white" />
        </Button>
      </View>
    </Pressable>
  );
};
