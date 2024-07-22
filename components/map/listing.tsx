import { View, Text } from "react-native";
import { useEffect, useRef } from "react";
import {
  BottomSheetFlatList,
  BottomSheetFlatListMethods,
} from "@gorhom/bottom-sheet";

import type { Highline } from "~/hooks/useHighline";
import { HighlineCard } from "../highline/highline-card";

interface Props {
  highlines: Highline[];
  refresh: number;
}

const Listings = ({ highlines, refresh }: Props) => {
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
        ref={listRef}
        ListHeaderComponent={
          <Text className="text-center text-lg mt-1 text-primary">
            {highlines.length} highlines
          </Text>
        }
      />
    </View>
  );
};

export default Listings;
