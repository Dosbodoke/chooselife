import BottomSheet, {
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { LegendList } from '@legendapp/list';
import { useMapStore } from '~/store/map-store';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { PlusIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { type Highline } from '~/hooks/use-highline';
import { cn } from '~/lib/utils';
import { _layoutAnimation } from '~/utils/constants';

import { HighlineCard } from '../highline/highline-card';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';
import { MapToggle } from './map-toggle';
import { WeatherInfoCard, WeatherSummary } from './weather-info-card';

// Default coordinates (Brasília, Brazil)
const DEFAULT_LATITUDE = -15.7782081;
const DEFAULT_LONGITUDE = -47.93371;

// Throttle delay for weather coordinate updates (ms)
const WEATHER_THROTTLE_DELAY = 2000;

const ListingsBottomSheet: React.FC<{
  highlines: Highline[];
  hasFocusedMarker: boolean;
  isLoading: boolean;
}> = ({ highlines, hasFocusedMarker, isLoading }) => {
  const { top } = useSafeAreaInsets();
  const bottomSheetHandlerHeight = useMapStore(
    (state) => state.bottomSheetHandlerHeight,
  );
  const camera = useMapStore(
    useShallow((state) => state.camera),
  );
  const bottomSheetRef = React.useRef<BottomSheet>(null);
  const BottomSheetScrollView = useBottomSheetScrollableCreator();

  // Throttled weather coordinates - only update after camera has been stable
  const [throttledCoords, setThrottledCoords] = useState({
    latitude: camera?.center?.[1] ?? DEFAULT_LATITUDE,
    longitude: camera?.center?.[0] ?? DEFAULT_LONGITUDE,
  });

  // Throttle coordinate updates to prevent excessive API calls
  useEffect(() => {
    const latitude = camera?.center?.[1] ?? DEFAULT_LATITUDE;
    const longitude = camera?.center?.[0] ?? DEFAULT_LONGITUDE;

    const timeoutId = setTimeout(() => {
      setThrottledCoords({ latitude, longitude });
    }, WEATHER_THROTTLE_DELAY);

    return () => clearTimeout(timeoutId);
  }, [camera?.center]);

  // If the handler height is not yet measured, use 15% as an approximation of it's height
  const snapPoints = React.useMemo(() => {
    return [bottomSheetHandlerHeight || '15%', '100%'];
  }, [bottomSheetHandlerHeight]);

  const onShowMap = () => {
    bottomSheetRef.current?.collapse();
  };

  // Update index when hasFocusedMarker changes
  useEffect(() => {
    if (hasFocusedMarker) {
      bottomSheetRef.current?.collapse();
      return;
    }
    bottomSheetRef.current?.expand();
  }, [hasFocusedMarker]);

  const renderItem = useCallback(
    ({ item }: { item: Highline }) => <HighlineCard item={item} />,
    [],
  );

  const ListHeader = useCallback(() => (
    <View className="mb-2">
      <WeatherInfoCard
        latitude={throttledCoords.latitude}
        longitude={throttledCoords.longitude}
        compact
      />
    </View>
  ), [throttledCoords.latitude, throttledCoords.longitude]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      enableDynamicSizing={false}
      onChange={() => {
        Haptics.selectionAsync();
      }}
      handleComponent={() => (
        <CustomBottomSheetHandle
          highlineLength={highlines.length}
          isLoading={isLoading}
          weatherLatitude={throttledCoords.latitude}
          weatherLongitude={throttledCoords.longitude}
        />
      )}
      style={{
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: {
          width: 1,
          height: 1,
        },
      }}
      containerStyle={{
        marginTop: top,
      }}
    >
      {highlines.length > 0 && !hasFocusedMarker ? (
        <LegendList
          data={highlines}
          renderItem={renderItem}
          keyExtractor={(item: Highline) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderScrollComponent={BottomSheetScrollView}
          ListHeaderComponent={ListHeader}
        />
      ) : null}
      <MapToggle onPress={onShowMap} />
    </BottomSheet>
  );
};

const CustomBottomSheetHandle: React.FC<{
  highlineLength: number;
  isLoading: boolean;
  weatherLatitude: number;
  weatherLongitude: number;
}> = ({ highlineLength, isLoading, weatherLatitude, weatherLongitude }) => {
  const setBottomSheetHandlerHeight = useMapStore(
    (state) => state.setBottomSheeHandlerHeight,
  );

  return (
    <View
      onLayout={(e) => {
        setBottomSheetHandlerHeight(e.nativeEvent.layout.height);
      }}
      className="p-4 gap-2"
    >
      <View className="mx-auto w-10 h-1 bg-muted-foreground rounded-md" />
      <View className="flex-row justify-between items-center w-full">
        <View className="flex-row items-center gap-1">
          <Animated.Text
            layout={_layoutAnimation}
            className={cn(
              'text-center font-extrabold text-3xl tabular-nums',
              isLoading ? 'text-muted-foreground' : 'text-primary',
            )}
          >
            {isLoading ? <ActivityIndicator /> : highlineLength}
          </Animated.Text>
          <Animated.Text
            layout={_layoutAnimation}
            key={'highline-label'}
            className={cn(
              'text-center font-extrabold text-3xl',
              isLoading ? 'text-muted-foreground' : 'text-primary',
            )}
          >
            highline{highlineLength === 1 ? '' : 's'}
          </Animated.Text>
        </View>
        <View className="flex-row items-center gap-3">
          <WeatherSummary
            latitude={weatherLatitude}
            longitude={weatherLongitude}
          />
          <AddHighlineButton />
        </View>
      </View>
    </View>
  );
};

const AddHighlineButton: React.FC = () => {
  const router = useRouter();
  const camera = useMapStore((state) => state.camera);

  return (
    <Button
      size="icon"
      className="rounded-full"
      onPress={() => {
        router.push(
          `/location-picker?lat=${camera.center[1]}&lng=${camera.center[0]}&zoom=${camera.zoom}`,
        );
      }}
    >
      <Icon as={PlusIcon} className="size-5 text-primary-foreground" />
    </Button>
  );
};

export default ListingsBottomSheet;

