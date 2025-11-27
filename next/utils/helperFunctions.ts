import { type LatLng } from "leaflet";
import { ReadonlyURLSearchParams } from "next/navigation";

import type { Point } from "@/utils/supabase/database.types";

export function transformTimeStringToSeconds(timeString: string): number {
  const [minutes, seconds] = timeString.split(":").map(Number);
  const totalSeconds = minutes * 60 + seconds;
  return totalSeconds;
}

export function transformSecondsToTimeString(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeString = `${padZero(minutes)}:${padZero(seconds)}`;
  return timeString;
}

function padZero(num: number): string {
  return num.toString().padStart(2, "0");
}

export const createUrl = (
  pathname: string,
  params: URLSearchParams | ReadonlyURLSearchParams,
) => {
  const paramsString = params.toString();
  const queryString = `${paramsString.length ? "?" : ""}${paramsString}`;

  return `${pathname}${queryString}`;
};

export const postgisPointFromLatLng = (lat: number, lng: number): Point => {
  return `POINT(${lng} ${lat})`;
};

export function encodeLocation(anchorA: LatLng, anchorB: LatLng) {
  return `a_${anchorA.lat},${anchorA.lng}b_${anchorB.lat},${anchorB.lng}`;
}

export function getDistance({
  anchorA,
  anchorB,
}: {
  anchorA: LatLng;
  anchorB: LatLng;
}) {
  return Math.round(anchorA.distanceTo(anchorB));
}

export function decodeLocation(location: string): string[] {
  const regex =
    /a_([-+]?\d*\.?\d+),([-+]?\d*\.?\d+)b_([-+]?\d*\.?\d+),([-+]?\d*\.?\d+)/;
  const match = location.match(regex);

  if (match) {
    return [...match];
  } else {
    throw new Error("Invalid location format");
  }
}

export function locationToPostGISPoint(location: {
  lat: number;
  lng: number;
}): `POINT(${number} ${number})` {
  return `POINT(${location.lng} ${location.lat})`;
}
