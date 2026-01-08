import type { LucideIcon } from 'lucide-react-native';
import {
  CloudIcon,
  DropletIcon,
  ThermometerIcon,
  WindIcon,
} from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useWeather } from '~/hooks/use-weather';
import { getWindDirection, type WeatherData } from '~/types/weather';

import { Icon } from '~/components/ui/icon';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

// ============================================================================
// Types
// ============================================================================

interface WeatherInfoCardProps {
  latitude: number;
  longitude: number;
  locationName?: string;
  /** If true, shows only the weather details grid without header, temperature, or elevation */
  compact?: boolean;
}

interface WeatherSummaryProps {
  latitude: number;
  longitude: number;
}

interface WeatherDetailItemProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subvalue?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

const WeatherDetailItem: React.FC<WeatherDetailItemProps> = ({
  icon,
  label,
  value,
  subvalue,
}) => (
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

const WeatherDataDisplay: React.FC<{ weather: WeatherData; compact?: boolean }> = ({ weather, compact = false }) => {
  const { t } = useTranslation();
  
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
      {/* Main weather info - hidden in compact mode */}
      {!compact && (
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
      )}

      {/* Weather details grid */}
      <View className="flex-row flex-wrap gap-2">
        <WeatherDetailItem
          icon={WindIcon}
          label={t('components.weather-card.wind')}
          value={`${Math.round(weather.windSpeed)} ${weather.windSpeedUnit}`}
          subvalue={getWindDirection(weather.windDirection)}
        />
        <WeatherDetailItem
          icon={DropletIcon}
          label={t('components.weather-card.humidity')}
          value={`${weather.humidity}%`}
        />
        <WeatherDetailItem
          icon={CloudIcon}
          label={t('components.weather-card.precipitation')}
          value={`${weather.precipitation} ${weather.precipitationUnit}`}
        />
        <WeatherDetailItem
          icon={ThermometerIcon}
          label={t('components.weather-card.gusts')}
          value={`${Math.round(weather.windGusts)} ${weather.windSpeedUnit}`}
        />
      </View>

      {/* Elevation info - hidden in compact mode */}
      {!compact && (
        <Text className="text-xs text-muted-foreground mt-3 text-center">
          {t('components.weather-card.elevation')}: {weather.elevation}m • {t('components.weather-card.dataSource')}
        </Text>
      )}
    </Animated.View>
  );
};

interface WeatherCardContentProps {
  weather: WeatherData | undefined;
  isLoading: boolean;
  locationName?: string;
  compact?: boolean;
}

const WeatherCardContent: React.FC<WeatherCardContentProps> = ({
  weather,
  isLoading,
  locationName,
  compact = false,
}) => {
  const { t } = useTranslation();
  
  return (
    <View className={compact ? "py-2" : "bg-card rounded-2xl p-4 border border-border"}>
      {/* Header - hidden in compact mode */}
      {!compact && (
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1">
            {locationName && (
              <Text className="text-sm text-muted-foreground mb-0.5">
                {locationName}
              </Text>
            )}
            <Text className="text-xs text-muted-foreground">
              {t('components.weather-card.title')}
            </Text>
          </View>
        </View>
      )}

      {isLoading ? (
        <WeatherCardSkeleton />
      ) : weather ? (
        <WeatherDataDisplay weather={weather} compact={compact} />
      ) : null}
    </View>
  );
};

// ============================================================================
// Main Components
// ============================================================================

/**
 * Compact weather summary showing just the emoji and temperature.
 * Perfect for displaying in headers or small spaces.
 */
export const WeatherSummary: React.FC<WeatherSummaryProps> = ({
  latitude,
  longitude,
}) => {
  const { data: weather, isLoading, error } = useWeather({ latitude, longitude });

  if (error) {
    return null;
  }

  if (isLoading) {
    return (
      <View className="flex-row items-center gap-1">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-5 w-10 rounded" />
      </View>
    );
  }

  if (!weather) {
    return null;
  }

  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      className="flex-row items-center gap-1"
    >
      <Text className="text-xl">{weather.weatherIcon}</Text>
      <Text className="text-lg font-semibold">
        {Math.round(weather.temperature)}{weather.temperatureUnit}
      </Text>
    </Animated.View>
  );
};

/**
 * Full weather info card with all details.
 * Renders inline as a normal card in the content flow.
 * When compact=true, shows only the details grid without header, temp, or elevation.
 */
export const WeatherInfoCard: React.FC<WeatherInfoCardProps> = ({
  latitude,
  longitude,
  locationName,
  compact = false,
}) => {
  const { data: weather, isLoading, error } = useWeather({ latitude, longitude });

  if (error) {
    return null;
  }

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <WeatherCardContent
        weather={weather}
        isLoading={isLoading}
        locationName={locationName}
        compact={compact}
      />
    </Animated.View>
  );
};
