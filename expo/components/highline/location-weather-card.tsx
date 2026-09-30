import type { RigStatuses } from '@chooselife/ui';
import { useNetInfo } from '@react-native-community/netinfo';
import { useMapStore } from '~/store/map-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPinIcon, PencilIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { WeatherInfoCard } from '~/components/map/weather-info-card';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

import { LocationMapCard } from './location-map-card';

interface LocationWeatherCardProps {
  hasLocation: boolean;
  latitude?: number;
  longitude?: number;
  anchorB?: [number, number];
  name: string;
  status: RigStatuses | null;
}

const EmptyLocationState: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isConnected } = useNetInfo();
  const requestLocationPicker = useMapStore(
    (state) => state.requestLocationPicker,
  );

  const openLocationPicker = () => {
    if (isConnected === false || !id) return;
    requestLocationPicker({
      kind: 'edit',
      highlineId: id,
      anchorA: null,
      anchorB: null,
    });
    router.push('/(tabs)');
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={openLocationPicker}
      disabled={isConnected === false}
      className="bg-white rounded-2xl p-6 items-center justify-center disabled:opacity-50"
    >
      <View className="size-16 rounded-full bg-gray-100 items-center justify-center mb-4">
        <Icon as={MapPinIcon} className="size-8 text-muted-foreground" />
      </View>
      <Text className="text-lg font-semibold text-foreground mb-1">
        {t('components.highline.location-weather-card.noLocation')}
      </Text>
      <Text className="text-sm text-muted-foreground text-center">
        {isConnected === false
          ? t('components.highline.location-weather-card.offlineEdit')
          : t('components.highline.location-weather-card.addLocationHint')}
      </Text>
    </TouchableOpacity>
  );
};

const EditLocationButton: React.FC<{
  highlineId: string;
  anchorA: [number, number];
  anchorB: [number, number] | null;
}> = ({ highlineId, anchorA, anchorB }) => {
  const { t } = useTranslation();
  const { isConnected } = useNetInfo();
  const router = useRouter();
  const requestLocationPicker = useMapStore(
    (state) => state.requestLocationPicker,
  );

  const openLocationPicker = () => {
    if (isConnected === false) return;
    requestLocationPicker({
      kind: 'edit',
      highlineId,
      anchorA,
      anchorB,
    });
    router.push('/(tabs)');
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={openLocationPicker}
      disabled={isConnected === false}
      className="flex-row items-center justify-center gap-2 rounded-2xl bg-white p-4 disabled:opacity-50"
    >
      <Icon as={PencilIcon} className="size-5 text-blue-500" />
      <Text className="text-base font-medium text-foreground">
        {t('components.highline.location-weather-card.editLocation')}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * Unified card combining location/map action and weather information.
 * Both features require coordinates, so they logically belong together.
 *
 * - If coordinates exist: Shows the map preview card + weather info
 * - If no coordinates: Shows empty state with "Add Location" action
 */
export const LocationWeatherCard: React.FC<LocationWeatherCardProps> = ({
  hasLocation,
  latitude,
  longitude,
  anchorB,
  name,
  status,
}) => {
  const { id } = useLocalSearchParams<{ id: string }>();

  // No location: show empty state
  if (!hasLocation || !latitude || !longitude) {
    return <EmptyLocationState />;
  }

  // Has location: show map + weather
  return (
    <View className="gap-3">
      <LocationMapCard
        highlineId={id}
        name={name}
        anchorA={[longitude, latitude]}
        anchorB={anchorB}
        status={status}
      />
      <EditLocationButton
        highlineId={id}
        anchorA={[longitude, latitude]}
        anchorB={anchorB ?? null}
      />
      <View className="bg-white rounded-2xl overflow-hidden">
        <WeatherInfoCard latitude={latitude} longitude={longitude} />
      </View>
    </View>
  );
};
