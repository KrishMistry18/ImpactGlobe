"use client";

import { useGlobeStore } from "@/store/useGlobeStore";
import { formatDistanceToNow } from "date-fns";
import { Panel, StatCard, PanelEmpty } from "./Panel";
import { ENV_LAYER_META } from "@/lib/constants";
import type { ReactNode } from "react";

/** A coordinate → value row used by several layer stat sections. */
function CoordRow({
  lat,
  lon,
  value,
  accent,
  label,
}: {
  lat: number;
  lon: number;
  value: string;
  accent?: string;
  label?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-bg-card/60 px-2.5 py-2">
      <span className="font-mono text-xs text-text-secondary">
        {label ?? `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`}
      </span>
      <span className="text-sm font-semibold" style={{ color: accent }}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function EnvDataPanel() {
  const activeEnvLayer = useGlobeStore((s) => s.activeEnvLayer);
  const data = useGlobeStore((s) => s.envLayerData);

  if (activeEnvLayer === "none") return null;
  const meta = ENV_LAYER_META[activeEnvLayer];

  const body = (() => {
    if (!data) return <PanelEmpty message="Loading layer data…" icon={<meta.Icon className="h-9 w-9" />} />;

    switch (activeEnvLayer) {
      case "wind": {
        const pts = data.wind ?? [];
        if (!pts.length) return <PanelEmpty message="No wind data available" icon={<meta.Icon className="h-9 w-9" />} />;
        const avg = pts.reduce((s, p) => s + p.speed, 0) / pts.length;
        const top = [...pts].sort((a, b) => b.speed - a.speed).slice(0, 5);
        return (
          <div className="space-y-4">
            <StatCard label="Global Avg Wind" value={`${avg.toFixed(1)} m/s`} accent={meta.accent} />
            <Section title="Windiest Locations">
              {top.map((p, i) => (
                <CoordRow key={i} lat={p.lat} lon={p.lon} value={`${p.speed.toFixed(1)} m/s`} accent={meta.accent} />
              ))}
            </Section>
          </div>
        );
      }
      case "aqi": {
        const pts = data.aqi ?? [];
        if (!pts.length) return <PanelEmpty message="No AQI data available" icon={<meta.Icon className="h-9 w-9" />} />;
        const top = [...pts].sort((a, b) => b.aqi - a.aqi).slice(0, 5);
        return (
          <div className="space-y-4">
            <StatCard label="Monitoring Stations" value={`${pts.length}`} accent={meta.accent} />
            <Section title="Most Polluted Cities">
              {top.map((p, i) => (
                <CoordRow
                  key={i}
                  lat={p.lat}
                  lon={p.lon}
                  label={<span className="truncate">{p.city}, {p.country}</span>}
                  value={`${p.aqi}`}
                  accent={meta.accent}
                />
              ))}
            </Section>
          </div>
        );
      }
      case "temperature_anomaly": {
        const pts = data.tempAnomalies ?? [];
        if (!pts.length) return <PanelEmpty message="No temperature data" icon={<meta.Icon className="h-9 w-9" />} />;
        const avg = pts.reduce((s, p) => s + p.anomalyC, 0) / pts.length;
        const hot = [...pts].sort((a, b) => b.anomalyC - a.anomalyC).slice(0, 5);
        const cold = [...pts].sort((a, b) => a.anomalyC - b.anomalyC).slice(0, 3);
        return (
          <div className="space-y-4">
            <StatCard label="Global Avg Temp" value={`${avg.toFixed(1)}°C`} accent={meta.accent} />
            <Section title="Hottest Regions">
              {hot.map((p, i) => (
                <CoordRow key={i} lat={p.lat} lon={p.lon} value={`${p.anomalyC.toFixed(1)}°C`} accent="#fb7185" />
              ))}
            </Section>
            <Section title="Coldest Regions">
              {cold.map((p, i) => (
                <CoordRow key={i} lat={p.lat} lon={p.lon} value={`${p.anomalyC.toFixed(1)}°C`} accent="#60a5fa" />
              ))}
            </Section>
          </div>
        );
      }
      case "sea_temp": {
        const pts = data.seaTemp ?? [];
        if (!pts.length) return <PanelEmpty message="Loading sea temperature…" icon={<meta.Icon className="h-9 w-9" />} />;
        const avg = pts.reduce((s, p) => s + p.tempC, 0) / pts.length;
        const warm = [...pts].sort((a, b) => b.tempC - a.tempC).slice(0, 5);
        const cold = [...pts].sort((a, b) => a.tempC - b.tempC).slice(0, 3);
        return (
          <div className="space-y-4">
            <StatCard label="Global Avg Sea Temp" value={`${avg.toFixed(1)}°C`} accent={meta.accent} />
            <Section title="Warmest Regions">
              {warm.map((p, i) => (
                <CoordRow key={i} lat={p.lat} lon={p.lon} value={`${p.tempC.toFixed(1)}°C`} accent="#fb923c" />
              ))}
            </Section>
            <Section title="Coldest Regions">
              {cold.map((p, i) => (
                <CoordRow key={i} lat={p.lat} lon={p.lon} value={`${p.tempC.toFixed(1)}°C`} accent={meta.accent} />
              ))}
            </Section>
          </div>
        );
      }
      case "earthquakes": {
        const pts = data.earthquakes ?? [];
        if (!pts.length) return <PanelEmpty message="No recent earthquakes" icon={<meta.Icon className="h-9 w-9" />} />;
        const top = [...pts].sort((a, b) => b.magnitude - a.magnitude).slice(0, 10);
        return (
          <div className="space-y-4">
            <StatCard label="Last 24 Hours" value={`${pts.length}`} accent={meta.accent} />
            <Section title="Recent Earthquakes">
              {top.map((q) => (
                <div key={q.id} className="rounded-md bg-bg-card/60 p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: meta.accent }}>
                      M {q.magnitude.toFixed(1)}
                    </span>
                    <span className="text-[11px] text-text-muted">{q.depth.toFixed(0)} km</span>
                  </div>
                  <div className="text-xs text-text-secondary">{q.location}</div>
                  <div className="mt-1 text-[11px] text-text-muted">
                    {formatDistanceToNow(new Date(q.time), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </Section>
          </div>
        );
      }
      case "wildfires": {
        const pts = data.wildfires ?? [];
        if (!pts.length) return <PanelEmpty message="No active wildfires" icon={<meta.Icon className="h-9 w-9" />} />;
        return (
          <div className="space-y-4">
            <StatCard label="Active Fires" value={`${pts.length}`} accent={meta.accent} />
            <Section title="Recent Fires">
              {pts.slice(0, 10).map((f) => (
                <div key={f.id} className="rounded-md bg-bg-card/60 p-2.5">
                  <div className="text-sm font-medium text-text-primary">{f.title}</div>
                  <div className="mt-1 text-[11px] text-text-muted">
                    {formatDistanceToNow(new Date(f.date), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </Section>
          </div>
        );
      }
      case "storms": {
        const pts = data.storms ?? [];
        if (!pts.length) return <PanelEmpty message="No active storms" icon={<meta.Icon className="h-9 w-9" />} />;
        return (
          <div className="space-y-4">
            <StatCard label="Active Storms" value={`${pts.length}`} accent={meta.accent} />
            <Section title="Storm List">
              {pts.map((s) => (
                <div key={s.id} className="rounded-md bg-bg-card/60 p-2.5">
                  <div className="text-sm font-medium text-text-primary">{s.title}</div>
                  {s.category && (
                    <div className="mt-1 text-[11px]" style={{ color: meta.accent }}>{s.category}</div>
                  )}
                  <div className="mt-1 text-[11px] text-text-muted">
                    {formatDistanceToNow(new Date(s.date), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </Section>
          </div>
        );
      }
      default:
        return <PanelEmpty message="No data available" />;
    }
  })();

  return (
    <Panel
      title={meta.label}
      icon={<meta.Icon className="h-4 w-4" />}
      accent={meta.accent}
      subtitle={
        <span className="flex items-center justify-between">
          <span>Source: {meta.source}</span>
          {data?.updatedAt && (
            <span>Updated {formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true })}</span>
          )}
        </span>
      }
    >
      <div className="p-4">{body}</div>
    </Panel>
  );
}
