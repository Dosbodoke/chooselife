import { CrosshairIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { Icon } from '~/components/ui/icon';
import { useMapStore } from '~/store/map-store';

/**
 * WeatherCrosshair - A centered crosshair that indicates where the weather data is coming from.
 * Similar to Windy app's center pointer.
 */
const WeatherCrosshair: React.FC = () => {
  const bottomSheetHandlerHeight = useMapStore(
    (state) => state.bottomSheetHandlerHeight,
  );

  return (
    <View 
      className="absolute inset-0 justify-center items-center" 
      pointerEvents="none"
    >
      <View style={{ marginBottom: bottomSheetHandlerHeight / 2 }}>
        <Icon
          as={CrosshairIcon}
          className="size-8 text-red-500 opacity-90"
          strokeWidth={2}
        />
      </View>
    </View>
  );
};

export default WeatherCrosshair;
