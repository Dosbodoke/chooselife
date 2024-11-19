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

export const calculateZoomLevel = (latitudeDelta: number): number => {
  return Math.round(Math.log2(360 / latitudeDelta));
};

export function transformTimeStringToSeconds(timeString: string): number {
  const [minutes, seconds] = timeString.split(":").map(Number);
  const totalSeconds = minutes * 60 + seconds;
  return totalSeconds;
}

export function transformSecondsToTimeString(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const timeString = `${padZero(minutes)}:${padZero(seconds)}`
  return timeString
}

function padZero(num: number): string {
  return num.toString().padStart(2, "0")
}