import type React from 'react';
import { TouchableOpacity, View } from 'react-native';
import type { MapType } from 'react-native-maps';

import { LucideIcon } from '~/lib/icons/lucide-icon';

const MapControls: React.FC<{
  mapType: MapType;
  isOnMyLocation: boolean;
  goToMyLocation: () => void;
  setMapType: React.Dispatch<React.SetStateAction<MapType>>;
}> = ({ mapType, isOnMyLocation, goToMyLocation, setMapType }) => {
  return (
    <View className="absolute right-2 top-6 rounded-lg bg-card p-2">
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
          setMapType((old) => (old === 'standard' ? 'satellite' : 'standard'))
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
