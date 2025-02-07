import {
  BottomSheetFlatList,
  BottomSheetFlatListMethods,
} from '@gorhom/bottom-sheet';
import { Link } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import type { Highline } from '~/hooks/use-highline';

import { HighlineCard } from '~/components/highline/highline-card';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

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

            <Link asChild href="/register-highline">
              <Button>
                <Text>Adicionar</Text>
              </Button>
            </Link>
          </View>
        }
      />
    </View>
  );
};

export default Listings;
