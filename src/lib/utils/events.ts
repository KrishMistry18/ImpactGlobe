import type {
  EarthquakeEvent,
  WildfireEvent,
  StormEvent,
  GlobeEvent,
} from "@/store/types";

const DAY_MS = 86_400_000;
const lastSegment = (title: string) =>
  title.split(",").pop()?.trim() || "Unknown";

export function convertQuakeToEvent(quake: EarthquakeEvent): GlobeEvent {
  const impactLevel: GlobeEvent["impactLevel"] =
    quake.magnitude >= 6.0
      ? "Critical"
      : quake.magnitude >= 5.0
        ? "High"
        : quake.magnitude >= 4.0
          ? "Medium"
          : "Low";

  return {
    id: quake.id,
    headline: `M${quake.magnitude.toFixed(1)} Earthquake — ${quake.location}`,
    country: quake.location,
    lat: quake.lat,
    lon: quake.lon,
    impactLevel,
    category: "Natural Disaster",
    summary: `Magnitude ${quake.magnitude.toFixed(1)} earthquake at ${quake.depth}km depth. ${quake.location}`,
    sentiment: "Negative",
    forexImpacts: [],
    confidenceScore: 1,
    isMarketMoving: quake.magnitude >= 6.0,
    publishedAt: quake.time,
    expiresAt: new Date(Date.now() + DAY_MS).toISOString(),
    sourceUrl: quake.url,
    createdBy: "ai-auto",
  };
}

export function convertWildfireToEvent(fire: WildfireEvent): GlobeEvent {
  return {
    id: fire.id,
    headline: fire.title,
    country: lastSegment(fire.title),
    lat: fire.lat,
    lon: fire.lon,
    impactLevel: "High",
    category: "Natural Disaster",
    summary: `Active wildfire: ${fire.title}. Started ${new Date(fire.date).toLocaleDateString()}.`,
    sentiment: "Negative",
    forexImpacts: [],
    confidenceScore: 1,
    isMarketMoving: false,
    publishedAt: fire.date,
    expiresAt: new Date(Date.now() + DAY_MS).toISOString(),
    sourceUrl: "https://eonet.gsfc.nasa.gov/",
    createdBy: "ai-auto",
  };
}

export function convertStormToEvent(storm: StormEvent): GlobeEvent {
  const isHurricane =
    storm.category?.toLowerCase().includes("hurricane") ?? false;
  return {
    id: storm.id,
    headline: storm.title,
    country: lastSegment(storm.title),
    lat: storm.lat,
    lon: storm.lon,
    impactLevel: isHurricane ? "Critical" : "High",
    category: "Natural Disaster",
    summary: `${storm.category || "Storm"}: ${storm.title}`,
    sentiment: "Negative",
    forexImpacts: [],
    confidenceScore: 1,
    isMarketMoving: isHurricane,
    publishedAt: storm.date,
    expiresAt: new Date(Date.now() + DAY_MS).toISOString(),
    sourceUrl: "https://eonet.gsfc.nasa.gov/",
    createdBy: "ai-auto",
  };
}
