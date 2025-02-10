import {
  BottomSheetFlatList,
  BottomSheetFlatListMethods,
} from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';
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
  const listRef = useRef<BottomSheetFlatListMethods>(null);

  // Update the view to scroll the list back top
  useEffect(() => {
    if (refresh) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [refresh]);

  return (
    <View className="flex-1">
      <BottomSheetFlatList
        renderItem={({ item }) => <HighlineCard item={item} />}
        data={highlines}
        keyExtractor={(item) => item.id}
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
    </View>
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
