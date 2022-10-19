import { BBox } from 'geojson';
import { Region } from 'react-native-maps';

export const regionToBoundingBox = (region: Region): BBox => {
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

export const toRad = (number: number) => (number * Math.PI) / 180;

export const toDeg = (rad: number) => rad * (180 / Math.PI);
