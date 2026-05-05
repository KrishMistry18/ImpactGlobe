"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { GlobeEvent, EnvLayerData } from "@/store/types";
import type { HoveredEnvPoint } from "@/store/useGlobeStore";
import { useGlobeStore } from "@/store/useGlobeStore";

const IMPACT_COLORS: Record<string, string> = {
  Critical: "#ff2d55", High: "#ff9f0a", Medium: "#ffd60a", Low: "#34c759",
};

interface Props {
  events: GlobeEvent[];
  activeEnvLayer: string;
  envLayerData: EnvLayerData | null;
  onEventClick?: (event: GlobeEvent) => void;
}

type RGB = [number, number, number];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ── Color ramps — IDENTICAL to heatmap.utils.ts on the 3D globe ─────────
// gradientColor maps a 0-1 normalised value through a set of equally-spaced
// colour stops (same algorithm as the 3D renderer).
function gradientColor(t: number, stops: RGB[]): RGB {
  const clamped = Math.max(0, Math.min(1, t));
  const seg = clamped * (stops.length - 1);
  const idx = Math.min(Math.floor(seg), stops.length - 2);
  const frac = seg - idx;
  const a = stops[idx], b = stops[idx + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}

// Wind: 0 → 38 m/s (Beaufort-based, same as 3D globe)
const WIND_STOPS: RGB[]  = [
  [20, 60, 220], [0, 160, 255], [0, 210, 180],
  [80, 220, 50], [255, 230, 0], [255, 140, 0],
  [240, 40, 20], [140, 0, 180],
];
const WIND_MAX = 38;

// Temperature: -40 → 45°C (ERA5/Windy palette, same as 3D globe)
const TEMP_STOPS: RGB[] = [
  [100, 0, 200], [0, 40, 230], [30, 120, 255], [140, 200, 255],
  [230, 240, 255], [255, 250, 180], [255, 180, 40], [255, 60, 0], [180, 0, 0],
];
const TEMP_MIN   = -40;
const TEMP_RANGE = 85;   // 45 - (-40)

// AQI: 0 → 500 (US EPA, same as 3D globe)
const AQI_STOPS: RGB[] = [
  [0, 228, 0], [255, 255, 0], [255, 126, 0],
  [255, 0, 0], [143, 63, 151], [126, 0, 35],
];
const AQI_MAX = 500;

// Sea temp: -2 → 32°C (NOAA/Copernicus, same as 3D globe)
const SEA_STOPS: RGB[] = [
  [200, 230, 255], [0, 60, 200], [0, 140, 230], [0, 210, 210],
  [0, 200, 120], [80, 210, 0], [255, 220, 0], [255, 120, 0], [220, 10, 10],
];
const SEA_MIN   = -2;
const SEA_RANGE = 34;   // 32 - (-2)

// Map a raw scalar value to the correct RGB via the same normalisation as 3D
function layerColor(layer: string, val: number): RGB {
  switch (layer) {
    case "wind":                return gradientColor(Math.max(0, val) / WIND_MAX, WIND_STOPS);
    case "temperature_anomaly": return gradientColor(Math.max(0, val - TEMP_MIN) / TEMP_RANGE, TEMP_STOPS);
    case "aqi":                 return gradientColor(Math.max(0, val) / AQI_MAX, AQI_STOPS);
    case "sea_temp":            return gradientColor(Math.max(0, val - SEA_MIN) / SEA_RANGE, SEA_STOPS);
    default:                    return [128, 128, 128];
  }
}

// ── Grid stores raw scalar values (NOT colors) for smooth interpolation ───
type ValGrid = { vals: (number | null)[]; GW: number; GH: number; step: number; layer: string };

function buildValGrid(layer: string, data: EnvLayerData | null): ValGrid | null {
  const step = 2.5;
  const GW = Math.ceil(360 / step) + 1;
  const GH = Math.ceil(180 / step) + 1;
  const vals: (number | null)[] = new Array(GW * GH).fill(null);

  const put = (lat: number, lon: number, v: number) => {
    const i = Math.round((lon + 180) / step);
    const j = Math.round((90 - lat)  / step);
    if (i >= 0 && i < GW && j >= 0 && j < GH) vals[j * GW + i] = v;
  };

  if (!data) return null;

  if (layer === "wind" && data.wind) {
    data.wind.forEach((p) => put(p.lat, p.lon, p.speed ?? 0));
  } else if (layer === "temperature_anomaly" && data.tempAnomalies) {
    data.tempAnomalies.forEach((p) => put(p.lat, p.lon, p.anomalyC));
  } else if (layer === "aqi" && data.aqi) {
    data.aqi.forEach((p) => { if (p.aqi !== undefined) put(p.lat, p.lon, p.aqi); });
  } else if (layer === "sea_temp" && data.seaTemp) {
    data.seaTemp.forEach((p) => put(p.lat, p.lon, p.tempC ?? 0));
  } else {
    return null;
  }

  // BFS flood-fill
  const queue: number[] = [];
  for (let k = 0; k < vals.length; k++) if (vals[k] !== null) queue.push(k);
  let head = 0;
  const dirs = [-1, 1, -GW, GW];
  while (head < queue.length) {
    const k = queue[head++];
    for (const d of dirs) {
      const nk = k + d;
      if (nk >= 0 && nk < vals.length && vals[nk] === null) {
        if (d === -1 && k % GW === 0) continue;
        if (d === 1 && k % GW === GW - 1) continue;
        vals[nk] = vals[k];
        queue.push(nk);
      }
    }
  }

  // Gaussian blur (6 passes) for smooth gradients
  let src = vals as number[];
  for (let pass = 0; pass < 6; pass++) {
    const dst = new Array<number>(GW * GH);
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        let sum = 0, weight = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const ni = i + di, nj = j + dj;
            if (ni < 0 || ni >= GW || nj < 0 || nj >= GH) continue;
            const w = (di === 0 && dj === 0) ? 4 : (di === 0 || dj === 0) ? 2 : 1;
            sum += src[nj * GW + ni] * w;
            weight += w;
          }
        }
        dst[j * GW + i] = sum / weight;
      }
    }
    src = dst;
  }

  return { vals: src as (number | null)[], GW, GH, step, layer };
}

