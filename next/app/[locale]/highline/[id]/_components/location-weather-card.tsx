"use client";

import { getWindDirection, type RigStatuses, useWeather } from "@chooselife/ui";
import {
  CloudIcon,
  DropletIcon,
  type LucideIcon,
  MapIcon,
  MapPinIcon,
  NavigationIcon,
  ThermometerIcon,
  WindIcon,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import type { Highline } from "@/app/actions/getHighline";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";

/** `[longitude, latitude]` */
type Position = [number, number];

const MAP_WIDTH = 640;
const MAP_HEIGHT = 240;
const CAMERA_PADDING = 60;
/** Short lines would otherwise zoom past the point where tiles carry detail. */
const MAX_ZOOM = 17.5;

/** Same palette the app's explorer uses for line status. */
const lineStatusColor: Record<RigStatuses, string> = {
  planned: "ffd54f",
  rigged: "22C55E",
  unrigged: "f44336",
};

/**
 * Unified card combining the map preview and weather information. Both need
 * coordinates, so without them it becomes an "add location" call to action.
 */
export function LocationWeatherCard({ highline }: { highline: Highline }) {
  const { anchor_a_lat, anchor_a_long, anchor_b_lat, anchor_b_long } = highline;

  if (!anchor_a_lat || !anchor_a_long) {
    return <EmptyLocationState highlineId={highline.id} />;
  }

  const anchorA: Position = [anchor_a_long, anchor_a_lat];
  const anchorB: Position | undefined =
    anchor_b_lat && anchor_b_long ? [anchor_b_long, anchor_b_lat] : undefined;

  return (
    <div className="space-y-3">
      <LocationMapCard
        highline={highline}
        anchorA={anchorA}
        anchorB={anchorB}
        status={(highline.status as RigStatuses | null) ?? null}
      />
      <WeatherInfoCard latitude={anchor_a_lat} longitude={anchor_a_long} />
    </div>
  );
}

function EmptyLocationState({ highlineId }: { highlineId: string }) {
  const t = useTranslations("highline.tabs.informations.location");

  return (
    <Link
      href={`/?view=map&focusedMarker=${highlineId}&location=picking`}
      className="flex flex-col items-center justify-center rounded-2xl border bg-card p-6 text-center transition-colors hover:bg-muted/50"
    >
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
        <MapPinIcon className="size-8 text-muted-foreground" />
      </div>
      <p className="mb-1 text-lg font-semibold">{t("noLocation")}</p>
      <p className="text-sm text-muted-foreground">{t("addLocationHint")}</p>
    </Link>
  );
}

function LocationMapCard({
  highline,
  anchorA,
  anchorB,
  status,
}: {
  highline: Highline;
  anchorA: Position;
  anchorB?: Position;
  status: RigStatuses | null;
}) {
  const t = useTranslations("highline.tabs.informations.location");
  const [longitude, latitude] = anchorA;

  return (
    <div className="relative overflow-hidden rounded-3xl border bg-muted">
      <Image
        src={staticMapUrl(anchorA, anchorB, status)}
        alt={t("mapAlt", { name: highline.name })}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        unoptimized
        className="h-60 w-full object-cover"
      />

      <div className="absolute inset-x-3 bottom-3 flex gap-2">
        <Link
          href={`/?view=map&focusedMarker=${highline.id}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/95 py-2.5 text-sm font-semibold text-neutral-900 shadow transition-colors hover:bg-white"
        >
          <MapIcon className="size-4" />
          {t("explorer")}
        </Link>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:bg-blue-600"
        >
          <NavigationIcon className="size-4" />
          {t("directions")}
        </a>
      </div>
    </div>
  );
}

/**
 * Mapbox Static Images URL drawn like the app's preview: satellite tiles, a
 * dark casing under the status-coloured line, anchor A filled and B hollow.
 */
function staticMapUrl(
  anchorA: Position,
  anchorB: Position | undefined,
  status: RigStatuses | null
) {
  const color = status ? lineStatusColor[status] : "000000";
  const pin = ([lng, lat]: Position, fill: string) =>
    `pin-s+${fill}(${lng},${lat})`;

  const overlays = anchorB
    ? [
        `path-7+0A0A0A-0.55(${encodePolyline([anchorA, anchorB])})`,
        `path-4+${color}(${encodePolyline([anchorA, anchorB])})`,
        pin(anchorA, color),
        pin(anchorB, "ffffff"),
      ]
    : [pin(anchorA, color)];

  const [lng, lat, zoom] = anchorB
    ? fitBounds(anchorA, anchorB)
    : [anchorA[0], anchorA[1], 16];

  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
    `${overlays.join(",")}/${lng},${lat},${zoom.toFixed(2)}/` +
    `${MAP_WIDTH}x${MAP_HEIGHT}@2x?attribution=false&logo=false` +
    `&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`
  );
}

/** Center and zoom that fit both anchors, like the app's camera bounds. */
function fitBounds(a: Position, b: Position): [number, number, number] {
  // Web Mercator y in [0, 1]
  const mercatorY = (lat: number) => {
    const rad = (lat * Math.PI) / 180;
    return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  };
  // Mapbox styles use 512px tiles
  const worldSize = 512;
  const lngSpan = Math.abs(a[0] - b[0]) / 360;
  const ySpan = Math.abs(mercatorY(a[1]) - mercatorY(b[1]));

  const zoomX = Math.log2(
    (MAP_WIDTH - 2 * CAMERA_PADDING) / (worldSize * lngSpan)
  );
  const zoomY = Math.log2(
    (MAP_HEIGHT - 2 * CAMERA_PADDING) / (worldSize * ySpan)
  );
  const zoom = Math.min(zoomX, zoomY, MAX_ZOOM);

  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, zoom];
}

/** Google encoded polyline (precision 5), as Mapbox's `path` overlay expects. */
function encodePolyline(points: Position[]) {
  let previousLat = 0;
  let previousLng = 0;
  let result = "";

  const encode = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    result += String.fromCharCode(v + 63);
  };

  for (const [lng, lat] of points) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    encode(latE5 - previousLat);
    encode(lngE5 - previousLng);
    previousLat = latE5;
    previousLng = lngE5;
  }

  return encodeURIComponent(result);
}

function WeatherInfoCard({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const t = useTranslations("highline.tabs.informations.weather");
  const {
    data: weather,
    isLoading,
    error,
  } = useWeather({ latitude, longitude });

  if (error) return null;

  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="mb-3 text-xs text-muted-foreground">{t("title")}</p>

      {isLoading || !weather ? (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <div className="duration-200 animate-in fade-in">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-5xl">{weather.weatherIcon}</span>
            <div>
              <p className="text-3xl font-bold">
                {Math.round(weather.temperature)}
                {weather.temperatureUnit}
              </p>
              <p className="text-sm text-muted-foreground">
                {weather.weatherDescription}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <WeatherDetailItem
              icon={WindIcon}
              label={t("wind")}
              value={`${Math.round(weather.windSpeed)} ${
                weather.windSpeedUnit
              }`}
              subvalue={getWindDirection(weather.windDirection)}
            />
            <WeatherDetailItem
              icon={DropletIcon}
              label={t("humidity")}
              value={`${weather.humidity}%`}
            />
            <WeatherDetailItem
              icon={CloudIcon}
              label={t("precipitation")}
              value={`${weather.precipitation} ${weather.precipitationUnit}`}
            />
            <WeatherDetailItem
              icon={ThermometerIcon}
              label={t("gusts")}
              value={`${Math.round(weather.windGusts)} ${
                weather.windSpeedUnit
              }`}
            />
          </div>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t("elevation")}: {weather.elevation}m • {t("dataSource")}
          </p>
        </div>
      )}
    </div>
  );
}

function WeatherDetailItem({
  icon: Icon,
  label,
  value,
  subvalue,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="flex items-center rounded-lg bg-muted/50 px-3 py-2">
      <Icon className="mr-2 size-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">
          {value}
          {subvalue && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({subvalue})
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
