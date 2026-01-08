import BottomSheet, {
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { LegendList } from '@legendapp/list';
import { useMapStore } from '~/store/map-store';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Highline, useHighline } from '~/hooks/use-highline';

import { HighlineCard } from '../highline/highline-card';
import ExploreHeader from './explore-header';
import { MapToggle } from './map-toggle';

const ListingsBottomSheet: React.FC = () => {
  const { top } = useSafeAreaInsets();
  const bottomSheetHandlerHeight = useMapStore(
    (state) => state.bottomSheetHandlerHeight,
  );
  const searchQuery = useMapStore((state) => state.searchQuery);
  const activeCategory = useMapStore((state) => state.activeCategory);
  const hasFocusedMarker = useMapStore((state) => state.hasFocusedMarker);
  
  const bottomSheetRef = React.useRef<BottomSheet>(null);
  const BottomSheetScrollView = useBottomSheetScrollableCreator();

  const { highlines } = useHighline({ searchTerm: searchQuery, category: activeCategory });

  const snapPoints = React.useMemo(() => {
    return [bottomSheetHandlerHeight || '35%', '100%'];
  }, [bottomSheetHandlerHeight]);

  const onShowMap = () => bottomSheetRef.current?.collapse();

  const setExpandBottomSheet = useMapStore((state) => state.setExpandBottomSheet);
  useEffect(() => {
    setExpandBottomSheet(() => bottomSheetRef.current?.expand());
    return () => setExpandBottomSheet(null);
  }, [setExpandBottomSheet]);

  useEffect(() => {
    if (hasFocusedMarker) bottomSheetRef.current?.collapse();
  }, [hasFocusedMarker]);

  const renderItem = useCallback(
    ({ item }: { item: Highline }) => <HighlineCard item={item} />,
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
        borderRadius: 16
      }}
      containerStyle={{ marginTop: top }}
    >
      {highlines.length > 0 ? (
        <LegendList
          data={highlines}
          renderItem={renderItem}
          keyExtractor={(item: Highline) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderScrollComponent={BottomSheetScrollView}
          keyboardShouldPersistTaps="always"
          recycleItems
        />
      ) : null}
      <MapToggle onPress={onShowMap} />
    </BottomSheet>
  );
};

export default ListingsBottomSheet;
