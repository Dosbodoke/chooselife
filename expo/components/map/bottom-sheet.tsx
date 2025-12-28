import BottomSheet, {
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { LegendList } from '@legendapp/list';
import { useMapStore } from '~/store/map-store';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Highline } from '~/hooks/use-highline';
import { cn } from '~/lib/utils';
import { _layoutAnimation } from '~/utils/constants';

import { HighlineCard } from '../highline/highline-card';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { MapToggle } from './map-toggle';

const ListingsBottomSheet: React.FC<{
  highlines: Highline[];
  hasFocusedMarker: boolean;
  isLoading: boolean;
}> = ({ highlines, hasFocusedMarker, isLoading }) => {
  const { top } = useSafeAreaInsets();
  const bottomSheetHandlerHeight = useMapStore(
    (state) => state.bottomSheetHandlerHeight,
  );
  const bottomSheetRef = React.useRef<BottomSheet>(null);
  const BottomSheetScrollView = useBottomSheetScrollableCreator();

  // If the handler height is not yet measured, use 15% as an approximation of it's height
  const snapPoints = React.useMemo(() => {
    return [bottomSheetHandlerHeight || '15%', '100%'];
  }, [bottomSheetHandlerHeight]);

  const onShowMap = () => {
    bottomSheetRef.current?.collapse();
  };

  // Update index when hasFocusedMarker changes
  React.useEffect(() => {
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
        />
      ) : null}
      <MapToggle onPress={onShowMap} />
    </BottomSheet>
  );
};

const CustomBottomSheetHandle: React.FC<{
  highlineLength: number;
  isLoading: boolean;
}> = ({ highlineLength, isLoading }) => {
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
        <AddHighlineButton />
      </View>
    </View>
  );
};

const AddHighlineButton: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const camera = useMapStore((state) => state.camera);

  return (
    <Button
      onPress={() => {
        router.push(
          `/location-picker?lat=${camera.center[1]}&lng=${camera.center[0]}&zoom=${camera.zoom}`,
        );
      }}
    >
      <Text>{t('components.map.bottom-sheet.add')}</Text>
    </Button>
  );
};

export default ListingsBottomSheet;
