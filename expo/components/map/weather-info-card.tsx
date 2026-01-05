import { useMapStore } from '~/store/map-store';
import type { LucideIcon } from 'lucide-react-native';
import {
  CloudIcon,
  DropletIcon,
  ThermometerIcon,
  WindIcon,
  XIcon,
} from 'lucide-react-native';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { useWeather } from '~/hooks/use-weather';
import { getWindDirection } from '~/types/weather';

import { Icon } from '~/components/ui/icon';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

interface WeatherInfoCardProps {
  latitude: number;
  longitude: number;
  onClose: () => void;
  locationName?: string;
}

export const WeatherInfoCard: React.FC<WeatherInfoCardProps> = ({
  latitude,
  longitude,
  onClose,
  locationName,
}) => {
  const bottomSheetHandlerHeight = useMapStore(
    (state) => state.bottomSheetHandlerHeight,
  );

  const { data: weather, isLoading, error } = useWeather({ latitude, longitude });

  if (error) {
    return null;
  }

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(15)}
      exiting={SlideOutDown.springify().damping(15)}
      style={{
        position: 'absolute',
        bottom: bottomSheetHandlerHeight + 8,
        left: 8,
        right: 8,
      }}
    >
      <View className="bg-card rounded-2xl p-4 shadow-lg border border-border">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1">
            {locationName && (
              <Text className="text-sm text-muted-foreground mb-0.5">
                {locationName}
              </Text>
            )}
            <Text className="text-xs text-muted-foreground">
              Weather Forecast
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="p-1 rounded-full bg-muted"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon as={XIcon} className="size-4 text-muted-foreground" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <WeatherCardSkeleton />
        ) : weather ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
            {/* Main weather info */}
            <View className="flex-row items-center mb-4">
              <Text className="text-5xl mr-2">{weather.weatherIcon}</Text>
              <View className="flex-1">
                <Text className="text-3xl font-bold">
                  {Math.round(weather.temperature)}{weather.temperatureUnit}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {weather.weatherDescription}
                </Text>
              </View>
            </View>

            {/* Weather details grid */}
            <View className="flex-row flex-wrap gap-2">
              <WeatherDetailItem
                icon={WindIcon}
                label="Wind"
                value={`${Math.round(weather.windSpeed)} ${weather.windSpeedUnit}`}
                subvalue={getWindDirection(weather.windDirection)}
              />
              <WeatherDetailItem
                icon={DropletIcon}
                label="Humidity"
                value={`${weather.humidity}%`}
              />
              <WeatherDetailItem
                icon={CloudIcon}
                label="Precipitation"
                value={`${weather.precipitation} ${weather.precipitationUnit}`}
              />
              <WeatherDetailItem
                icon={ThermometerIcon}
                label="Gusts"
                value={`${Math.round(weather.windGusts)} ${weather.windSpeedUnit}`}
              />
            </View>

            {/* Elevation info */}
            <Text className="text-xs text-muted-foreground mt-3 text-center">
              Elevation: {weather.elevation}m • Data: Open-Meteo
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
};

const WeatherDetailItem: React.FC<{
  icon: LucideIcon;
  label: string;
  value: string;
  subvalue?: string;
}> = ({ icon, label, value, subvalue }) => (
  <View className="flex-row items-center bg-muted/50 rounded-lg px-3 py-2 min-w-[45%] flex-1">
    <Icon as={icon} className="size-4 text-muted-foreground mr-2" />
    <View>
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <View className="flex-row items-center gap-1">
        <Text className="text-sm font-medium">{value}</Text>
        {subvalue && (
          <Text className="text-xs text-muted-foreground">({subvalue})</Text>
        )}
      </View>
    </View>
  </View>
);

const WeatherCardSkeleton: React.FC = () => (
  <View>
    <View className="flex-row items-center mb-4">
      <Skeleton className="size-12 rounded-full mr-2" />
      <View>
        <Skeleton className="h-8 w-24 mb-1" />
        <Skeleton className="h-4 w-32" />
      </View>
    </View>
    <View className="flex-row flex-wrap gap-2">
      <Skeleton className="h-14 flex-1 min-w-[45%] rounded-lg" />
      <Skeleton className="h-14 flex-1 min-w-[45%] rounded-lg" />
      <Skeleton className="h-14 flex-1 min-w-[45%] rounded-lg" />
      <Skeleton className="h-14 flex-1 min-w-[45%] rounded-lg" />
    </View>
  </View>
);
