import { useIsMember } from '@chooselife/ui';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Image as ExpoImage } from 'expo-image';
import {
  ChevronRightIcon,
  FootprintsIcon,
  LockIcon,
  RouteIcon,
  TrophyIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';

import {
  getProfileAchievements,
  type AchievementId,
  type AchievementTone,
  type ProfileAchievement,
  type ProfileAchievementInput,
} from '~/features/achievements/profile-achievements';
import { getR2PublicUrl } from '~/lib/r2';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Icon } from '~/components/ui/icon';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

const ROW_SIZE = 3;

const ICONS: Record<AchievementId, LucideIcon> = {
  'slac-member': UsersIcon,
  'first-walk': FootprintsIcon,
  'first-full-line': TrophyIcon,
  'one-km-walked': RouteIcon,
};

// Official badge art shown instead of the drawn heptagon once earned.
const EARNED_ART: Partial<Record<AchievementId, string>> = {
  'slac-member': getR2PublicUrl('promo', 'slac-badge.png'),
};

type BadgePalette = { rim: string; from: string; to: string };

const PALETTES: Record<AchievementTone | 'locked', BadgePalette> = {
  violet: { rim: '#ddd6fe', from: '#a78bfa', to: '#6d28d9' },
  emerald: { rim: '#bbf7d0', from: '#4ade80', to: '#15803d' },
  amber: { rim: '#fde68a', from: '#fbbf24', to: '#c2410c' },
  sky: { rim: '#bae6fd', from: '#38bdf8', to: '#0369a1' },
  locked: { rim: '#f4f4f5', from: '#d4d4d8', to: '#a1a1aa' },
};

/** Vertices of a regular heptagon with one point facing up. */
const heptagonPoints = (size: number, inset: number) => {
  const center = size / 2;
  const radius = center - inset;

  return Array.from({ length: 7 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 7;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
};

const AchievementBadge: React.FC<{
  achievement: ProfileAchievement;
  size?: number;
}> = ({ achievement, size = 72 }) => {
  const gradientId = `badge-${React.useId()}`;
  const palette = PALETTES[achievement.earned ? achievement.tone : 'locked'];
  // Thick round-joined strokes give the heptagon soft corners.
  const rimStroke = size * 0.1;
  const coreStroke = size * 0.08;
  const coreInset = size * 0.15;

  const art = achievement.earned ? EARNED_ART[achievement.id] : undefined;
  if (art) {
    return (
      <ExpoImage
        source={{ uri: art }}
        contentFit="contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={palette.from} />
            <Stop offset="1" stopColor={palette.to} />
          </LinearGradient>
        </Defs>
        <Polygon
          points={heptagonPoints(size, rimStroke / 2 + 1)}
          fill={palette.rim}
          stroke={palette.rim}
          strokeWidth={rimStroke}
          strokeLinejoin="round"
        />
        <Polygon
          points={heptagonPoints(size, coreInset)}
          fill={`url(#${gradientId})`}
          stroke={`url(#${gradientId})`}
          strokeWidth={coreStroke}
          strokeLinejoin="round"
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Icon
          as={ICONS[achievement.id]}
          size={size * 0.34}
          color={achievement.earned ? '#ffffff' : '#f4f4f5'}
          strokeWidth={2.25}
        />
      </View>
    </View>
  );
};

const BadgeLabel: React.FC<{ achievement: ProfileAchievement }> = ({
  achievement,
}) => {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center justify-center gap-1">
      {achievement.earned ? null : (
        <Icon as={LockIcon} className="size-3 text-muted-foreground" />
      )}
      <Text
        numberOfLines={2}
        className={
          achievement.earned
            ? 'text-center text-xs font-medium text-foreground'
            : 'text-center text-xs font-medium text-muted-foreground'
        }
      >
        {t(`app.profile.[username].Achievements.items.${achievement.id}.title`)}
      </Text>
    </View>
  );
};

export const AchievementsCard: React.FC<{
  stats: ProfileAchievementInput['stats'] | null | undefined;
}> = ({ stats }) => {
  const { t } = useTranslation();
  const sheetRef = React.useRef<BottomSheetModal>(null);
  const { data: isSlacMember, isPending: membershipPending } =
    useIsMember('slac');

  const isLoading = !stats || membershipPending;
  const achievements = getProfileAchievements({
    isSlacMember: !!isSlacMember,
    stats: stats ?? { total_distance_walked: 0, total_full_lines: 0 },
  });
  const earnedCount = achievements.filter((a) => a.earned).length;

  const openSheet = () => sheetRef.current?.present();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t('app.profile.[username].Achievements.title')}</CardTitle>
        <Pressable
          onPress={openSheet}
          disabled={isLoading}
          hitSlop={8}
          accessibilityRole="button"
          className="flex-row items-center gap-0.5 active:opacity-60"
        >
          <Text className="text-sm font-medium text-muted-foreground">
            {t('app.profile.[username].Achievements.viewAll')}
          </Text>
          <Icon as={ChevronRightIcon} className="size-4 text-muted-foreground" />
        </Pressable>
      </CardHeader>
      <CardContent className="flex-row justify-around">
        {isLoading
          ? Array.from({ length: ROW_SIZE }).map((_, index) => (
              <View
                key={`achievement-loading-${index}`}
                className="w-24 items-center gap-2"
              >
                <Skeleton className="size-[72px] rounded-3xl" />
                <Skeleton className="h-3 w-16" />
              </View>
            ))
          : achievements.slice(0, ROW_SIZE).map((achievement) => (
              <Pressable
                key={achievement.id}
                onPress={openSheet}
                accessibilityRole="button"
                accessibilityLabel={t(
                  `app.profile.[username].Achievements.items.${achievement.id}.title`,
                )}
                className="w-24 items-center gap-2 active:scale-95"
              >
                <AchievementBadge achievement={achievement} />
                <BadgeLabel achievement={achievement} />
              </Pressable>
            ))}
      </CardContent>

      <AchievementsSheet
        ref={sheetRef}
        achievements={achievements}
        earnedCount={earnedCount}
      />
    </Card>
  );
};

const AchievementsSheet: React.FC<{
  ref: React.Ref<BottomSheetModal>;
  achievements: ProfileAchievement[];
  earnedCount: number;
}> = ({ ref, achievements, earnedCount }) => {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();

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

  return (
    <BottomSheetModal
      ref={ref}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: '#94a3b8' }}
    >
      <BottomSheetView
        style={{
          gap: 16,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: bottom + 16,
        }}
      >
        <View className="gap-1">
          <Text variant="h3">
            {t('app.profile.[username].Achievements.title')}
          </Text>
          <Text variant="muted">
            {t('app.profile.[username].Achievements.progress', {
              earned: earnedCount,
              total: achievements.length,
            })}
          </Text>
        </View>
        {achievements.map((achievement) => (
          <View key={achievement.id} className="flex-row items-center gap-4">
            <AchievementBadge achievement={achievement} size={56} />
            <View className="flex-1 gap-0.5">
              <Text
                className={
                  achievement.earned
                    ? 'text-base font-semibold'
                    : 'text-base font-semibold text-muted-foreground'
                }
              >
                {t(
                  `app.profile.[username].Achievements.items.${achievement.id}.title`,
                )}
              </Text>
              <Text variant="muted">
                {t(
                  `app.profile.[username].Achievements.items.${achievement.id}.description`,
                )}
              </Text>
            </View>
            {achievement.earned ? null : (
              <Icon as={LockIcon} className="size-4 text-muted-foreground" />
            )}
          </View>
        ))}
      </BottomSheetView>
    </BottomSheetModal>
  );
};
