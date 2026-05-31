<div align="center">

# 🌍 ImpactGlobe

**Real-time Geopolitical & Financial Intelligence on a 3D Globe**

[![Live Demo](https://img.shields.io/badge/🔗_Live_Demo-impact--globe.vercel.app-0070f3?style=for-the-badge)](https://impact-globe.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

*Monitor world events, geopolitical tensions, and forex impacts — all visualized on a live interactive globe.*

</div>

---

## ✨ What It Does

ImpactGlobe is an intelligence dashboard that pulls together global news, environmental data, and financial signals into a single real-time interface:

- **3D Globe + 2D Map** — animated ripple markers on a Three.js globe, switchable to Leaflet map
- **AI News Intelligence** — Google Gemini 2.0 Flash analyzes RSS feeds every 4 hours and extracts structured geopolitical events with forex impact scoring
- **Live Forex Panel** — top movers per impact tier with sparklines (Twelve Data API, rotating refresh)
- **7 Environmental Overlays** — Wind speed, Temperature, AQI, Sea Surface Temp, Earthquakes (USGS), Wildfires (NASA EONET), Storms (NASA EONET)
- **Real-time Push** — Firebase listeners push new events to all clients instantly
- **Event Modals** — click any marker for full details, forex impact, and sentiment
- **Filters** — by category, impact tier, time range (1H/6H/24H/48H), and free-text search
- **Live News Ticker** — scrolling headlines at the bottom

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| 3D Globe | Three.js |
| 2D Map | Leaflet + React-Leaflet |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Data Fetching | SWR |
| Database | Firebase Firestore |
| AI | Google Gemini 2.0 Flash |
| Forex | Twelve Data API |
| Charts | Recharts |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- [Firebase](https://firebase.google.com) project (Firestore enabled)
- [Google Gemini API key](https://aistudio.google.com/app/apikey) (free)
- [Twelve Data API key](https://twelvedata.com) (free tier)

### 1. Clone & Install

```bash
git clone https://github.com/KrishMistry18/ImpactGlobe.git
cd ImpactGlobe
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Fill in your keys from `.env.example` (Firebase config + API keys).

### 3. Run Dev Server

```bash
npm run dev
# Open http://localhost:3000
```

### 4. Seed Initial Data

On first load the app auto-calls `/api/news/gemini` to generate 20 events. Trigger manually anytime:

```
http://localhost:3000/api/news/gemini?force=1
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── env/        # Environmental endpoints (weather, AQI, earthquakes...)
│   │   ├── events/     # Globe event CRUD
│   │   ├── forex/      # Forex data + sparklines
│   │   ├── news/       # Gemini AI news generation
│   │   ├── rss/        # RSS feed polling
│   │   └── cron/       # Scheduled cleanup + heartbeat
│   └── page.tsx        # Main app page
├── components/
│   ├── globe/          # Three.js globe renderer + heatmap utils
│   ├── map/            # Leaflet 2D map
│   ├── layout/         # AppShell, TopBar
│   └── ui/             # All panels and overlays
├── hooks/              # useEnvLayer, custom hooks
├── lib/
│   ├── env/            # Environmental data fetchers
│   ├── forex/          # Twelve Data integration
│   ├── gemini/         # Gemini AI client
│   ├── realtime/       # Firebase realtime hook
│   └── firebase/       # Firebase client (browser + server + admin)
└── store/              # Zustand global store + types
```

---

## ⚙️ Cron Jobs (Vercel)

| Job | Interval |
|---|---|
| Forex refresh | Every 1 min |
| RSS poll | Every 10 min |
| Earthquake data | Every 5 min |
| Wildfire data | Every 15 min |
| AQI data | Every 30 min |
| Wind/Temperature | Every 1 hr |
| Sea temperature | Every 6 hr |
| Data cleanup | Every 6 hr |

---

## 📄 License

MIT © [Krish Mistry](https://github.com/KrishMistry18)
