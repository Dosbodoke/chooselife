import BottomSheet, {
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { LegendList } from '@legendapp/list';
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

type NearbyHighlineItem = {
  highline: Highline;
  distanceFromUserMeters: number | null;
};

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
  const listHeight = Math.max(windowHeight - top - bottomSheetHandlerHeight, 1);

  const onShowMap = () => bottomSheetRef.current?.collapse();

  const renderItem = useCallback(
    ({ item }: { item: NearbyHighlineItem }) => (
      <HighlineCard
        item={item.highline}
        distanceFromUserMeters={item.distanceFromUserMeters}
      />
    ),
    [],
  );

  const renderHandle = useCallback(() => <ExploreHeader />, []);

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
      onChange={() => Haptics.selectionAsync()}
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
      <View style={{ flex: 1, minHeight: 1 }}>
        {nearbyHighlines.length > 0 ? (
          <LegendList
            data={nearbyHighlines}
            renderItem={renderItem}
            keyExtractor={(item: NearbyHighlineItem) => item.highline.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            style={{ flex: 1, height: listHeight, minHeight: 1 }}
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
