import { useMapStore } from '~/store/map-store';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';

import type { Highline } from '~/hooks/use-highline';

import { HighlineCard } from '../highline/highline-card';
import { getHighlineBrowseCoordinate, haversineDistance } from './utils';

export const MapCardList = ({
  highlines,
  focusedMarker,
  changeFocusedMarker,
}: {
  highlines: Highline[];
  focusedMarker: Highline | null;
  changeFocusedMarker: (high: Highline) => void;
}) => {
  const router = useRouter();
  const bottomSheetHandlerHeight = useMapStore(
    (state) => state.bottomSheetHandlerHeight,
  );
  const userLocation = useMapStore((state) => state.userLocation);

  const distanceByHighlineId = React.useMemo(() => {
    if (!userLocation) {
      return new Map<string, number>();
    }

    return new Map(
      highlines.flatMap((highline) => {
        const browseCoordinate = getHighlineBrowseCoordinate({
          anchorALat: highline.anchor_a_lat,
          anchorALong: highline.anchor_a_long,
          anchorBLat: highline.anchor_b_lat,
          anchorBLong: highline.anchor_b_long,
        });

        if (!browseCoordinate) {
          return [];
        }

        return [
          [
            highline.id,
            haversineDistance(
              userLocation.latitude,
              userLocation.longitude,
              browseCoordinate[1],
              browseCoordinate[0],
            ),
          ] as const,
        ];
      }),
    );
  }, [highlines, userLocation]);

  const handleCardPress = (high: Highline) => {
    if (high.id === focusedMarker?.id) {
      // If already focused, navigate to highline page
      router.push(`/highline/${high.id}`);
    } else {
      // Otherwise, focus the card
      changeFocusedMarker(high);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300).easing(Easing.inOut(Easing.ease))}
      exiting={FadeOut.duration(300).easing(Easing.inOut(Easing.ease))}
      style={{
        position: 'absolute',
        bottom: focusedMarker ? 12 : bottomSheetHandlerHeight,
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
            onPress={() => handleCardPress(high)}
            className="h-48 w-80"
            distanceFromUserMeters={distanceByHighlineId.get(high.id)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
};
