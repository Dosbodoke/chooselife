import {
  BoxIcon,
  LocateFixedIcon,
  LocateIcon,
  MapIcon,
  SatelliteIcon,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '~/components/ui/icon';

type MapType = 'satellite' | 'standard';

const MapControls: React.FC<{
  mapType: MapType;
  isOnMyLocation: boolean;
  goToMyLocation: () => void;
  setMapType: (newMapType: MapType) => Promise<void>;
}> = React.memo(({ mapType, isOnMyLocation, goToMyLocation, setMapType }) => {
  const insetTop = useSafeAreaInsets().top;
  const router = useRouter();

  return (
    <View
      className="absolute right-2 rounded-lg bg-card p-2"
      style={{ top: insetTop + 16 }}
    >
      <TouchableOpacity
        className="p-1 items-center justify-center pb-2"
        onPress={goToMyLocation}
      >
        <Icon
          as={isOnMyLocation ? LocateFixedIcon : LocateIcon}
          className="size-6 text-black"
          strokeWidth={2}
        />
      </TouchableOpacity>

      <View className="w-full h-px bg-muted-foreground" />

      <TouchableOpacity
        className="p-1 items-center justify-center pt-2"
        onPress={() =>
          setMapType(mapType === 'standard' ? 'satellite' : 'standard')
        }
      >
        <Icon
          as={mapType === 'standard' ? MapIcon : SatelliteIcon}
          className="size-6 text-black"
          strokeWidth={2}
        />
      </TouchableOpacity>

      <View className="w-full h-px bg-muted-foreground" />

      <TouchableOpacity
        className="p-1 items-center justify-center pt-2"
        accessibilityRole="button"
        accessibilityLabel="View Morro do Macaco in 3D"
        onPress={() => router.push('/morro-do-macaco')}
      >
        <Icon as={BoxIcon} className="size-6 text-black" strokeWidth={2} />
        <Text className="text-xs text-black">3D</Text>
      </TouchableOpacity>
    </View>
  );
});

MapControls.displayName = 'MapControls';

export default MapControls;
