import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Live weather via Open-Meteo (no API key required).
 * The AI never invents these numbers — it only summarises what this returns.
 */

export type WeatherHour = { time: string; tempC: number; rainChance: number; code: number };
export type WeatherDay = {
  date: string;
  minC: number;
  maxC: number;
  rainChance: number;
  code: number;
};

export type WeatherResult = {
  place: string;
  country: string | null;
  observedAt: string;
  tempC: number;
  feelsLikeC: number;
  condition: string;
  code: number;
  humidity: number;
  windKph: number;
  rainChance: number;
  hourly: WeatherHour[];
  daily: WeatherDay[];
};

const WMO: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

export function describeWeather(code: number) {
  return WMO[code] ?? "Unknown conditions";
}

type Geo = { name: string; country?: string; latitude: number; longitude: number };

async function geocode(city: string): Promise<Geo> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Live weather data is unavailable right now.");
  const json = (await res.json()) as { results?: Geo[] };
  const hit = json.results?.[0];
  if (!hit) throw new Error(`I couldn't find a place called "${city}".`);
  return hit;
}

async function reverseName(lat: number, lon: number): Promise<{ name: string; country: string | null }> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`,
    );
    if (!res.ok) return { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: null };
    const json = (await res.json()) as { results?: Geo[] };
    const hit = json.results?.[0];
    return hit
      ? { name: hit.name, country: hit.country ?? null }
      : { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: null };
  } catch {
    return { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: null };
  }
}

export const getWeather = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        city: z.string().trim().min(1).max(120).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lon: z.number().min(-180).max(180).optional(),
      })
      .refine((v) => Boolean(v.city) || (typeof v.lat === "number" && typeof v.lon === "number"), {
        message: "Tell me a city, or allow location access.",
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<WeatherResult> => {
    let lat: number;
    let lon: number;
    let place: string;
    let country: string | null;

    if (typeof data.lat === "number" && typeof data.lon === "number") {
      lat = data.lat;
      lon = data.lon;
      const rev = await reverseName(lat, lon);
      place = rev.name;
      country = rev.country;
    } else {
      const geo = await geocode(data.city!);
      lat = geo.latitude;
      lon = geo.longitude;
      place = geo.name;
      country = geo.country ?? null;
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
      `&hourly=temperature_2m,precipitation_probability,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=5`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Live weather data is unavailable right now.");

    const j = (await res.json()) as {
      current?: {
        time: string;
        temperature_2m: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        weather_code: number;
        wind_speed_10m: number;
      };
      hourly?: {
        time: string[];
        temperature_2m: number[];
        precipitation_probability: number[];
        weather_code: number[];
      };
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
      };
    };

    const cur = j.current;
    if (!cur) throw new Error("Live weather data is unavailable right now.");

    // Start the hourly strip from the next upcoming hour.
    const times = j.hourly?.time ?? [];
    const now = Date.now();
    let start = times.findIndex((t) => new Date(t).getTime() >= now);
    if (start < 0) start = 0;

    const hourly: WeatherHour[] = times.slice(start, start + 8).map((t, i) => ({
      time: t,
      tempC: Math.round(j.hourly!.temperature_2m[start + i] ?? 0),
      rainChance: Math.round(j.hourly!.precipitation_probability?.[start + i] ?? 0),
      code: j.hourly!.weather_code[start + i] ?? 0,
    }));

    const daily: WeatherDay[] = (j.daily?.time ?? []).slice(0, 5).map((d, i) => ({
      date: d,
      minC: Math.round(j.daily!.temperature_2m_min[i] ?? 0),
      maxC: Math.round(j.daily!.temperature_2m_max[i] ?? 0),
      rainChance: Math.round(j.daily!.precipitation_probability_max?.[i] ?? 0),
      code: j.daily!.weather_code[i] ?? 0,
    }));

    return {
      place,
      country,
      observedAt: cur.time,
      tempC: Math.round(cur.temperature_2m),
      feelsLikeC: Math.round(cur.apparent_temperature),
      condition: describeWeather(cur.weather_code),
      code: cur.weather_code,
      humidity: Math.round(cur.relative_humidity_2m),
      windKph: Math.round(cur.wind_speed_10m),
      rainChance: hourly[0]?.rainChance ?? daily[0]?.rainChance ?? 0,
      hourly,
      daily,
    };
  });
