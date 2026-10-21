# WeatherChaser

Find the best weather for your trip. WeatherChaser scores places by forecast
(sunshine, precipitation, temperature, wind), then plans a route through the
best stops for your dates.

## Repository layout

```
weather-chaser/
├── apps/web/            # Web app: Vite + React + TanStack Router + MapLibre (deployed on Vercel)
│   └── api/             # Vercel functions: Nominatim / Open-Meteo / Overpass proxies, Stripe, feedback
├── apps/mobile/         # Mobile app (Expo), see its own README
├── packages/core/       # Scoring and route optimizer (shared, unit-tested)
├── packages/typescript-config/
└── docs/                # Plans, setup notes, open items
```

## Development

Requires Node and pnpm.

```bash
pnpm install
pnpm --filter @weatherchaser/web dev      # http://localhost:5173
pnpm -r type-check
pnpm --filter @weatherchaser/core test
pnpm build
```

Environment variables for the web app (all optional locally) are read from
`apps/web/.env.local`: Supabase (`VITE_SUPABASE_*`), PostHog
(`VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`), and server-side keys for the
`api/` functions.

## Data sources

- Weather: [Open-Meteo](https://open-meteo.com/)
- Geocoding: [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap)
- Places: OpenStreetMap via Overpass
- Maps: [MapLibre GL](https://maplibre.org/)

## Conventions

Agent and contributor rules live in `.claude/CLAUDE.md` (mirrored in
`GEMINI.md`): all UI strings go through i18n (English and German).

## License

MIT
