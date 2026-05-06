# ImpactGlobe

A real-time geopolitical and financial intelligence dashboard built on a 3D interactive globe. ImpactGlobe monitors world events, environmental data, and forex market impacts — all in one place.

Live Deployment Link:-
<br>https://impact-globe.vercel.app/

## Features

- **3D Globe & 2D Map** — Switch between an interactive Three.js globe and a Leaflet map. Events appear as animated ripple markers scaled by impact level.
- **AI-Powered News Intelligence** — Google Gemini analyzes RSS feeds and generates structured geopolitical events with forex impact analysis every 4 hours.
- **Live Forex Panel** — Top 5 movers per impact tier with sparklines, powered by Twelve Data API with a rotating refresh system.
- **Environmental Layers** — Toggle between 7 real-time data overlays:
  - 💨 Wind speed (Open-Meteo)
  - 🌡️ Temperature (Open-Meteo)
  - 😷 Air Quality / AQI (Open-Meteo Air Quality)
  - 🌊 Sea Surface Temperature (Open-Meteo Marine)
  - ⚡ Earthquakes (USGS)
  - 🔥 Wildfires (NASA EONET)
  - 🌀 Storms (NASA EONET)
- **Realtime Updates** — Supabase Realtime pushes new events to all connected clients instantly.
- **Filters** — Filter events by category, impact level, time range (1H / 6H / 24H / 48H), and free-text search.
- **News Ticker** — Scrolling live headlines at the bottom of the screen.
- **Event Modals** — Click any marker to see full event details, forex impacts, and sentiment analysis.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| 3D Rendering | Three.js |
| 2D Map | Leaflet + React-Leaflet |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Data Fetching | SWR |
| Database | Supabase (PostgreSQL + Realtime) |
| AI | Google Gemini 2.0 Flash |
| Forex Data | Twelve Data API |
| Charts | Recharts |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google Gemini](https://aistudio.google.com/app/apikey) API key (free)
- A [Twelve Data](https://twelvedata.com) API key (free tier)

### 1. Clone the repo

```bash
git clone https://github.com/KrishMistry18/ImpactGlobe.git
cd ImpactGlobe
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in your keys in `.env.local`. See `.env.example` for all required variables.

### 3. Set up the database

Run the SQL schema in your Supabase SQL editor:
[https://supabase.com/dashboard/project/\_/sql/new](https://supabase.com/dashboard/project/_/sql/new)

Copy and paste the contents of `supabase-schema.sql` and click **Run**.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Populate initial data

On first load the app automatically calls `/api/news/gemini` to generate 20 events. You can also trigger it manually:

```
http://localhost:3000/api/news/gemini?force=1
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── env/          # Environmental data endpoints (weather, aqi, earthquakes, etc.)
│   │   ├── events/       # CRUD for globe events
│   │   ├── forex/        # Forex data + sparklines
│   │   ├── news/         # Gemini AI news generation
│   │   ├── rss/          # RSS feed polling
│   │   └── cron/         # Scheduled cleanup + heartbeat
│   └── page.tsx          # Main app page
├── components/
│   ├── globe/            # Three.js globe renderer + heatmap utils
│   ├── map/              # Leaflet 2D map
│   ├── layout/           # AppShell, TopBar
│   └── ui/               # All UI panels and overlays
├── hooks/                # useEnvLayer, custom hooks
├── lib/
│   ├── env/              # Environmental data fetchers (USGS, NASA, Open-Meteo, OpenAQ)
│   ├── forex/            # Twelve Data integration
│   ├── gemini/           # Gemini AI client
│   ├── geo/              # Coordinate utilities
│   ├── realtime/         # Supabase Realtime hook
│   ├── rss/              # RSS parser + sources
│   └── supabase/         # Supabase client (browser + server + admin)
└── store/                # Zustand global store + types
```

## Deployment

The project is configured for Vercel with cron jobs defined in `vercel.json`.

```bash
npm run build
```

Deploy to Vercel and add all environment variables from `.env.example` to your Vercel project settings.

Cron jobs run automatically on Vercel:
- Forex refresh: every minute (rotating pairs)
- RSS poll: every 10 minutes
- Earthquake data: every 5 minutes
- Wildfire data: every 15 minutes
- AQI data: every 30 minutes
- Wind/Temperature: every hour
- Sea temperature: every 6 hours
- Data cleanup: every 6 hours

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-side writes) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `TWELVE_DATA_API_KEY` | ✅ | Twelve Data forex API key |
| `ADMIN_SECRET` | ✅ | Secret for admin API endpoints |
| `CRON_SECRET` | ✅ | Secret for cron job endpoints |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ⬜ | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | ⬜ | VAPID private key for push notifications |

## License

MIT
