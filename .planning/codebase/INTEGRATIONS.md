# External Integrations

**Analysis Date:** 2026-02-25

## APIs & External Services

**Weather Data:**
- Open-Meteo Weather API
  - Endpoint: `https://api.open-meteo.com/v1/forecast`
  - Authentication: None (free public API)
  - Method: `POST` via Fetch API
  - Parameters: latitude, longitude, daily metrics, timezone, forecast_days
  - Metrics fetched: temperature_2m_max, temperature_2m_min, precipitation_sum, precipitation_probability_max, sunshine_duration, windspeed_10m_max
  - Rate limiting: Handled with exponential backoff (429 status code)
  - Batching: Requests processed in batches of 5 with 1 second delays between batches
  - Implementation: `app.js` - `fetchWeatherForPoint()` method (lines 631-670)

**Geocoding:**
- Nominatim API (OpenStreetMap)
  - Endpoint: `https://nominatim.openstreetmap.org/search`
  - Authentication: None (free public API)
  - User-Agent: `WeatherChaser/1.0`
  - Input formats: City name, postal code, or direct coordinates
  - Output: Latitude, longitude, display name
  - Implementation: `app.js` - `geocodeLocation()` method (lines 223-259)

**Location Suggestions:**
- Overpass API
  - Endpoint: `https://overpass-api.de/api/interpreter`
  - Authentication: None (free public API)
  - Query language: Overpass Query Language (QL)
  - Searches for: Cities and towns within 300km radius
  - Filters: By place type (city/town) and population
  - Implementation: `app.js` - `findNearbyLocations()` method (lines 379-457)

**Routing & Distance Calculation:**
- Project OSRM (Open Source Routing Machine)
  - Endpoint: `https://router.project-osrm.org/route/v1/driving/{lon},{lat};{lon},{lat}`
  - Authentication: None (free public API)
  - Purpose: Calculate actual road distances between waypoints
  - Response: Road distance and routing information
  - Fallback: Air distance calculation if API fails
  - Implementation: `app.js` - `getDistance()` method (lines 1348-1374)

**Maps Display:**
- OpenStreetMap Tiles
  - Tile URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
  - Attribution: OpenStreetMap contributors
  - Library: Leaflet.js (v1.9.4)
  - Max zoom: 19
  - Implementation: `app.js` - `initMap()` method (lines 27-70)

**Navigation Links:**
- Google Maps
  - Directions URL: `https://www.google.com/maps/dir/{waypoints}`
  - Point location URL: `https://www.google.com/maps?q={lat},{lon}`
  - Purpose: Open route in Google Maps for turn-by-turn directions
  - Implementation: `app.js` - `generateGoogleMapsUrl()` method (lines 1431-1439)

## Data Storage

**Databases:**
- Not applicable - Client-side only, no backend database

**File Storage:**
- Not applicable - No file storage integration

**Local Storage:**
- Not currently implemented
- Potential for future enhancement to save favorite locations

**Caching:**
- Browser cache for static assets (HTML, CSS, JS, map tiles)
- API responses cached only within request lifecycle (no persistent cache)

## Authentication & Identity

**Auth Provider:**
- None - Application is completely public, no user authentication
- All APIs are public/free and do not require authentication tokens

## Monitoring & Observability

**Error Tracking:**
- Not integrated
- Console logging for development: `console.log()`, `console.error()`

**Logs:**
- Console-based logging only
- Weather fetch progress logged to console
- API errors logged to console with detailed error messages
- No persistent logging or external log aggregation

## CI/CD & Deployment

**Hosting:**
- Static file hosting (can be deployed to any static host)
- Recommended: GitHub Pages, Netlify, Vercel

**CI Pipeline:**
- None currently in place
- Static application - no build process to automate

**Version Control:**
- Git repository hosted on GitHub (`weather-chaser`)
- Main branch used for production

## Environment Configuration

**Required env vars:**
- None - Application requires no environment variables
- All configuration is hardcoded or user-provided via UI

**Secrets location:**
- Not applicable - No secrets or API keys needed

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Rate Limiting Strategies

**Open-Meteo:**
- Exponential backoff implementation on 429 (Too Many Requests)
- Retries up to 3 times with waits of 1s, 2s, 4s
- Implementation: `fetchWeatherForPoint()` method (lines 641-646)

**Batch Processing:**
- Weather API requests batched in groups of 5
- 1 second delay between batches to avoid overwhelming servers
- Implementation: `fetchWeatherForGrid()` method (lines 601-625)

**Nominatim:**
- Usage policy: Max 1 request per second (user should respect this)
- No built-in rate limiting currently implemented

## CORS Considerations

**CORS Status:**
- All external APIs support CORS from client-side requests
- No CORS proxy needed
- Requests made directly from browser to API endpoints

## Dependencies on External Services

**Critical for functionality:**
- Open-Meteo (weather data) - If unavailable, application cannot fetch weather
- Nominatim (geocoding) - If unavailable, users cannot search by location name
- Overpass API (nearby suggestions) - If unavailable, nearby suggestions feature fails gracefully

**Non-critical:**
- Project OSRM (routing distances) - Falls back to air distance if unavailable
- Google Maps links - Opens external site but doesn't affect core functionality
- OpenStreetMap tiles - Could fall back to other tile providers if needed

---

*Integration audit: 2026-02-25*
