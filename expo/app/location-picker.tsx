import type { AnchorPosition } from '~/features/highline-registration/state/model';
import { useMapStore } from '~/store/map-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useMountEffect } from '~/hooks/use-mount-effect';

/**
 * Compatibility bridge for old deep links. New picker sessions are rendered
 * inside the already-mounted ExploreMap; this route only hands legacy params
 * to that mode and returns to the map.
 */
export default function LegacyLocationPickerRoute() {
  const router = useRouter();
  const { editHighlineId, lat, lng, zoom } = useLocalSearchParams<{
    editHighlineId?: string;
    lat?: string;
    lng?: string;
    zoom?: string;
  }>();
  const requestLocationPicker = useMapStore(
    (state) => state.requestLocationPicker,
  );

  useMountEffect(() => {
    if (editHighlineId) {
      requestLocationPicker({
        kind: 'edit',
        highlineId: editHighlineId,
        anchorA: null,
        anchorB: null,
      });
    } else {
      const latitude = lat ? Number(lat) : Number.NaN;
      const longitude = lng ? Number(lng) : Number.NaN;
      const zoomLevel = zoom ? Number(zoom) : Number.NaN;
      const center =
        Number.isFinite(longitude) && Number.isFinite(latitude)
          ? ([longitude, latitude] as AnchorPosition)
          : undefined;

      requestLocationPicker({
        kind: 'new',
        center,
        zoom: Number.isFinite(zoomLevel) ? zoomLevel : undefined,
      });
    }

    router.replace('/(tabs)');
  });

  return <View className="flex-1" />;
}
