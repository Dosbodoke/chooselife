import { RigStatuses } from '@chooselife/ui';
import { useRouter } from 'expo-router';
import { MoveHorizontalIcon, MoveVerticalIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Touchable } from 'react-native-gesture-handler';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import type { Highline } from '~/hooks/use-highline';
import { cn } from '~/lib/utils';

import { StyledSquircle } from '~/components/styled';
import { Icon } from '~/components/ui/icon';

import { FavoriteHighline } from './favorite-button';
import { HighlineImage } from './highline-image';
import { HighlineName } from './highline-name';
import { highlineImageTag } from './shared-transition';

const ReanimatedSquircleView = Animated.createAnimatedComponent(StyledSquircle);

interface HighlineCardProps {
  item: Highline;
  className?: string;
  onPress?: () => void;
  /** Called only for the card's built-in detail navigation. */
  onOpen?: () => void;
  isFocused?: boolean;
  distanceFromUserMeters?: number | null;
  showFavorite?: boolean;
  showStatus?: boolean;
  /**
   * Fade the card in/out when it mounts and unmounts. Must be disabled inside
   * virtualized lists: an exiting card stays mounted inside the recycled row
   * container, so the row measures taller than it really is and the list
   * recalculates every position below it.
   */
  animateMount?: boolean;
  /**
   * Fly the photo and name into the highline screen when the card opens it.
   * Only one card per highline on a screen may set it.
   */
  sharedTransition?: boolean;
}

interface CardContentProps {
  item: Highline;
  distanceFromUserMeters?: number | null;
  showStatus: boolean;
  sharedTransition: boolean;
}

const StatusChip: React.FC<{ status: RigStatuses }> = ({ status }) => {
  const { t } = useTranslation();

  const dotStyle: Record<RigStatuses, string> = {
    planned: 'bg-amber-300',
    rigged: 'bg-green-500',
    unrigged: 'bg-red-500',
  };

  return (
    <View className="bg-black/60 py-1.5 px-3 rounded-full flex flex-row gap-2 items-center backdrop-blur-md border border-white/10">
      <View className={cn('size-2 rounded-full', dotStyle[status])} />
      <Text className="text-white text-xs font-bold tracking-wide">
        {t(`components.map.explore-header.categories.${status}`)}
      </Text>
    </View>
  );
};

const formatDistanceFromUser = (
  distanceFromUserMeters: number,
  locale: string,
) => {
  if (distanceFromUserMeters < 1000) {
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(distanceFromUserMeters)}m`;
  }

  const distanceInKilometers = distanceFromUserMeters / 1000;
  const maximumFractionDigits = distanceInKilometers >= 10 ? 0 : 1;

  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(distanceInKilometers)}km`;
};

const StatsPills: React.FC<{
  height: number;
  length: number;
  distanceFromUserMeters?: number | null;
}> = ({ height, length, distanceFromUserMeters }) => {
  const { i18n, t } = useTranslation();

  const formattedDistance =
    typeof distanceFromUserMeters === 'number'
      ? t('components.highline.card.distanceFromYou', {
          distance: formatDistanceFromUser(
            distanceFromUserMeters,
            i18n.resolvedLanguage ?? i18n.language,
          ),
        })
      : null;

  return (
    <View className="flex-row flex-wrap gap-2">
      <View className="flex-row items-center bg-black/40 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/10">
        <Icon as={MoveVerticalIcon} className="text-white/90 size-3 mr-1" />
        <Text className="text-white text-xs font-bold">{height}m</Text>
      </View>
      <View className="flex-row items-center bg-black/40 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/10">
        <Icon as={MoveHorizontalIcon} className="text-white/90 size-3 mr-1" />
        <Text className="text-white text-xs font-bold">{length}m</Text>
      </View>
      {formattedDistance ? (
        <View className="bg-black/55 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/15">
          <Text className="text-white text-xs font-bold">
            {formattedDistance}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

// ============================================================================
// Card Content (renders inside the squircle)
// ============================================================================

const CardContent: React.FC<CardContentProps> = ({
  item,
  distanceFromUserMeters,
  showStatus,
  sharedTransition,
}) => {
  return (
    <>
      {/* Background Image */}
      <View className="absolute inset-0">
        {/* Rounded like the card (rounded-2xl), since the image leaves the
            card's clip while it flies to the highline screen. */}
        <HighlineImage
          coverImageId={item.cover_image}
          className="h-full w-full"
          borderRadius={16}
          sharedTransitionTag={
            sharedTransition ? highlineImageTag(item.id) : undefined
          }
        />
      </View>

      {/* Gradient Overlay */}
      <View
        className="absolute bottom-0 w-full h-2/3"
        style={{
          experimental_backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
        }}
      />

      {/* Content */}
      <View className="flex-1 p-4 justify-between">
        <View className="flex-row justify-between items-start">
          {showStatus ? (
            <StatusChip status={item.status as RigStatuses} />
          ) : (
            <View />
          )}
          <FavoriteHighline
            isFavorite={item.is_favorite}
            id={item.id}
            className="bg-black/60"
          />
        </View>

        {/* Bottom Content */}
        <View className="gap-1.5">
          <HighlineName
            highlineID={item.id}
            name={item.name}
            sharedTransition={sharedTransition}
          />
          <StatsPills
            height={item.height}
            length={item.length}
            distanceFromUserMeters={distanceFromUserMeters}
          />
        </View>
      </View>
    </>
  );
};

export const HighlineCard: React.FC<HighlineCardProps> = ({
  item,
  className,
  onPress,
  isFocused,
  distanceFromUserMeters,
  showStatus = true,
  animateMount = true,
  onOpen,
  sharedTransition = false,
}) => {
  const router = useRouter();

  const content = (
    <ReanimatedSquircleView
      className={cn(
        'h-48 w-full overflow-hidden rounded-2xl bg-muted relative mb-3',
        isFocused && 'border-2 border-white',
        className,
      )}
      cornerSmoothing={1}
      entering={animateMount ? FadeInRight : undefined}
      exiting={animateMount ? FadeOutLeft : undefined}
    >
      <CardContent
        item={item}
        distanceFromUserMeters={distanceFromUserMeters}
        showStatus={showStatus}
        sharedTransition={sharedTransition}
      />
    </ReanimatedSquircleView>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  // Touchable dims the native view instead of the `opacity` style, so a shared
  // image doesn't leave the card still dimmed from the press.
  return (
    <Touchable
      activeOpacity={0.9}
      onPress={() => {
        onOpen?.();
        router.push(`/highline/${item.id}`);
      }}
    >
      {content}
    </Touchable>
  );
};