/** Sample interpolated scalar value (not color) at a lat/lon */
function sampleScalar(g: ValGrid, lat: number, lon: number): number | null {
  const fi = (lon + 180) / g.step;
  const fj = (90 - lat)  / g.step;
  const i0 = Math.floor(fi), j0 = Math.floor(fj);
  const i1 = Math.min(i0 + 1, g.GW - 1), j1 = Math.min(j0 + 1, g.GH - 1);
  const tx = fi - i0, ty = fj - j0;
  const v00 = g.vals[j0 * g.GW + i0];
  const v10 = g.vals[j0 * g.GW + i1];
  const v01 = g.vals[j1 * g.GW + i0];
  const v11 = g.vals[j1 * g.GW + i1];
  if (v00 === null && v10 === null && v01 === null && v11 === null) return null;
  const s00 = v00 ?? v10 ?? v01 ?? v11 ?? 0;
  const s10 = v10 ?? v00 ?? v11 ?? v01 ?? 0;
  const s01 = v01 ?? v00 ?? v11 ?? v10 ?? 0;
  const s11 = v11 ?? v10 ?? v01 ?? v00 ?? 0;
  return lerp(lerp(s00, s10, tx), lerp(s01, s11, tx), ty);
}

function sampleGrid(g: ValGrid, lat: number, lon: number): RGB | null {
  const val = sampleScalar(g, lat, lon);
  if (val === null) return null;
  return layerColor(g.layer, val);
}

// ── Build a HoveredEnvPoint from the interpolated grid ───────────────────
function buildHoverPoint(
  layer: string,
  grid: ValGrid,
  data: EnvLayerData,
  lat: number,
  lon: number,
): HoveredEnvPoint | null {
  const val = sampleScalar(grid, lat, lon);
  if (val === null) return null;

  if (layer === "wind" && data.wind) {
    // Find nearest wind point for direction
    let nearest = data.wind[0];
    let minD = Infinity;
    for (const p of data.wind) {
      const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
      if (d < minD) { minD = d; nearest = p; }
    }
    return { type: "wind", lat, lon, speed: val, direction: nearest?.direction ?? 0 };
  }
  if (layer === "temperature_anomaly") {
    return { type: "temperature", lat, lon, tempC: val };
  }
  if (layer === "aqi" && data.aqi) {
    // Find nearest AQI point for category & pm25
    let nearest = data.aqi[0];
    let minD = Infinity;
    for (const p of data.aqi) {
      const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
      if (d < minD) { minD = d; nearest = p; }
    }
    return {
      type: "aqi", lat, lon, aqi: Math.round(val),
      pm25: nearest?.pm25 ?? 0, category: nearest?.category ?? "Unknown",
    };
  }
  if (layer === "sea_temp") {
    return { type: "sea_temp", lat, lon, tempC: val };
  }
  return null;
}

