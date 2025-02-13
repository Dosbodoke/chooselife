import BottomSheet, {
  BottomSheetFlashList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { atom } from 'jotai';
import { useAtomValue, useSetAtom } from 'jotai/react';
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { type Highline } from '~/hooks/use-highline';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

import { HighlineCard } from '../highline/highline-card';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { cameraStateAtom } from './utils';

// Keep track of the handle height so the Highlited marker card can be positioned correctly and the minimum snap point fits only the handler
export const bottomSheetHandlerHeightAtom = atom<number>(0);

const ListingsBottomSheet: React.FC<{
  highlines: Highline[];
  hasFocusedMarker: boolean;
  isLoading: boolean;
}> = ({ highlines, hasFocusedMarker, isLoading }) => {
  const { t } = useTranslation();
  const headerHeight = useAtomValue(bottomSheetHandlerHeightAtom);

  // If the handler height is not yet measured, use 15% as an approximation of it's height
  const snapPoints = useMemo(() => {
    return [headerHeight > 0 ? headerHeight : '15%', '100%'];
  }, [headerHeight]);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const onShowMap = () => {
    bottomSheetRef.current?.collapse();
  };

  const renderItem = React.useCallback(
    ({ item }: { item: Highline }) => <HighlineCard item={item} />,
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={hasFocusedMarker ? 0 : 1}
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
    >
      <BottomSheetView className="flex-1 bg-background">
        {highlines.length > 0 && !hasFocusedMarker ? (
          <BottomSheetFlashList<Highline>
            data={highlines}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            estimatedItemSize={390}
          />
        ) : null}
        <View className="absolute bottom-6 w-full items-center">
          <TouchableOpacity
            onPress={onShowMap}
            className="bg-primary p-3 h-12 rounded-3xl flex gap-2 flex-row my-auto items-center"
          >
            <Text className="text-primary-foreground">
              {t('components.map.bottom-sheet.map')}
            </Text>
            <LucideIcon
              name="Map"
              className="h-6 w-6 text-primary-foreground"
            />
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
};

const CustomBottomSheetHandle: React.FC<{
  highlineLength: number;
  isLoading: boolean;
}> = ({ highlineLength, isLoading }) => {
  const { t } = useTranslation();

  const setBottomSheetHandlerHeight = useSetAtom(bottomSheetHandlerHeightAtom);

  return (
    <View
      onLayout={(e) => {
        setBottomSheetHandlerHeight(e.nativeEvent.layout.height);
      }}
      className="p-4 bg-white items-center gap-2"
    >
      <View className="w-10 h-1 bg-muted-foreground rounded-md"></View>
      <View className="flex-row justify-between items-center w-full">
        <Text
          className={cn(
            'text-center font-bold text-2xl',
            isLoading ? 'text-muted-foreground' : 'text-primary',
          )}
        >
          {isLoading
            ? t('components.map.bottom-sheet.loadingHighlines')
            : `${highlineLength} highlines`}
        </Text>
        <AddHighlineButton />
      </View>
    </View>
  );
};

const AddHighlineButton: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const atomValue = useAtomValue(cameraStateAtom);

  return (
    <Button
      onPress={() => {
        router.push(
          `/register-highline?lat=${atomValue.center[1]}&lng=${atomValue.center[0]}&zoom=${atomValue.zoom}`,
        );
      }}
    >
      <Text>{t('components.map.bottom-sheet.add')}</Text>
    </Button>
  );
};

export default ListingsBottomSheet;
