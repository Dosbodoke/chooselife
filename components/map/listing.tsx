import { View, Text } from "react-native";
import { useEffect, useRef } from "react";
import {
  BottomSheetFlatList,
  BottomSheetFlatListMethods,
} from "@gorhom/bottom-sheet";

import type { Highline } from "~/hooks/use-highline";
import { HighlineCard } from "../highline/highline-card";

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
          <Text className="text-center text-lg mt-1 text-primary">
            {isLoading
              ? "procurando highlines..."
              : `${highlines.length} highlines`}
          </Text>
        }
      />
    </View>
  );
};

export default Listings;