export default function MapView2D({ events, activeEnvLayer, envLayerData, onEventClick }: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef          = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersLayerRef = useRef<any>(null);
  const envCleanupRef   = useRef<(() => void) | null>(null);
  const initRef         = useRef(false);
  // Stores the current grid so the mousemove handler can sample it
  const gridRef         = useRef<ValGrid | null>(null);

  // Trigger state so the heatmap effect re-runs when the map becomes ready
  const [mapReady, setMapReady] = useState(false);

  const setHoveredEnvPoint = useGlobeStore((s) => s.setHoveredEnvPoint);

  // ── Init Leaflet map (guarded against double-init from StrictMode / HMR) ─
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current || initRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((el as any)._leaflet_id) return;
    initRef.current = true;

    import("leaflet").then((L) => {
      if (!containerRef.current) { initRef.current = false; return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((containerRef.current as any)._leaflet_id) { initRef.current = false; return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      const map = L.map(containerRef.current!, {
        center: [20, 10], zoom: 3, zoomControl: true, attributionControl: false,
        maxBounds: [[-85, -210], [85, 210]], minZoom: 2,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 19, zIndex: 100 }).addTo(map);

      fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson")
        .then((r) => r.json()).then((geo) => {
          L.geoJSON(geo, { style: { color: "#ffffff", weight: 0.5, fillOpacity: 0, opacity: 0.2 } }).addTo(map);
          L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
            { subdomains: "abcd", maxZoom: 19, zIndex: 700, opacity: 0.9 }).addTo(map);
        }).catch(() => {});

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      // Signal that the map is ready so heatmap effect can run
      setMapReady(true);
    });
    return () => {
      envCleanupRef.current?.();
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      initRef.current = false;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pulsing icon ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pulsingIcon = useCallback((L: any, color: string) => L.divIcon({
    className: "", iconSize: [22, 22], iconAnchor: [11, 11],
    html: `<div style="position:relative;width:22px;height:22px">
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.22;animation:mapPulse 2s ease-out infinite"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:11px;height:11px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color},0 0 18px ${color}66"></div>
    </div>`,
  }), []);

  // ── Event markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;
    import("leaflet").then((L) => {
      layer.clearLayers();
      if (["wind","temperature_anomaly","aqi","sea_temp"].includes(activeEnvLayer)) return;
      events.filter((e) => e.lat || e.lon).forEach((event) => {
        const color = IMPACT_COLORS[event.impactLevel] ?? "#888";
        const m = L.marker([event.lat, event.lon], { icon: pulsingIcon(L, color) });
        m.bindPopup(`<div style="background:#0d1a2e;color:#e0eaff;padding:10px 14px;border-radius:8px;font-family:Inter,sans-serif;border:1px solid ${color}44;min-width:220px">
          <div style="display:inline-block;padding:2px 8px;border-radius:12px;background:${color}22;color:${color};font-size:10px;font-weight:700;letter-spacing:.06em;margin-bottom:6px">${event.impactLevel.toUpperCase()}</div>
          <div style="font-weight:600;font-size:13px;line-height:1.4;margin-bottom:4px">${event.headline}</div>
          <div style="font-size:11px;color:#8aaccc">📍 ${event.country} · ${event.category}</div>
        </div>`, { maxWidth: 280, className: "impact-popup" });
        m.on("click", () => onEventClick?.(event));
        m.addTo(layer);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, activeEnvLayer, pulsingIcon]);

  // ── Windy-style pixel heatmap + hover tooltip ─────────────────────────────
  // Depends on mapReady so it re-runs when Leaflet finishes async init
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    import("leaflet").then((L) => {
      envCleanupRef.current?.();
      envCleanupRef.current = null;
      gridRef.current = null;

      if (!["wind","temperature_anomaly","aqi","sea_temp"].includes(activeEnvLayer) || !envLayerData) return;

      const grid = buildValGrid(activeEnvLayer, envLayerData);
      if (!grid) return;
      gridRef.current = grid;

      const overlayPane = map.getPanes().overlayPane as HTMLElement;
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:410;";
      overlayPane.appendChild(canvas);

      const offscreen = document.createElement("canvas");
      let rafId = 0;
      let drawing = false;

      const draw = () => {
        if (drawing) return;
        drawing = true;
        const fullW = map.getSize().x;
        const fullH = map.getSize().y;
        const W = Math.ceil(fullW / 2);
        const H = Math.ceil(fullH / 2);

        offscreen.width = W;
        offscreen.height = H;
        const oc = offscreen.getContext("2d")!;
        const img = oc.createImageData(W, H);
        const pxData = img.data;

        const bounds = map.getBounds();
        const north = bounds.getNorth(), south = bounds.getSouth();
        const west  = bounds.getWest(),  east  = bounds.getEast();
        const latStep = (north - south) / H;
        const lonStep = (east - west) / W;

        for (let y = 0; y < H; y++) {
          const lat = north - latStep * y;
          if (lat < -85 || lat > 85) continue;
          const rowOff = y * W * 4;
          for (let x = 0; x < W; x++) {
            const rawLon = west + lonStep * x;
            const lon = ((rawLon + 180) % 360 + 360) % 360 - 180;
            const cell = sampleGrid(grid, lat, lon);
            if (cell) {
              const k = rowOff + x * 4;
              pxData[k]     = cell[0];
              pxData[k + 1] = cell[1];
              pxData[k + 2] = cell[2];
              pxData[k + 3] = 148;
            }
          }
        }
        oc.putImageData(img, 0, 0);

        canvas.width = fullW;
        canvas.height = fullH;
        const origin = map.containerPointToLayerPoint([0, 0]);
        canvas.style.left = `${origin.x}px`;
        canvas.style.top  = `${origin.y}px`;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(offscreen, 0, 0, fullW, fullH);
        drawing = false;
      };

      const scheduleDraw = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(draw); };
      map.on("move zoom resize viewreset", scheduleDraw);
      scheduleDraw();

      envCleanupRef.current = () => {
        cancelAnimationFrame(rafId);
        map.off("move zoom resize viewreset", scheduleDraw);
        canvas.parentNode?.removeChild(canvas);
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEnvLayer, envLayerData, mapReady]);

  // ── Mouse-move hover tooltip ──────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseMove = (e: MouseEvent) => {
      const map = mapRef.current;
      const grid = gridRef.current;
      const isHeatmap = ["wind","temperature_anomaly","aqi","sea_temp"].includes(activeEnvLayer);

      if (!map || !grid || !isHeatmap || !envLayerData) {
        setHoveredEnvPoint(null);
        return;
      }

      // Convert mouse pixel coords to lat/lon
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latlng = map.containerPointToLatLng([px, py] as any);
      const lat = latlng.lat as number;
      const rawLon = latlng.lng as number;
      const lon = ((rawLon + 180) % 360 + 360) % 360 - 180;

      const point = buildHoverPoint(activeEnvLayer, grid, envLayerData, lat, lon);
      setHoveredEnvPoint(point, { x: e.clientX, y: e.clientY });
    };

    const onMouseLeave = () => setHoveredEnvPoint(null);

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", onMouseLeave);
    return () => {
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEnvLayer, envLayerData]);

  return (
    <>
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        @keyframes mapPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(3.5);opacity:0}}
        .leaflet-container{background:#050d1a}
        .leaflet-popup-content-wrapper,.leaflet-popup-tip{background:transparent!important;box-shadow:none!important}
        .leaflet-popup-content{margin:0!important}
        .leaflet-control-zoom a{background:#0d1a2e!important;color:#8aaccc!important;border-color:#1a3a6e!important}
        .leaflet-control-zoom a:hover{background:#1a3a6e!important}
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%", background: "#050d1a" }} />
    </>
  );
}
