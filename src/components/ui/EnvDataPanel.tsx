"use client";

import { useGlobeStore } from "@/store/useGlobeStore";
import { formatDistanceToNow } from "date-fns";
import {
  Wind,
  Droplets,
  Thermometer,
  Activity,
  Flame,
  CloudRain,
  Waves,
} from "lucide-react";

export function EnvDataPanel() {
  const activeEnvLayer = useGlobeStore((s) => s.activeEnvLayer);
  const envLayerData = useGlobeStore((s) => s.envLayerData);

  if (activeEnvLayer === "none" || !envLayerData) {
    return null;
  }

  const getLayerIcon = () => {
    switch (activeEnvLayer) {
      case "wind":
        return <Wind className="h-5 w-5 text-env-wind" />;
      case "aqi":
        return <Droplets className="h-5 w-5 text-env-aqi" />;
      case "temperature_anomaly":
        return <Thermometer className="h-5 w-5 text-env-temp" />;
      case "earthquakes":
        return <Activity className="h-5 w-5 text-env-quake" />;
      case "wildfires":
        return <Flame className="h-5 w-5 text-env-fire" />;
      case "storms":
        return <CloudRain className="h-5 w-5 text-env-storm" />;
      case "sea_temp":
        return <Waves className="h-5 w-5 text-env-sea" />;
      default:
        return null;
    }
  };

  const getLayerTitle = () => {
    switch (activeEnvLayer) {
      case "wind":
        return "Wind Patterns";
      case "aqi":
        return "Air Quality Index";
      case "temperature_anomaly":
        return "Temperature";
      case "earthquakes":
        return "Recent Earthquakes";
      case "wildfires":
        return "Active Wildfires";
      case "storms":
        return "Active Storms";
      case "sea_temp":
        return "Sea Surface Temperature";
      default:
        return "Environmental Data";
    }
  };

  const getDataSource = () => {
    switch (activeEnvLayer) {
      case "wind":
      case "temperature_anomaly":
        return "Open-Meteo";
      case "aqi":
        return "Open-Meteo AQ";
      case "earthquakes":
        return "USGS";
      case "wildfires":
      case "storms":
        return "NASA EONET";
      case "sea_temp":
        return "Open-Meteo Marine";
      default:
        return "Unknown";
    }
  };

  const renderLayerStats = () => {
    switch (activeEnvLayer) {
      case "wind":
        if (!envLayerData.wind || envLayerData.wind.length === 0) {
          return <EmptyState message="No wind data available" />;
        }
        const avgWindSpeed =
          envLayerData.wind.reduce((sum, p) => sum + p.speed, 0) /
          envLayerData.wind.length;
        const topWindy = [...envLayerData.wind]
          .sort((a, b) => b.speed - a.speed)
          .slice(0, 5);

        return (
          <div className="space-y-4">
            <StatCard
              label="Global Avg Wind Speed"
              value={`${avgWindSpeed.toFixed(1)} m/s`}
            />
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Windiest Locations
              </h4>
              <div className="space-y-2">
                {topWindy.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md bg-bg-card p-2"
                  >
                    <span className="text-sm text-text-secondary">
                      {point.lat.toFixed(1)}°, {point.lon.toFixed(1)}°
                    </span>
                    <span className="text-sm font-semibold text-env-wind">
                      {point.speed.toFixed(1)} m/s
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "aqi":
        if (!envLayerData.aqi || envLayerData.aqi.length === 0) {
          return <EmptyState message="No AQI data available" />;
        }
        const topPolluted = [...envLayerData.aqi]
          .sort((a, b) => b.aqi - a.aqi)
          .slice(0, 5);

        return (
          <div className="space-y-4">
            <StatCard
              label="Monitoring Stations"
              value={envLayerData.aqi.length.toString()}
            />
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Most Polluted Cities
              </h4>
              <div className="space-y-2">
                {topPolluted.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md bg-bg-card p-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-text-primary">
                        {point.city}
                      </div>
                      <div className="text-xs text-text-muted">
                        {point.country}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-env-aqi">
                        {point.aqi}
                      </div>
                      <div className="text-xs text-text-muted">
                        {point.category}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "earthquakes":
        if (
          !envLayerData.earthquakes ||
          envLayerData.earthquakes.length === 0
        ) {
          return <EmptyState message="No recent earthquakes" />;
        }
        const topQuakes = [...envLayerData.earthquakes]
          .sort((a, b) => b.magnitude - a.magnitude)
          .slice(0, 10);

        return (
          <div className="space-y-4">
            <StatCard
              label="Last 24 Hours"
              value={envLayerData.earthquakes.length.toString()}
            />
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Recent Earthquakes
              </h4>
              <div className="space-y-2">
                {topQuakes.map((quake) => (
                  <div key={quake.id} className="rounded-md bg-bg-card p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-env-quake">
                        M {quake.magnitude.toFixed(1)}
                      </span>
                      <span className="text-xs text-text-muted">
                        {quake.depth.toFixed(0)} km deep
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary">
                      {quake.location}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      {formatDistanceToNow(new Date(quake.time), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "wildfires":
        if (!envLayerData.wildfires || envLayerData.wildfires.length === 0) {
          return <EmptyState message="No active wildfires" />;
        }

        return (
          <div className="space-y-4">
            <StatCard
              label="Active Fires"
              value={envLayerData.wildfires.length.toString()}
            />
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Recent Fires
              </h4>
              <div className="space-y-2">
                {envLayerData.wildfires.slice(0, 10).map((fire) => (
                  <div key={fire.id} className="rounded-md bg-bg-card p-2">
                    <div className="text-sm font-medium text-text-primary">
                      {fire.title}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      {formatDistanceToNow(new Date(fire.date), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "storms":
        if (!envLayerData.storms || envLayerData.storms.length === 0) {
          return <EmptyState message="No active storms" />;
        }

        return (
          <div className="space-y-4">
            <StatCard
              label="Active Storms"
              value={envLayerData.storms.length.toString()}
            />
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Storm List
              </h4>
              <div className="space-y-2">
                {envLayerData.storms.map((storm) => (
                  <div key={storm.id} className="rounded-md bg-bg-card p-2">
                    <div className="text-sm font-medium text-text-primary">
                      {storm.title}
                    </div>
                    {storm.category && (
                      <div className="mt-1 text-xs text-env-storm">
                        {storm.category}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-text-muted">
                      {formatDistanceToNow(new Date(storm.date), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "temperature_anomaly":
        if (
          !envLayerData.tempAnomalies ||
          envLayerData.tempAnomalies.length === 0
        ) {
          return <EmptyState message="No temperature data" />;
        }
        const avgTemp =
          envLayerData.tempAnomalies.reduce((sum, p) => sum + p.anomalyC, 0) /
          envLayerData.tempAnomalies.length;
        const hottestSpots = [...envLayerData.tempAnomalies]
          .sort((a, b) => b.anomalyC - a.anomalyC)
          .slice(0, 5);
        const coldestSpots = [...envLayerData.tempAnomalies]
          .sort((a, b) => a.anomalyC - b.anomalyC)
          .slice(0, 3);

        return (
          <div className="space-y-4">
            <StatCard
              label="Global Avg Temp"
              value={`${avgTemp.toFixed(1)}°C`}
            />
            <StatCard
              label="Data Points"
              value={envLayerData.tempAnomalies.length.toString()}
            />
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Hottest Regions
              </h4>
              <div className="space-y-2">
                {hottestSpots.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md bg-bg-card p-2"
                  >
                    <span className="text-sm text-text-secondary">
                      {point.lat.toFixed(1)}°, {point.lon.toFixed(1)}°
                    </span>
                    <span className="text-sm font-semibold text-orange-400">
                      {point.anomalyC.toFixed(1)}°C
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Coldest Regions
              </h4>
              <div className="space-y-2">
                {coldestSpots.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md bg-bg-card p-2"
                  >
                    <span className="text-sm text-text-secondary">
                      {point.lat.toFixed(1)}°, {point.lon.toFixed(1)}°
                    </span>
                    <span className="text-sm font-semibold text-blue-400">
                      {point.anomalyC.toFixed(1)}°C
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "sea_temp":
        if (!envLayerData.seaTemp || envLayerData.seaTemp.length === 0) {
          return <EmptyState message="Loading sea temperature data…" />;
        }
        const avgSeaTemp =
          envLayerData.seaTemp.reduce((sum, p) => sum + p.tempC, 0) /
          envLayerData.seaTemp.length;
        const warmestSeas = [...envLayerData.seaTemp]
          .sort((a, b) => b.tempC - a.tempC)
          .slice(0, 5);
        const coldestSeas = [...envLayerData.seaTemp]
          .sort((a, b) => a.tempC - b.tempC)
          .slice(0, 3);

        return (
          <div className="space-y-4">
            <StatCard
              label="Global Avg Sea Temp"
              value={`${avgSeaTemp.toFixed(1)}°C`}
            />
            <StatCard
              label="Ocean Data Points"
              value={envLayerData.seaTemp.length.toString()}
            />
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Warmest Regions
              </h4>
              <div className="space-y-2">
                {warmestSeas.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md bg-bg-card p-2"
                  >
                    <span className="text-sm text-text-secondary">
                      {point.lat.toFixed(1)}°, {point.lon.toFixed(1)}°
                    </span>
                    <span className="text-sm font-semibold text-orange-400">
                      {point.tempC.toFixed(1)}°C
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Coldest Regions
              </h4>
              <div className="space-y-2">
                {coldestSeas.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md bg-bg-card p-2"
                  >
                    <span className="text-sm text-text-secondary">
                      {point.lat.toFixed(1)}°, {point.lon.toFixed(1)}°
                    </span>
                    <span className="text-sm font-semibold text-env-sea">
                      {point.tempC.toFixed(1)}°C
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return <EmptyState message="No data available" />;
    }
  };

  return (
    <div className="fixed right-0 top-16 z-30 h-[calc(100vh-64px)] w-80 border-l border-border-subtle bg-bg-surface/80 backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-border-subtle p-4">
        <div className="flex items-center gap-2">
          {getLayerIcon()}
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-text-primary">
            {getLayerTitle()}
          </h2>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
          <span>Source: {getDataSource()}</span>
          {envLayerData.updatedAt && (
            <span>
              Updated{" "}
              {formatDistanceToNow(new Date(envLayerData.updatedAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className="overflow-y-auto p-4"
        style={{ height: "calc(100% - 89px)" }}
      >
        {renderLayerStats()}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-text-primary">
        {value}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <div className="mb-2 text-4xl opacity-20">📊</div>
        <p className="text-sm text-text-muted">{message}</p>
      </div>
    </div>
  );
}
