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
    <View className="absolute right-2 top-6 rounded-md bg-card">
      <TouchableOpacity
        className="h-12 w-12 items-center justify-center"
        onPress={goToMyLocation}
      >
        {isOnMyLocation ? (
          <LucideIcon
            name="LocateFixed"
            className="w-6 h-6 text-black"
            strokeWidth={2}
          />
        ) : (
          <LucideIcon
            name="Locate"
            className="w-6 h-6 text-black"
            strokeWidth={2}
          />
        )}
      </TouchableOpacity>

      <View className="w-full h-px bg-muted"></View>

      <TouchableOpacity
        onPress={() =>
          setMapType((old) => (old === 'standard' ? 'satellite' : 'standard'))
        }
        className="size-12 items-center justify-center"
      >
        <LucideIcon
          name={mapType === 'standard' ? 'Map' : 'Satellite'}
          className="w-6 h-6 text-black"
          strokeWidth={2}
        />
      </TouchableOpacity>
    </View>
  );
};

export default MapControls;
