/**
 * Weather types for Open-Meteo API integration
 * @see https://open-meteo.com/en/docs
 */

// WMO Weather interpretation codes
// https://open-meteo.com/en/docs#weathervariables
export const WMO_WEATHER_CODES = {
  0: { description: 'Clear sky', icon: '☀️' },
  1: { description: 'Mainly clear', icon: '🌤️' },
  2: { description: 'Partly cloudy', icon: '⛅' },
  3: { description: 'Overcast', icon: '☁️' },
  45: { description: 'Fog', icon: '🌫️' },
  48: { description: 'Depositing rime fog', icon: '🌫️' },
  51: { description: 'Light drizzle', icon: '🌧️' },
  53: { description: 'Moderate drizzle', icon: '🌧️' },
  55: { description: 'Dense drizzle', icon: '🌧️' },
  56: { description: 'Light freezing drizzle', icon: '🌨️' },
  57: { description: 'Dense freezing drizzle', icon: '🌨️' },
  61: { description: 'Slight rain', icon: '🌧️' },
  63: { description: 'Moderate rain', icon: '🌧️' },
  65: { description: 'Heavy rain', icon: '🌧️' },
  66: { description: 'Light freezing rain', icon: '🌨️' },
  67: { description: 'Heavy freezing rain', icon: '🌨️' },
  71: { description: 'Slight snow fall', icon: '🌨️' },
  73: { description: 'Moderate snow fall', icon: '🌨️' },
  75: { description: 'Heavy snow fall', icon: '❄️' },
  77: { description: 'Snow grains', icon: '❄️' },
  80: { description: 'Slight rain showers', icon: '🌦️' },
  81: { description: 'Moderate rain showers', icon: '🌦️' },
  82: { description: 'Violent rain showers', icon: '⛈️' },
  85: { description: 'Slight snow showers', icon: '🌨️' },
  86: { description: 'Heavy snow showers', icon: '🌨️' },
  95: { description: 'Thunderstorm', icon: '⛈️' },
  96: { description: 'Thunderstorm with slight hail', icon: '⛈️' },
  99: { description: 'Thunderstorm with heavy hail', icon: '⛈️' },
} as const;

export type WeatherCode = keyof typeof WMO_WEATHER_CODES;

export function getWeatherInfo(code: number) {
  return (
    WMO_WEATHER_CODES[code as WeatherCode] || {
      description: 'Unknown',
      icon: '❓',
    }
  );
}

// Open-Meteo API current weather response
export interface OpenMeteoCurrentWeather {
  time: string;
  interval: number;
  temperature_2m: number;
  relative_humidity_2m: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
}

export interface OpenMeteoCurrentUnits {
  time: string;
  interval: string;
  temperature_2m: string;
  relative_humidity_2m: string;
  precipitation: string;
  weather_code: string;
  wind_speed_10m: string;
  wind_direction_10m: string;
  wind_gusts_10m: string;
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current_units: OpenMeteoCurrentUnits;
  current: OpenMeteoCurrentWeather;
}

// Simplified weather data for UI
export interface WeatherData {
  temperature: number;
  temperatureUnit: string;
  humidity: number;
  precipitation: number;
  precipitationUnit: string;
  weatherCode: number;
  weatherDescription: string;
  weatherIcon: string;
  windSpeed: number;
  windSpeedUnit: string;
  windDirection: number;
  windGusts: number;
  elevation: number;
  updatedAt: string;
}

export function parseOpenMeteoResponse(response: OpenMeteoResponse): WeatherData {
  const weatherInfo = getWeatherInfo(response.current.weather_code);

  return {
    temperature: response.current.temperature_2m,
    temperatureUnit: response.current_units.temperature_2m,
    humidity: response.current.relative_humidity_2m,
    precipitation: response.current.precipitation,
    precipitationUnit: response.current_units.precipitation,
    weatherCode: response.current.weather_code,
    weatherDescription: weatherInfo.description,
    weatherIcon: weatherInfo.icon,
    windSpeed: response.current.wind_speed_10m,
    windSpeedUnit: response.current_units.wind_speed_10m,
    windDirection: response.current.wind_direction_10m,
    windGusts: response.current.wind_gusts_10m,
    elevation: response.elevation,
    updatedAt: response.current.time,
  };
}

// Wind direction to compass
export function getWindDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}
