import BottomSheet, {
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { LegendList } from '@legendapp/list/react-native';
import { useMapStore } from '~/store/map-store';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useDeferredValue } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHighline, type Highline } from '~/hooks/use-highline';

import { HighlineCard } from '../highline/highline-card';
import ExploreHeader from './explore-header';
import { MapToggle } from './map-toggle';
import {
  approximateDistanceScore,
  getHighlineBrowseCoordinate,
  haversineDistance,
} from './utils';

// HighlineCard is h-48 (192dp) plus its own mb-3 (12dp) gap. Every row is
// wrapped in a View pinned to this exact height so what LegendList measures
// always equals what `getFixedItemSize` promises - if the two ever disagree the
// list re-measures each row forever and the positions it scrolls to drift away
// from where the rows actually are, leaving cards past the end of the scroll.
const LISTING_ITEM_HEIGHT = 204;

// Keep the final card above the floating map control (80dp from the bottom).
const LISTINGS_BOTTOM_PADDING = 144;

// Stable identities: LegendList caches layout per key, and BottomSheetScrollView
// is memoized, so re-created prop objects would throw both away on each render.
const listContentContainerStyle = {
  paddingHorizontal: 16,
  paddingBottom: LISTINGS_BOTTOM_PADDING,
} as const;

const listingItemStyle = { height: LISTING_ITEM_HEIGHT } as const;

type NearbyHighlineItem = {
  highline: Highline;
  distanceFromUserMeters: number | null;
};

const keyExtractor = (item: NearbyHighlineItem) => item.highline.id;

const getListingItemSize = () => LISTING_ITEM_HEIGHT;

const ListingsBottomSheet: React.FC = () => {
  const { height: windowHeight } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const bottomSheetHandlerHeight = useMapStore(
    (state) => state.bottomSheetHandlerHeight,
  );
  const searchQuery = useMapStore((state) => state.searchQuery);
  const activeCategory = useMapStore((state) => state.activeCategory);
  const browseOrigin = useMapStore((state) => state.camera.center);
  const userLocation = useMapStore((state) => state.userLocation);

  const bottomSheetRef = React.useRef<BottomSheet>(null);
  const BottomSheetScrollView = useBottomSheetScrollableCreator();
  const sortOrigin = React.useMemo(
    () =>
      userLocation
        ? ([userLocation.longitude, userLocation.latitude] as const)
        : browseOrigin,
    [browseOrigin, userLocation],
  );
  const deferredSortOrigin = useDeferredValue(sortOrigin);

  const { highlines } = useHighline({
    searchTerm: searchQuery,
    category: activeCategory,
  });

  const highlinesWithBrowseCoordinate = React.useMemo(() => {
    return highlines.map((highline) => ({
      highline,
      browseCoordinate: getHighlineBrowseCoordinate({
        anchorALat: highline.anchor_a_lat,
        anchorALong: highline.anchor_a_long,
        anchorBLat: highline.anchor_b_lat,
        anchorBLong: highline.anchor_b_long,
      }),
    }));
  }, [highlines]);

  const nearbyHighlines = React.useMemo<NearbyHighlineItem[]>(() => {
    const [originLongitude, originLatitude] = deferredSortOrigin;

    if (!Number.isFinite(originLongitude) || !Number.isFinite(originLatitude)) {
      return highlines.map((highline) => ({
        highline,
        distanceFromUserMeters: null,
      }));
    }

    const scoredHighlines = highlinesWithBrowseCoordinate.map(
      ({ highline, browseCoordinate }, index) => ({
        highline,
        index,
        distanceFromUserMeters:
          userLocation && browseCoordinate
            ? haversineDistance(
                userLocation.latitude,
                userLocation.longitude,
                browseCoordinate[1],
                browseCoordinate[0],
              )
            : null,
        distanceScore: browseCoordinate
          ? approximateDistanceScore(
              originLatitude,
              originLongitude,
              browseCoordinate[1],
              browseCoordinate[0],
            )
          : Number.POSITIVE_INFINITY,
      }),
    );

    scoredHighlines.sort((left, right) => {
      if (left.distanceScore === right.distanceScore) {
        return left.index - right.index;
      }

      return left.distanceScore - right.distanceScore;
    });

    return scoredHighlines.map(({ highline, distanceFromUserMeters }) => ({
      highline,
      distanceFromUserMeters,
    }));
  }, [
    deferredSortOrigin,
    highlines,
    highlinesWithBrowseCoordinate,
    userLocation,
  ]);

  const snapPoints = React.useMemo(() => {
    return [bottomSheetHandlerHeight || '35%', '100%'];
  }, [bottomSheetHandlerHeight]);

  // gorhom sizes BottomSheetContent through a Reanimated animated style, so its
  // height never reaches Yoga during layout: `flex: 1` inside it resolves against
  // an auto-height parent and the scrollable grows to fit its own content. That
  // makes LegendList measure the whole content as its viewport, so it believes
  // every row is on screen and there is nothing left to scroll to. The sheet
  // container is inset by `top` and the handle sits above the content, so this is
  // the height the content area actually gets.
  const listHeight = Math.max(windowHeight - top - bottomSheetHandlerHeight, 1);
  const listStyle = React.useMemo(() => ({ height: listHeight }), [listHeight]);

  const onShowMap = () => bottomSheetRef.current?.collapse();

  const renderItem = useCallback(
    ({ item }: { item: NearbyHighlineItem }) => (
      <View style={listingItemStyle}>
        <HighlineCard
          item={item.highline}
          distanceFromUserMeters={item.distanceFromUserMeters}
          animateMount={false}
        />
      </View>
    ),
    [],
  );

  const renderHandle = useCallback(() => <ExploreHeader />, []);

  const onSnapChange = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      enableDynamicSizing={false}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      handleComponent={renderHandle}
      onChange={onSnapChange}
      style={{
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: { width: 1, height: 1 },
        borderRadius: 16,
      }}
      containerStyle={{ marginTop: top }}
    >
      <View style={listStyle}>
        {nearbyHighlines.length > 0 ? (
          <LegendList
            data={nearbyHighlines}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={listContentContainerStyle}
            estimatedItemSize={LISTING_ITEM_HEIGHT}
            getFixedItemSize={getListingItemSize}
            drawDistance={LISTING_ITEM_HEIGHT * 3}
            style={listStyle}
            renderScrollComponent={BottomSheetScrollView}
            keyboardShouldPersistTaps="always"
            recycleItems
          />
        ) : null}
      </View>
      <MapToggle onPress={onShowMap} />
    </BottomSheet>
  );
};

export default ListingsBottomSheet;
