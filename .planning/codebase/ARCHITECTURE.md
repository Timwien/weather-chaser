# Architecture

**Analysis Date:** 2026-02-25

## Pattern Overview

**Overall:** Single-Page Application (SPA) with client-side data processing

**Key Characteristics:**
- Fully static HTML/CSS/JavaScript application (no server-side code required)
- Class-based architecture with single `WeatherChaser` instance managing all state
- Event-driven UI with DOM manipulation for state reflection
- Multiple search modes (location grid, drawn area, manual places)
- Three-layer data flow: user input → API calls → scoring → visualization

## Layers

**Presentation Layer:**
- Purpose: DOM management, user interaction, visualization rendering
- Location: `index.html` (structure), `style.css` (styling)
- Contains: HTML form controls, map container, results table, itinerary timeline
- Depends on: Data layer for weather results, Map library (Leaflet)
- Used by: WeatherChaser class for DOM queries and updates

**Data Processing Layer:**
- Purpose: Calculate weather scores, optimize routes, filter and sort results
- Location: `app.js` (methods: `calculateScores()`, `calculateTempScore()`, `optimizeRoute()`)
- Contains: Scoring algorithms, route optimization, distance calculations
- Depends on: Raw API data
- Used by: Display layer for rendering results

**API Integration Layer:**
- Purpose: Fetch external data from multiple services
- Location: `app.js` (methods: `geocodeLocation()`, `fetchWeatherForPoint()`, `calculateRoadDistance()`, `findNearbyLocations()`)
- Contains: Nominatim geocoding, Open-Meteo weather API, OSRM routing, Overpass location search
- Depends on: HTTP fetch, rate limiting logic
- Used by: Core application logic for enriching user input with coordinates and weather data

**State Management Layer:**
- Purpose: Centralized object holding all application state
- Location: `app.js` class properties (lines 2-20)
- Contains:
  - `map`: Leaflet map instance
  - `markers`: Array of displayed location markers
  - `weatherData`: Array of analyzed weather results (main result set)
  - `manualPlaces`: Array of user-added locations
  - `searchMode`: Current tab ('location', 'draw', 'places')
  - `currentRoute`: Route being displayed on map
  - `currentSortColumn`, `currentSortDirection`: Table state
- Used by: All methods for shared access to application state

## Data Flow

**Location Search Flow:**

1. User enters location in text input and clicks "Find Best Weather"
2. `handleSearch()` delegates to `geocodeLocation()` (Nominatim API)
3. `generateGridFromCenter()` creates grid points around coordinates
4. `fetchWeatherForGrid()` calls `fetchWeatherForPoint()` in batches (rate limiting: 5 points per batch, 1s delay)
5. `calculateScores()` processes raw weather data:
   - Extracts daily metrics (temp, rain, sun, wind)
   - Calculates normalized scores (0-100) with weights:
     - Rain amount: 25%
     - Rain probability: 25%
     - Sun hours: 30%
     - Temperature: 15% (optimum 22.5°C)
     - Wind: 5%
   - Sorts results by total score (highest first)
6. `displayResults()` renders on map and in table

**Draw Area Flow:**

1. User switches to "Draw Area" tab
2. User draws rectangle/polygon on Leaflet map
3. `generateGridFromShape()` creates grid points within drawn bounds
4. Same weather fetch and scoring as location search

**Manual Places Flow:**

1. User switches to "Manual Places" tab
2. User enters city name/coordinates, clicks "+ Add"
3. `addPlace()` geocodes location, adds to `manualPlaces` array
4. `updatePlacesList()` renders list with remove buttons
5. `findNearbyLocations()` calls Overpass API to suggest nearby cities
6. `renderSuggestions()` shows suggestions, greyed out if already added
7. When user searches, manual places used directly as grid points

**Route Building Flow:**

1. After search results, route builder section becomes visible
2. User optionally selects start location from dropdown
3. User clicks "Build Optimal Route"
4. `buildRoute()` calls `optimizeRoute()` which:
   - For each day 1..N:
     - Calls `findNextBestLocation()` to find best next stop
     - Considers staying at current location (with +35 score bonus)
     - Evaluates candidates within max travel distance
     - Calls `calculateRoadDistance()` (OSRM API) for actual road distance
     - Applies direction penalty to avoid zigzagging
     - Selects location with highest: weather_score + distance_efficiency - penalty
5. `displayRoute()` renders polyline and numbered markers
6. `displayItinerary()` creates timeline view with dates, distances, weather

**State Management:**
- Unidirectional: User input → API data → Processed results → UI display
- No persistence (no localStorage, all data lost on page reload)
- Single source of truth: `weatherData` array holds all results for sorting/display
- UI state separate: `currentSortColumn`, `currentSortDirection` track table state

## Key Abstractions

