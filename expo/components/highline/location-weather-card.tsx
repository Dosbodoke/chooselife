import { Link, useLocalSearchParams } from 'expo-router';
import { MapPinIcon, NavigationIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { useHighline } from '~/hooks/use-highline';

import { WeatherInfoCard } from '~/components/map/weather-info-card';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

// ============================================================================
// Types
// ============================================================================

interface LocationWeatherCardProps {
  hasLocation: boolean;
  latitude?: number;
  longitude?: number;
}

// ============================================================================
// Empty State Component
// ============================================================================

const EmptyLocationState: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Link href={`/highline/${id}/edit`} asChild>
      <TouchableOpacity
        activeOpacity={0.7}
        className="bg-white rounded-2xl p-6 items-center justify-center"
      >
        <View className="size-16 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Icon as={MapPinIcon} className="size-8 text-muted-foreground" />
        </View>
        <Text className="text-lg font-semibold text-foreground mb-1">
          {t('components.highline.location-weather-card.noLocation')}
        </Text>
        <Text className="text-sm text-muted-foreground text-center">
          {t('components.highline.location-weather-card.addLocationHint')}
        </Text>
      </TouchableOpacity>
    </Link>
  );
};

// ============================================================================
// Location Action Button
// ============================================================================

const ViewOnMapButton: React.FC<{ highlineId: string }> = ({ highlineId }) => {
  const { t } = useTranslation();

  return (
    <Link
      href={{ pathname: '/(tabs)', params: { focusedMarker: highlineId } }}
      asChild
    >
      <TouchableOpacity
        activeOpacity={0.7}
        className="flex-row items-center bg-white rounded-2xl p-4"
      >
        <View className="size-10 rounded-full bg-blue-50 items-center justify-center mr-3">
          <Icon as={NavigationIcon} className="size-5 text-blue-500" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-medium text-foreground">
            {t('components.highline.location-weather-card.viewOnMap')}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {t('components.highline.location-weather-card.openInExplorer')}
          </Text>
        </View>
        <Icon as={NavigationIcon} className="size-5 text-muted-foreground/60" />
      </TouchableOpacity>
    </Link>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Unified card combining location/map action and weather information.
 * Both features require coordinates, so they logically belong together.
 *
 * - If coordinates exist: Shows "View on Map" action + compact weather info
 * - If no coordinates: Shows empty state with "Add Location" action
 */
export const LocationWeatherCard: React.FC<LocationWeatherCardProps> = ({
  hasLocation,
  latitude,
  longitude,
}) => {
  const { id } = useLocalSearchParams<{ id: string }>();

  // No location: show empty state
  if (!hasLocation || !latitude || !longitude) {
    return <EmptyLocationState />;
  }

  // Has location: show map action + weather
  return (
    <View className="gap-3">
      <ViewOnMapButton highlineId={id} />
      <View className="bg-white rounded-2xl overflow-hidden">
        <WeatherInfoCard latitude={latitude} longitude={longitude} />
      </View>
    </View>
  );
};
