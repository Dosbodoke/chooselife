import { useQuery } from '@tanstack/react-query';

import {
  parseOpenMeteoResponse,
  type OpenMeteoResponse,
  type WeatherData,
} from '~/types/weather';

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

export const weatherKeyFactory = {
  current: (lat: number, lng: number) =>
    ['weather', 'current', lat.toFixed(2), lng.toFixed(2)] as const,
};

interface UseWeatherParams {
  latitude: number;
  longitude: number;
  enabled?: boolean;
}

async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    wind_speed_unit: 'kmh',
  });

  const response = await fetch(`${OPEN_METEO_BASE_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data: OpenMeteoResponse = await response.json();
  return parseOpenMeteoResponse(data);
}

/**
 * Hook to fetch current weather data for a specific location
 * Uses Open-Meteo free API (no API key required)
 */
export function useWeather({ latitude, longitude, enabled = true }: UseWeatherParams) {
  return useQuery<WeatherData>({
    queryKey: weatherKeyFactory.current(latitude, longitude),
    queryFn: () => fetchCurrentWeather(latitude, longitude),
    enabled: enabled && !isNaN(latitude) && !isNaN(longitude),
    staleTime: 1000 * 60 * 15, // 15 minutes - weather doesn't change that fast
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
  });
}
