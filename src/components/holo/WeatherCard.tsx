import { memo } from "react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Droplets,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
} from "lucide-react";
import type { WeatherResult } from "@/lib/weather.functions";
import { Card } from "@/components/ui-system";

function iconFor(code: number, className = "h-5 w-5") {
  if (code === 0 || code === 1) return <Sun className={className} />;
  if (code === 2 || code === 3) return <Cloud className={className} />;
  if (code === 45 || code === 48) return <CloudFog className={className} />;
  if (code >= 51 && code <= 57) return <CloudDrizzle className={className} />;
  if (code >= 71 && code <= 86) return <CloudSnow className={className} />;
  if (code >= 95) return <CloudLightning className={className} />;
  return <CloudRain className={className} />;
}

function hourLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric" });
}

function dayLabel(iso: string, index: number) {
  if (index === 0) return "Today";
  return new Date(iso).toLocaleDateString([], { weekday: "short" });
}

function WeatherCardImpl({ data }: { data: WeatherResult }) {
  return (
    <Card accent className="overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <span className="hud-text text-[10px] text-[oklch(0.7_0.12_220)]">LIVE WEATHER</span>
          <h3 className="mt-1 truncate font-display text-base text-glow-cyan">
            {data.place}
            {data.country ? `, ${data.country}` : ""}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{data.condition}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[oklch(0.85_0.18_200)]">
          {iconFor(data.code, "h-7 w-7")}
          <span className="font-display text-3xl leading-none">{data.tempC}°</span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric icon={<Thermometer className="h-3.5 w-3.5" />} label="Feels like" value={`${data.feelsLikeC}°C`} />
        <Metric icon={<Umbrella className="h-3.5 w-3.5" />} label="Rain chance" value={`${data.rainChance}%`} />
        <Metric icon={<Droplets className="h-3.5 w-3.5" />} label="Humidity" value={`${data.humidity}%`} />
        <Metric icon={<Wind className="h-3.5 w-3.5" />} label="Wind" value={`${data.windKph} km/h`} />
      </dl>

      {data.hourly.length > 0 && (
        <div className="mt-4">
          <span className="hud-text text-[10px] text-[oklch(0.7_0.12_220)]">NEXT HOURS</span>
          <div className="mt-2 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {data.hourly.map((h) => (
              <div
                key={h.time}
                className="flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-lg border border-[oklch(0.7_0.15_220/0.18)] px-2 py-2"
              >
                <span className="hud-text text-[9px] text-[oklch(0.65_0.1_220)]">{hourLabel(h.time)}</span>
                <span className="text-[oklch(0.85_0.18_200)]">{iconFor(h.code, "h-4 w-4")}</span>
                <span className="text-sm">{h.tempC}°</span>
                <span className="text-[10px] text-muted-foreground">{h.rainChance}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.daily.length > 0 && (
        <div className="mt-4">
          <span className="hud-text text-[10px] text-[oklch(0.7_0.12_220)]">FORECAST</span>
          <ul className="mt-2 space-y-1.5">
            {data.daily.map((d, i) => (
              <li key={d.date} className="flex items-center gap-3 text-sm">
                <span className="w-14 shrink-0 text-muted-foreground">{dayLabel(d.date, i)}</span>
                <span className="shrink-0 text-[oklch(0.85_0.18_200)]">{iconFor(d.code, "h-4 w-4")}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {d.rainChance}% rain
                </span>
                <span className="shrink-0 tabular-nums">
                  {d.minC}° / <span className="text-[oklch(0.95_0.04_200)]">{d.maxC}°</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[oklch(0.7_0.15_220/0.18)] px-3 py-2">
      <dt className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="text-[oklch(0.75_0.12_220)]">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

export const WeatherCard = memo(WeatherCardImpl);
