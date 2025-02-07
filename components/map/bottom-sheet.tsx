import BottomSheet from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

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
  const snapPoints = useMemo(() => ['13%', '100%'], []);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [refresh, setRefresh] = useState<number>(0);

  const onShowMap = () => {
    bottomSheetRef.current?.collapse();
    setRefresh(refresh + 1);
  };

  const animatedIndex = useSharedValue(hasFocusedMarker ? 0 : 1);

  const animatedStyle = useAnimatedStyle(() => {
    const radius = interpolate(
      animatedIndex.value,
      [0, 1], // Snap point indices (0: 13%, 1: 100%)
      [20, 0], // Border radius values (20px when collapsed, 0px when expanded)
      { extrapolateRight: 'clamp' },
    );

    return {
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
    };
  });

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={hasFocusedMarker ? 0 : 1}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      onAnimate={(_, to) => animatedIndex.set(to)}
      onChange={() => {
        Haptics.selectionAsync();
      }}
      handleIndicatorStyle={{
        backgroundColor: colorScheme === 'light' ? '#71717A' : '#A1A1AA',
      }}
      handleStyle={{
        backgroundColor: colorScheme === 'light' ? '#FFF' : '#09090B',
      }}
      style={[
        {
          overflow: 'hidden',
          elevation: 4,
          shadowColor: colorScheme === 'light' ? '#000' : '#f8fafc',
          shadowOpacity: 0.3,
          shadowRadius: 4,
          shadowOffset: {
            width: 1,
            height: 1,
          },
        },
        animatedStyle,
      ]}
      containerStyle={animatedStyle}
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
