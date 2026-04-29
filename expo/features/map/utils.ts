import * as Location from 'expo-location';

import { Highline } from "~/hooks/use-highline";

export function getHighlineBounds(highline: Highline) {
  const ne: [number, number] = [
    Math.max(highline.anchor_a_long, highline.anchor_b_long),
    Math.max(highline.anchor_a_lat, highline.anchor_b_lat),
  ];
  const sw: [number, number] = [
    Math.min(highline.anchor_a_long, highline.anchor_b_long),
    Math.min(highline.anchor_a_lat, highline.anchor_b_lat),
  ];

  return { ne, sw };
}

export async function getMyLocation(): Promise<
  | {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    }
  | undefined
> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return;
    }

    let location;
    try {
      location = await Location.getCurrentPositionAsync({});
    } catch (error) {
      console.warn(
        'Error fetching current position, trying last known position',
        error,
      );
      location = await Location.getLastKnownPositionAsync({});
      if (!location) {
        throw new Error('Unable to obtain a location fix');
      }
    }

    const { latitude, longitude } = location.coords;
    return {
      latitude,
      longitude,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  } catch (error) {
    console.error('Error fetching location:', error);
    return;
  }
}
