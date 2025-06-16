import { useMapStore } from '~/store/map-store';
import type React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LucideIcon } from '~/lib/icons/lucide-icon';

type MapType = 'satellite' | 'standard';

const MapControls: React.FC<{
  mapType: MapType;
  isOnMyLocation: boolean;
  goToMyLocation: () => void;
  setMapType: (newMapType: MapType) => Promise<void>;
}> = ({ mapType, isOnMyLocation, goToMyLocation, setMapType }) => {
  const exploreHeaderHeight = useMapStore((state) => state.exploreHeaderHeight);
  const insetTop = useSafeAreaInsets().top;

  return (
    <View
      className="absolute right-2 rounded-lg bg-card p-2"
      style={{ top: exploreHeaderHeight + insetTop + 16 }}
    >
      <TouchableOpacity
        className="p-1 items-center justify-center pb-2"
        onPress={goToMyLocation}
      >
        <LucideIcon
          name={isOnMyLocation ? 'LocateFixed' : 'Locate'}
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
        <LucideIcon
          name={mapType === 'standard' ? 'Map' : 'Satellite'}
          className="size-6 text-black"
          strokeWidth={2}
        />
      </TouchableOpacity>
    </View>
  );
};

export default MapControls;
