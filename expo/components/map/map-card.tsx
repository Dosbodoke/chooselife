import {
  BackdropFilter,
  Blur,
  Canvas,
  Group,
  LinearGradient,
  Paint,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import { useMapStore } from '~/store/map-store';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';

import type { Highline } from '~/hooks/use-highline';

import { HighlineCard } from '../highline/highline-card';
import { getHighlineBrowseCoordinate, haversineDistance } from './utils';

const CARD_WIDTH = 320;
const CARD_HEIGHT = 192;
const CARD_VERTICAL_PADDING = 8;
const CARD_GAP = 16;

const CARD_LIST_HEIGHT = CARD_HEIGHT + CARD_VERTICAL_PADDING * 2;
const ITEM_WIDTH = CARD_WIDTH + CARD_GAP;

const FEATHER_HEIGHT = 100;
const TOTAL_HEIGHT = CARD_LIST_HEIGHT + FEATHER_HEIGHT;
const SOLID_AT = 0.5;

interface MapCardListProps {
  highlines: Highline[];
  focusedMarker: Highline | null;
  changeFocusedMarker: (high: Highline) => void;
  /** Set to true for satellite / dark map tiles */
  dark?: boolean;
}

export const MapCardList = ({
  highlines,
  focusedMarker,
  changeFocusedMarker,
  dark = false,
}: MapCardListProps) => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = React.useRef<ScrollView>(null);
  const isSwiping = React.useRef(false);

  const bottomSheetHandlerHeight = useMapStore(
    (state) => state.bottomSheetHandlerHeight,
  );
  const userLocation = useMapStore((state) => state.userLocation);

  // Theme colors – dark or light
  const theme = React.useMemo(
    () => ({
      BG: dark ? '#1A1A1A' : '#F2F2F2',
      BG_ALPHA: dark ? 'rgba(26, 26, 26, 1)' : 'rgba(242, 242, 242, 1)',
      TRANSPARENT: dark ? 'rgba(26, 26, 26, 0)' : 'rgba(242, 242, 242, 0)',
      BLUR_FILL: dark
        ? 'rgba(26, 26, 26, 0.001)'
        : 'rgba(242, 242, 242, 0.001)',
    }),
    [dark],
  );

  const distanceByHighlineId = React.useMemo(() => {
    if (!userLocation) return new Map<string, number>();

    return new Map(
      highlines.flatMap((highline) => {
        const browseCoordinate = getHighlineBrowseCoordinate({
          anchorALat: highline.anchor_a_lat,
          anchorALong: highline.anchor_a_long,
          anchorBLat: highline.anchor_b_lat,
          anchorBLong: highline.anchor_b_long,
        });
        if (!browseCoordinate) return [];
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

  // Keep carousel in sync when a marker is tapped (non‑swipe trigger)
  React.useEffect(() => {
    if (!focusedMarker || !scrollRef.current || highlines.length === 0) return;
    if (isSwiping.current) return;

    const index = highlines.findIndex((h) => h.id === focusedMarker.id);
    if (index !== -1) {
      scrollRef.current.scrollTo({ x: index * ITEM_WIDTH, animated: true });
    }
  }, [focusedMarker, highlines]);

  const handleCardPress = (high: Highline) => {
    if (high.id === focusedMarker?.id) {
      router.push(`/highline/${high.id}`);
    } else {
      changeFocusedMarker(high);
    }
  };

  const onSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isSwiping.current = false;
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / ITEM_WIDTH);
    if (index >= 0 && index < highlines.length) {
      const high = highlines[index];
      if (high.id !== focusedMarker?.id) {
        changeFocusedMarker(high);
      }
    }
  };

  const sidePadding = (width - CARD_WIDTH) / 2;

  return (
    <Animated.View
      entering={FadeIn.duration(300).easing(Easing.inOut(Easing.ease))}
      exiting={FadeOut.duration(300).easing(Easing.inOut(Easing.ease))}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: focusedMarker ? 0 : bottomSheetHandlerHeight,
        left: 0,
        right: 0,
        height: TOTAL_HEIGHT,
      }}
    >
      {/* Skia blur + overlay (dark or light) */}
      <Canvas
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        pointerEvents="none"
      >
        {/* Masked backdrop blur – fades from transparent to solid */}
        <Group
          layer={
            <Paint>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, TOTAL_HEIGHT)}
                colors={['transparent', theme.BG_ALPHA]}
                positions={[0, SOLID_AT]}
              />
            </Paint>
          }
        >
          <BackdropFilter filter={<Blur blur={24} />}>
            <Rect
              x={0}
              y={0}
              width={width}
              height={TOTAL_HEIGHT}
              color={theme.BLUR_FILL}
            />
          </BackdropFilter>
        </Group>

        {/* Solid overlay – transparent → opaque theme background */}
        <Rect x={0} y={0} width={width} height={TOTAL_HEIGHT}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, TOTAL_HEIGHT * SOLID_AT)}
            colors={[theme.TRANSPARENT, theme.BG_ALPHA]}
          />
        </Rect>
      </Canvas>

      {/* Carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        decelerationRate="fast"
        snapToInterval={ITEM_WIDTH}
        snapToAlignment="center"
        scrollEnabled={highlines.length > 1}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          isSwiping.current = true;
        }}
        onMomentumScrollEnd={onSwipeEnd}
        contentContainerStyle={{
          paddingHorizontal: sidePadding,
          paddingTop: CARD_VERTICAL_PADDING,
          paddingBottom: CARD_VERTICAL_PADDING,
          gap: CARD_GAP,
        }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: TOTAL_HEIGHT * 0.15,
          height: CARD_LIST_HEIGHT,
          zIndex: 1,
        }}
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
