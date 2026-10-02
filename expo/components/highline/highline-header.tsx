import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeftIcon, PencilIcon, ShareIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Highline } from '~/hooks/use-highline';
import { cn } from '~/lib/utils';

import { FavoriteHighline } from '~/components/highline/favorite-button';
import { BlurView, ProgressiveBlurView } from '~/components/ui/backdrop';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

export const HEADER_BUTTON_SIZE = 40;

const HeaderButton: React.FC<{
  collapsed: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}> = ({ collapsed, onPress, children }) => (
  <BlurView
    intensity={60}
    tint={collapsed ? 'systemThinMaterialLight' : 'systemThinMaterialDark'}
    cornerRadius={HEADER_BUTTON_SIZE / 2}
    style={{ width: HEADER_BUTTON_SIZE, height: HEADER_BUTTON_SIZE }}
  >
    {onPress ? (
      <TouchableOpacity
        onPress={onPress}
        className="flex-1 items-center justify-center"
      >
        {children}
      </TouchableOpacity>
    ) : (
      <View className="flex-1 items-center justify-center">{children}</View>
    )}
  </BlurView>
);

/**
 * Floating actions over the cover. Once the cover scrolls away
 * (`scrollY > collapseAt`) a progressive-blur bar fades in behind them with
 * the highline name, and the buttons and status bar switch to their light
 * appearance to sit on the page background.
 */
export const HighlineHeader: React.FC<{
  highline: Highline;
  scrollY: SharedValue<number>;
  collapseAt: number;
  paddingTop: number;
  onBack: () => void;
  onShare: () => void;
  /** Extra height for the blur bar so a control pinned under it shares the material. */
  blurExtension?: number;
}> = ({
  highline,
  scrollY,
  collapseAt,
  paddingTop,
  onBack,
  onShare,
  blurExtension = 0,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const barHeight = paddingTop + HEADER_BUTTON_SIZE + 12;
  const blurHeight = barHeight + blurExtension + 24;
  const iconClassName = cn(collapsed ? 'text-foreground' : 'text-white');

  useAnimatedReaction(
    () => scrollY.get() > collapseAt,
    (now, prev) => {
      if (now !== prev) scheduleOnRN(setCollapsed, now);
    },
  );

  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [collapseAt - 60, collapseAt],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [collapseAt - 10, collapseAt + 20],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.get(),
          [collapseAt - 10, collapseAt + 20],
          [8, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <>
      <StatusBar style={collapsed ? 'dark' : 'light'} />

      <Animated.View
        pointerEvents="none"
        className="absolute top-0 left-0 right-0"
        style={[{ height: blurHeight }, barStyle]}
      >
        <ProgressiveBlurView
          edge="top"
          // Fully blurred down to the bottom of any pinned control, then fade.
          startOffset={
            blurExtension ? (barHeight + blurExtension) / blurHeight : 0.6
          }
          intensity={70}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <View
        pointerEvents="box-none"
        className="absolute top-0 left-0 right-0 px-4 flex-row items-center justify-between"
        style={{ paddingTop }}
      >
        <HeaderButton collapsed={collapsed} onPress={onBack}>
          <Icon as={ChevronLeftIcon} className={cn('size-6', iconClassName)} />
        </HeaderButton>

        <Animated.View
          pointerEvents="none"
          className="flex-1 mx-3 items-center"
          style={titleStyle}
        >
          <Text
            numberOfLines={1}
            className="text-base font-semibold text-foreground"
          >
            {highline.name}
          </Text>
        </Animated.View>

        <View className="flex-row gap-2">
          <Link href={`/highline/${highline.id}/edit`} asChild>
            <TouchableOpacity>
              <HeaderButton collapsed={collapsed}>
                <Icon as={PencilIcon} className={cn('size-5', iconClassName)} />
              </HeaderButton>
            </TouchableOpacity>
          </Link>
          <HeaderButton collapsed={collapsed} onPress={onShare}>
            <Icon as={ShareIcon} className={cn('size-5', iconClassName)} />
          </HeaderButton>
          <HeaderButton collapsed={collapsed}>
            <FavoriteHighline
              isFavorite={!!highline.is_favorite}
              id={highline.id}
              className="bg-transparent p-0 size-6"
              hearthClassName={iconClassName}
            />
          </HeaderButton>
        </View>
      </View>
    </>
  );
};
