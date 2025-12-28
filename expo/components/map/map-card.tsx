import { useMapStore } from '~/store/map-store';
import React from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';

import type { Highline } from '~/hooks/use-highline';

import { HighlineCard } from '../highline/highline-card';

export const MapCardList = ({
  highlines,
  focusedMarker,
  changeFocusedMarker,
}: {
  highlines: Highline[];
  focusedMarker: Highline | null;
  changeFocusedMarker: (high: Highline) => void;
}) => {
  const bottomSheetHandlerHeight = useMapStore(
    (state) => state.bottomSheetHandlerHeight,
  );
  return (
    <Animated.View
      entering={FadeIn.duration(300).easing(Easing.inOut(Easing.ease))}
      exiting={FadeOut.duration(300).easing(Easing.inOut(Easing.ease))}
      style={{
        position: 'absolute',
        bottom: bottomSheetHandlerHeight + 0  , // Bottom sheet handle + padding
        left: 0,
        right: 0,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-2 gap-4"
      >
        {highlines.map((high) => (
          <HighlineCard
            key={`highline-card-${high.id}`}
            item={high}
            isFocused={high.id === focusedMarker?.id}
            onPress={() => changeFocusedMarker(high)}
            className="h-48 w-80"
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
};
