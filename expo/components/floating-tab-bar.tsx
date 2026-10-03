import { useMapStore } from '~/store/map-store';
import {
  GlassContainer,
  GlassView,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Tabs, useRouter } from 'expo-router';
import { PlusIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import Animated, {
  cubicBezier,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type CSSTransitionProperties,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

type TabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>
>[0];

const DOCK_HEIGHT = 64;
const DOCK_SIDE_INSET = 16;
const DOCK_PADDING = 4;
const ADD_BUTTON_GAP = 10;
/** Breathing room between the dock and whatever scrolls behind it. */
const DOCK_CONTENT_GAP = 12;

const SPRING = { damping: 18, stiffness: 220, mass: 0.8 };

// The "+" slot animates its width with a Reanimated CSS transition rather than
// `useAnimatedStyle`: with a worklet-driven width, the next tab screen mounting
// re-commits React's layout over the in-flight value and the pill snaps back
// and forth. A CSS transition keeps the target in React's own props, so a
// re-render can only ever commit where the animation is headed.
// Layout animations (entering/exiting, LinearTransition) are no alternative:
// the glass circle stops rendering the moment it starts exiting.
const ADD_BUTTON_TRANSITION: CSSTransitionProperties<ViewStyle> = {
  transitionProperty: ['width', 'transform'],
  transitionDuration: 380,
  // iOS-style ease out: fast start, long settle.
  transitionTimingFunction: cubicBezier(0.32, 0.72, 0, 1),
};

/** iOS `tertiarySystemFill`: reads on both glass and the solid fallback. */
const INDICATOR_COLOR = 'rgba(120,120,128,0.12)';

const EXPLORE_ROUTE = 'index';

const isGlassAvailable = isLiquidGlassAvailable();

/** Distance from the screen bottom to the dock, just above the home indicator. */
function useDockBottom() {
  const { bottom } = useSafeAreaInsets();
  return Math.max(bottom - 12, DOCK_SIDE_INSET);
}

/**
 * Space the floating tab bar takes over the bottom of every tab screen. The
 * bar is absolutely positioned, so screens extend underneath it and have to
 * pad their scrollable content by this much.
 */
export function useFloatingTabBarHeight() {
  return useDockBottom() + DOCK_HEIGHT + DOCK_CONTENT_GAP;
}

/**
 * Last child of a tab screen's scroll content, so its final rows can scroll
 * clear of the floating tab bar. A trailing spacer rather than
 * `contentContainerStyle.paddingBottom` (which re-lays out the whole list when
 * it changes) or `contentInset` (iOS only).
 */
export function FloatingTabBarSpacer() {
  const height = useFloatingTabBarHeight();
  return <View style={{ height }} />;
}

/**
 * Liquid glass on iOS 26+. Elsewhere there is no glass to blur through, so the
 * surface becomes a solid card with an edge and a shadow of its own - without
 * them it disappears into white screens.
 *
 * Never animate opacity on this or any ancestor: UIKit drops the glass
 * material when an ancestor's alpha changes.
 */
function GlassSurface({
  style,
  className,
  onLayout,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  className?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  if (isGlassAvailable) {
    return (
      // Pinned to light: the app is light-only (`userInterfaceStyle`), and
      // auto glass turns dark over dark map/photo content, leaving the dark
      // labels unreadable.
      <GlassView
        isInteractive
        colorScheme="light"
        style={style}
        onLayout={onLayout}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={style}
      onLayout={onLayout}
      className={cn(
        'bg-card/95 border-hairline border-black/10 shadow-lg shadow-black/15',
        className,
      )}
    >
      {children}
    </View>
  );
}

/**
 * Lives only on Explore, but stays mounted everywhere: it shrinks its slot to
 * zero and scales away at the end of the pill, which grows into the space.
 * Inside one GlassContainer that reads as the circle melting into the pill on
 * iOS 26. Unmounting instead would drop the glass mid-animation.
 */
function AddHighlineButton({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();

  // Read on press rather than subscribe: the camera is only needed at the
  // moment of navigation, and subscribing re-renders the bar on every pan.
  const handlePress = () => {
    const { camera } = useMapStore.getState();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(
      `/location-picker?lat=${camera.center[1]}&lng=${camera.center[0]}&zoom=${camera.zoom}`,
    );
  };

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={{
        // The circle stays right-aligned while the slot narrows, so it
        // slides into the end of the pill as it shrinks.
        alignItems: 'flex-end',
        width: visible ? DOCK_HEIGHT + ADD_BUTTON_GAP : 0,
        transform: [{ scale: visible ? 1 : 0 }],
        ...ADD_BUTTON_TRANSITION,
      }}
    >
      <GlassSurface
        style={{
          width: DOCK_HEIGHT,
          height: DOCK_HEIGHT,
          borderRadius: DOCK_HEIGHT / 2,
        }}
      >
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={t('app.(tabs)._layout.addHighline')}
          testID="tab-bar-add-highline"
          className="flex-1 items-center justify-center"
        >
          <Icon
            as={PlusIcon}
            size={28}
            strokeWidth={2.25}
            className="text-foreground"
          />
        </Pressable>
      </GlassSurface>
    </Animated.View>
  );
}

/**
 * Floating tab bar: a labelled glass pill with a sliding selection, plus a
 * round "+" (add highline) that only exists on Explore. It floats over the
 * screens instead of taking layout space - see `useFloatingTabBarHeight`.
 */
export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: TabBarProps) {
  const dockBottom = useDockBottom();
  const isKeyboardVisible = useKeyboardState((s) => s.isVisible);
  const areMapCardsVisible = useMapStore((s) => s.clusteredMarkers.length > 0);

  const activeRoute = state.routes[state.index].name;
  const isExplore = activeRoute === EXPLORE_ROUTE;

  // The indicator is sized by percentage and only ever translated, so nothing
  // but a transform is animated. The row width is a shared value to keep pill
  // resizes off the React render path.
  const rowWidth = useSharedValue(0);
  const tabCount = state.routes.length;
  const activeIndex = state.index;
  const indicatorStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateX: withSpring(
            (activeIndex * rowWidth.get()) / tabCount,
            SPRING,
          ),
        },
      ],
    }),
    [activeIndex, tabCount],
  );

  // Explore hides the bar while highline cards are up, and every screen hides
  // it under the keyboard so it never rides up on Android's adjustResize.
  if (isKeyboardVisible || (isExplore && areMapCardsVisible)) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: DOCK_SIDE_INSET,
        right: DOCK_SIDE_INSET,
        bottom: dockBottom,
      }}
    >
      <GlassContainer spacing={16} style={{ flexDirection: 'row' }}>
        <GlassSurface
          style={{
            flex: 1,
            height: DOCK_HEIGHT,
            borderRadius: DOCK_HEIGHT / 2,
            padding: DOCK_PADDING,
          }}
        >
          <View
            accessibilityRole="tablist"
            className="flex-1 flex-row"
            onLayout={(e) => {
              rowWidth.set(e.nativeEvent.layout.width);
            }}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: `${100 / tabCount}%`,
                  backgroundColor: INDICATOR_COLOR,
                  borderRadius: (DOCK_HEIGHT - DOCK_PADDING * 2) / 2,
                },
                indicatorStyle,
              ]}
            />
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const focused = state.index === index;
              const label =
                typeof options.tabBarLabel === 'string'
                  ? options.tabBarLabel
                  : (options.title ?? route.name);

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  Haptics.selectionAsync();
                  navigation.navigate(route.name, route.params);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              };

              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                  testID={options.tabBarButtonTestID}
                  className="flex-1 items-center justify-center gap-0.5"
                >
                  {options.tabBarIcon?.({ focused, color: '', size: 24 })}
                  <Text
                    numberOfLines={1}
                    className={cn(
                      'text-[11px] font-semibold',
                      focused ? 'text-blue-500' : 'text-foreground',
                    )}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassSurface>
        <AddHighlineButton visible={isExplore} />
      </GlassContainer>
    </View>
  );
}
