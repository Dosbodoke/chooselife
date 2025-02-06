import BottomSheet from '@gorhom/bottom-sheet';
import { useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { type Highline } from '~/hooks/use-highline';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { useColorScheme } from '~/lib/useColorScheme';

import Listings from '~/components/map/listing';

// Bottom sheet that wraps our Listings component
const ListingsBottomSheet: React.FC<{
  highlines: Highline[];
  hasFocusedMarker: boolean;
  isLoading: boolean;
}> = ({ highlines, hasFocusedMarker, isLoading }) => {
  const { colorScheme } = useColorScheme();
  const snapPoints = useMemo(() => ['10%', '100%'], []);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [refresh, setRefresh] = useState<number>(0);

  const onShowMap = () => {
    bottomSheetRef.current?.collapse();
    setRefresh(refresh + 1);
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={hasFocusedMarker ? 0 : 1}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      handleIndicatorStyle={{
        backgroundColor: colorScheme === 'light' ? '#71717A' : '#A1A1AA',
      }}
      handleStyle={{
        backgroundColor: colorScheme === 'light' ? '#FFF' : '#09090B',
      }}
      style={{
        elevation: 4,
        shadowColor: colorScheme === 'light' ? '#000' : '#f8fafc',
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: {
          width: 1,
          height: 1,
        },
      }}
    >
      <View className="flex-1 bg-background">
        <Listings
          highlines={highlines}
          refresh={refresh}
          isLoading={isLoading}
        />
        <View className="absolute bottom-6 w-full items-center">
          <TouchableOpacity
            onPress={onShowMap}
            className="bg-primary p-3 h-12 rounded-3xl flex gap-2 flex-row my-auto items-center"
          >
            <Text className="text-primary-foreground">Mapa</Text>
            <LucideIcon
              name="Map"
              className="h-6 w-6 text-primary-foreground"
            />
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
};

export default ListingsBottomSheet;
