import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeInLeft,
  FadeInRight,
  LayoutAnimationConfig,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  SEGMENTED_CONTROL_HEIGHT,
  SegmentedControl,
} from '~/components/ui/segmented-control';

export type HighlineTab = 'details' | 'ranking';

const TABS: HighlineTab[] = ['details', 'ranking'];

/** Vertical padding around the control, inline and pinned alike. */
const BAR_PADDING = 8;
/** Height of the row holding the control; the header blur grows by this when pinned. */
export const HIGHLINE_TABS_BAR_HEIGHT =
  SEGMENTED_CONTROL_HEIGHT + BAR_PADDING * 2;

const HighlineTabsControl: React.FC<{
  tab: HighlineTab;
  onTabChange: (tab: HighlineTab) => void;
}> = ({ tab, onTabChange }) => {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      value={tab}
      onChange={onTabChange}
      options={[
        { value: 'details', label: t('app.highline.index.tabs.details') },
        { value: 'ranking', label: 'Ranking' },
      ]}
    />
  );
};

/**
 * The inline control. Reports its top edge in scroll-content coordinates
 * (`offsetY` + its layout y) so the page knows when it reaches the header.
 */
export const HighlineTabsBar: React.FC<{
  tab: HighlineTab;
  onTabChange: (tab: HighlineTab) => void;
  /** Where the bar's parent starts in scroll-content coordinates. */
  offsetY: number;
  barY: SharedValue<number>;
}> = ({ tab, onTabChange, offsetY, barY }) => (
  <View
    style={{ paddingVertical: BAR_PADDING }}
    onLayout={(e) => barY.set(offsetY + e.nativeEvent.layout.y)}
  >
    <HighlineTabsControl tab={tab} onTabChange={onTabChange} />
  </View>
);

/** True once the inline bar has scrolled up to `top` (the header's bottom edge). */
export const useHighlineTabsPinned = (
  scrollY: SharedValue<number>,
  barY: SharedValue<number>,
  top: number,
) => {
  const [pinned, setPinned] = useState(false);
  useAnimatedReaction(
    () => barY.get() > 0 && scrollY.get() + top >= barY.get(),
    (now, prev) => {
      if (now !== prev) scheduleOnRN(setPinned, now);
    },
  );
  return pinned;
};

/**
 * Copy of the bar pinned under the header. Transparent: it sits inside the
 * header's blur (grown via `blurExtension`), so header and tabs read as one bar.
 */
export const PinnedHighlineTabsBar: React.FC<{
  top: number;
  tab: HighlineTab;
  onTabChange: (tab: HighlineTab) => void;
}> = ({ top, tab, onTabChange }) => (
  <View
    className="absolute left-0 right-0 px-4"
    style={{ top, paddingVertical: BAR_PADDING }}
  >
    <HighlineTabsControl tab={tab} onTabChange={onTabChange} />
  </View>
);

/**
 * Renders the active tab; a horizontal swipe moves to the neighbouring tab and
 * the new content slides in from the side it came from.
 */
export const HighlineTabContent: React.FC<{
  tab: HighlineTab;
  onTabChange: (tab: HighlineTab) => void;
  children: React.ReactNode;
}> = ({ tab, onTabChange, children }) => {
  // At least a screen tall, so switching tabs while pinned can keep the bar
  // pinned even when the new tab is short (or still loading).
  const { height: minHeight } = useWindowDimensions();

  const swipe = (dx: number) => {
    const next = TABS[TABS.indexOf(tab) + (dx < 0 ? 1 : -1)];
    if (next) onTabChange(next);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 60 || Math.abs(e.velocityX) > 500) {
        scheduleOnRN(swipe, e.translationX);
      }
    });

  // Slide direction follows tab order, whether the change came from a swipe
  // or from the control.
  const [direction, setDirection] = useState(1);
  const [lastTab, setLastTab] = useState(tab);
  if (tab !== lastTab) {
    setLastTab(tab);
    setDirection(TABS.indexOf(tab) > TABS.indexOf(lastTab) ? 1 : -1);
  }

  return (
    <GestureDetector gesture={pan}>
      <View style={{ minHeight }}>
        <LayoutAnimationConfig skipEntering>
          <Animated.View
            key={tab}
            entering={(direction > 0 ? FadeInRight : FadeInLeft).duration(220)}
          >
            {children}
          </Animated.View>
        </LayoutAnimationConfig>
      </View>
    </GestureDetector>
  );
};