**WeatherChaser Class:**
- Purpose: Encapsulate entire application logic and state
- Examples: `app.js` (entire file)
- Pattern: Class-based singleton (instantiated once at line 1560: `const app = new WeatherChaser()`)
- Methods organized into functional groups:
  - Initialization: `init()`, `initMap()`, `attachEventListeners()`
  - Search handling: `handleSearch()`, `switchMode()`
  - Input geocoding: `geocodeLocation()`, `addPlace()`, `findNearbyLocations()`
  - Grid generation: `generateGridFromCenter()`, `generateGridFromShape()`, `pointInPolygon()`
  - Weather API: `fetchWeatherForGrid()`, `fetchWeatherForPoint()`
  - Scoring: `calculateScores()`, `calculateTempScore()`, `calculateDailyScore()`
  - Display: `displayResults()`, `displayOnMap()`, `displayInTable()`, `generateDetailContent()`
  - Routing: `buildRoute()`, `optimizeRoute()`, `findNextBestLocation()`, `displayRoute()`, `displayItinerary()`
  - Utilities: `average()`, `sum()`, `calculateDistance()`, `calculateRoadDistance()`, `sleep()`

**Weather Point Object:**
- Purpose: Represent a single location with computed metrics
- Structure:
  ```javascript
  {
    lat: number,           // Latitude
    lon: number,           // Longitude
    score: number,         // Overall weather score (0-100)
    rank: number,          // Ranking among results
    avgTemp: number,       // Average temperature (°C)
    sunHours: number,      // Average daily sun hours
    rainAmount: number,    // Total rain (mm)
    rainChance: number,    // Average rain probability (%)
    windSpeed: number,     // Average wind speed (km/h)
    rawData: object        // Original Open-Meteo API response
  }
  ```

**Route Stop Object:**
- Purpose: Represent a single day's destination in optimized route
- Structure:
  ```javascript
  {
    day: number,           // Day number (1..N)
    location: object,      // Weather point object
    distance: number,      // Distance traveled to reach (km)
    driveTime: number,     // Time to reach (minutes)
    weather: object,       // Daily weather data
    stayed: boolean        // True if staying in same location
  }
  ```

## Entry Points

**Application Initialization:**
- Location: `app.js` line 1560
- Triggers: Page load (DOMContentLoaded implicit via defer script loading)
- Responsibilities:
  - Creates Leaflet map centered on Europe
  - Enables Leaflet Draw controls
  - Attaches event listeners to all interactive elements

**User Search Trigger:**
- Location: `handleSearch()` method
- Triggers: Click on "Find Best Weather" button OR Enter key in location input
- Responsibilities:
  - Validates user input
  - Determines search mode (location grid, draw, manual places)
  - Orchestrates geocoding, weather fetching, scoring, display

**Tab Switching:**
- Location: `switchMode()` method
- Triggers: Click on search mode tabs ("Location Search", "Draw Area", "Manual Places")
- Responsibilities:
  - Updates tab active state
  - Shows/hides relevant control panels
  - Toggles Leaflet Draw control visibility

## Error Handling

**Strategy:** Try-catch blocks with user-facing alerts, console logging for debugging

**Patterns:**

**Geocoding errors** (`geocodeLocation()`):
```javascript
try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Geocoding failed');
    const data = await response.json();
    if (data.length === 0) throw new Error('Location not found');
    return { lat, lon, name };
} catch (error) {
    alert('Could not find location: ' + location);
}
```

**Weather API with retry** (`fetchWeatherForPoint()`):
```javascript
if (response.status === 429 && retryCount < 3) {
    // Rate limited - exponential backoff retry
    const waitTime = Math.pow(2, retryCount) * 1000;
    await this.sleep(waitTime);
    return this.fetchWeatherForPoint(point, days, retryCount + 1);
}
```

**Fallback to air distance** (`calculateRoadDistance()`):
```javascript
try {
    const response = await fetch(osmrUrl);
    if (!response.ok || data.code !== 'Ok') {
        return this.calculateDistance(lat1, lon1, lat2, lon2); // Fallback
    }
} catch (error) {
    return this.calculateDistance(lat1, lon1, lat2, lon2); // Fallback
}
```

**Graceful degradation:** If external API fails, application continues with calculated fallbacks (e.g., air distance if OSRM unavailable)

## Cross-Cutting Concerns

**Logging:** Console.log used for:
- Weather fetch progress: `console.log('Weather data progress: ${progress}%')`
- API failures: `console.error('Error:', error)`
- Debugging route building: `console.warn('OSRM API failed, using air distance')`

**Validation:**
- Input validation: Empty string checks before geocoding
- Boundary validation: Grid size constraints (9, 16, 25, 36, 49)
- Radius constraints: 10km-500km range (enforced in HTML input min/max)
- Manual places limit: Maximum 25 locations
- Forecast days: 1-14 days range

**Rate Limiting:**
- Batch processing: Weather fetch in batches of 5 with 1-second delay between batches
- OSRM requests: Called only for candidates within feasible distance range
- Nominatim: User-Agent header required per API policy ("WeatherChaser/1.0")
- Overpass: Timeout set to 25 seconds, max 50 results

**User Feedback:**
- Loading indicator shown during async operations
- Search button disabled while loading
- Progress logged to console
- Error messages displayed as browser alerts

---

*Architecture analysis: 2026-02-25*
