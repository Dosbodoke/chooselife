import Mapbox from "@rnmapbox/maps";
import { BBox, Position } from "geojson";
import { atom } from "jotai";
import { Highline } from "~/hooks/use-highline";
import { Point } from "~/utils/database.types";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_KEY!);

const INITIAL_REGION = {
  latitude: -15.7782081,
  longitude: -47.93371,
  latitudeDelta: 80,
  longitudeDelta: 80,
};

export const DEFAULT_LATITUDE = INITIAL_REGION.latitude;
export const DEFAULT_LONGITUDE = INITIAL_REGION.longitude;
export const DEFAULT_ZOOM = 12;
export const MIN_CLUSTER_SIZE = 30;

export const regionToBoundingBox = (region: typeof INITIAL_REGION): BBox => {
  let lngD: number;
  if (region.longitudeDelta < 0) lngD = region.longitudeDelta + 360;
  else lngD = region.longitudeDelta;

  return [
    region.longitude - lngD, // westLng - min lng
    region.latitude - region.latitudeDelta, // southLat - min lat
    region.longitude + lngD, // eastLng - max lng
    region.latitude + region.latitudeDelta, // northLat - max lat
  ];
};

export const cameraStateAtom = atom<
  { zoom: number; center: Position; bounds: BBox }
>({
  zoom: DEFAULT_ZOOM,
  center: [
    DEFAULT_LONGITUDE,
    DEFAULT_LATITUDE,
  ],
  bounds: regionToBoundingBox(INITIAL_REGION),
});

export const highlightedMarkerAtom = atom<Highline | null>(null);
export const clusterMarkersAtom = atom<Highline[]>([]);

export const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371e3; // Earth radius in meters
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export function positionToPostGISPoint(
  position: Position,
): `POINT(${number} ${number})` {
  return `POINT(${position[0]} ${position[1]})`; // POINT(longitude, latitude)
}

export function postGISPointToPosition(point: Point): [number, number] {
  const match = point.match(/^POINT\(([-\d.]+) ([-\d.]+)\)$/);
  if (!match) {
    throw new Error(`Invalid PostGIS point format: ${point}`);
  }
  const [, lon, lat] = match;
  return [parseFloat(lon), parseFloat(lat)];
}
