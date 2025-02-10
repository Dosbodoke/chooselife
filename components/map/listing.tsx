import {
  BottomSheetVirtualizedList,
  BottomSheetVirtualizedListMethods,
} from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useAtomValue } from 'jotai';
import React from 'react';
import { View } from 'react-native';

import type { Highline } from '~/hooks/use-highline';

import { HighlineCard } from '~/components/highline/highline-card';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

import { cameraStateAtom } from './utils';

const Listings: React.FC<{
  highlines: Highline[];
  refresh: number;
  isLoading: boolean;
}> = ({ highlines, refresh, isLoading }) => {
  const listRef = React.useRef<BottomSheetVirtualizedListMethods>(null);

  // Update the view to scroll the list back top
  React.useEffect(() => {
    if (refresh) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [refresh]);

  const renderItem = React.useCallback(
    ({ item }: { item: Highline }) => <HighlineCard item={item} />,
    [],
  );

  return (
    <BottomSheetVirtualizedList<Highline>
      data={highlines}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      getItemCount={(data) => data.length}
      getItem={(data, index) => data[index]}
      ref={listRef}
      ListHeaderComponent={
        <View className="flex-row justify-between items-center px-4">
          <Text className="text-center text-2xl font-bold text-primary">
            {isLoading
              ? 'procurando highlines...'
              : `${highlines.length} highlines`}
          </Text>

          <AddHighlineButton />
        </View>
      }
    />
  );
};

const AddHighlineButton: React.FC = () => {
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
      <Text>Adicionar</Text>
    </Button>
  );
};

export default Listings;
