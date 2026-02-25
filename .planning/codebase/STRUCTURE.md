# Codebase Structure

**Analysis Date:** 2026-02-25

## Directory Layout

```
weather-chaser/
├── index.html          # Main HTML structure and UI layout
├── style.css           # All styling and responsive design
├── app.js              # Entire application logic (1561 lines)
├── README.md           # Documentation and usage guide
└── .planning/          # GSD planning directory (not committed to main)
    └── codebase/       # Codebase analysis documents
```

## Directory Purposes

**Project Root:**
- Purpose: Static web application entry point
- Contains: HTML entry point, stylesheet, JavaScript application, documentation
- Key files: `index.html` (23 lines structure markup), `style.css` (824 lines styling), `app.js` (1561 lines application)

## Key File Locations

**Entry Points:**

**`index.html`** (HTML Document - 223 lines):
- Purpose: Single page layout and DOM structure
- Sections:
  - Header (lines 17-20): Title and tagline
  - Controls section (lines 22-110):
    - Search mode tabs (lines 23-27): Location, Draw, Manual Places modes
    - Location mode form (lines 29-52): Location input, radius, grid size, forecast days
    - Draw mode instructions (lines 54-68): Drawing interface description
    - Manual places form (lines 70-96): Add location input, places list, suggestions
  - Map container (lines 112-114): Leaflet map div
  - Route itinerary section (lines 117-144): Travel statistics and timeline
  - Results section (lines 146-186): Table with sortable weather data
  - Route builder section (lines 189-210): Route controls and build button
- External scripts: Leaflet.js, Leaflet.draw.js (CDN)

**`style.css`** (CSS Stylesheet - 824 lines):
- Purpose: Complete styling, layout, responsive design, color scheme
- Organization:
  - CSS Variables (lines 7-27): Color palette, shadows, responsive values
  - Global styles (lines 29-44): Body, container, fonts
  - Header (lines 46-81): Gradient background, title styling
  - Controls section (lines 82-157): Form layout, buttons, inputs
  - Map container (lines 159-165): Full-width responsive map
  - Results table (lines 167-300): Data rows, expandable details, sorting indicators
  - Legend (lines 302-325): Score color coding
  - Route builder (lines 327-400): Route controls, itinerary timeline
  - Responsive breakpoints (media queries): Mobile, tablet, desktop
  - Utility classes: Hidden, loading spinner, badges, alerts

**Configuration:**
- `index.html` lines 217-221: Script loading order:
  1. Leaflet library (CDN)
  2. Leaflet.draw plugin (CDN)
  3. `app.js` (local)

## Core Logic

**`app.js`** (JavaScript Application - 1561 lines):

**Class Definition (lines 1-19):**
- Single `WeatherChaser` class with properties for state management
- Instantiated once at line 1560: `const app = new WeatherChaser()`

**Constructor & Initialization (lines 22-25):**
```javascript
constructor() { ... this.init(); }
init() { this.initMap(); this.attachEventListeners(); }
```

**Map Initialization (lines 27-70):**
- Leaflet map setup: `L.map('map')`, OpenStreetMap tiles
- Leaflet Draw integration: Rectangle and polygon drawing
- Event handlers for shape creation/deletion

**Event Attachment (lines 79-130):**
- Search button click: `handleSearch()`
- Location input Enter key: `handleSearch()`
- Tab buttons: `switchMode()`
- Table headers: `handleSort()`
- Route builder button: `buildRoute()`
- Manual places: add/remove/suggest

**Search & Grid Generation (lines 150-583):**
- `handleSearch()` (150-221): Main search orchestrator
- `geocodeLocation()` (223-259): Nominatim API integration
- `generateGridFromCenter()` (519-546): Grid points from center + radius
- `generateGridFromShape()` (548-583): Grid points within drawn shape
- `pointInPolygon()` (585-599): Ray-casting algorithm for polygon containment

**Manual Places Management (lines 262-517):**
- `addPlace()` (263-315): Geocode and add location to list
- `removePlace()` (317-325): Remove by index
- `clearPlaces()` (327-341): Clear all with confirmation
- `updatePlacesList()` (343-377): Render places list with remove buttons
- `findNearbyLocations()` (379-455): Overpass API query for suggestions
- `renderSuggestions()` (457-486): Display suggestions with add buttons
- `addSuggestedPlace()` (488-517): Add suggestion to places list

**Weather Data Fetching (lines 601-670):**
- `fetchWeatherForGrid()` (601-625): Batch processing with rate limiting (5 points/batch, 1s delay)
- `fetchWeatherForPoint()` (631-670): Open-Meteo API with exponential backoff retry on rate limit

**Scoring Algorithm (lines 672-751):**
- `calculateScores()` (672-738): Main scoring function:
  - Extracts metrics from raw API data
  - Weights: Rain amount 25%, Rain probability 25%, Sun 30%, Temp 15%, Wind 5%
  - Normalization: 0-100 scale for each metric
  - Sorting: Highest score first
  - Ranking: 1..N ranks assigned
- `calculateTempScore()` (740-751): Temperature scoring with 22.5°C optimum
- `calculateDailyScore()` (981-998): Per-day scoring (same weights)

**Utility Functions (lines 753-763):**
- `average()`: Mean of array filtering nulls
- `sum()`: Total of array filtering nulls

**Display & Rendering (lines 765-1100):**
- `displayResults()` (765-785): Show results and route builder
- `displayOnMap()` (806-858): Render circle markers color-coded by score
- `displayInTable()` (860-925): Create table rows with expandable detail rows
- `generateDetailContent()` (927-979): Day-by-day breakdown with daily scores
- `toggleDetailRow()` (1030-1041): Expand/collapse detail view
- `highlightMarker()` (1043-1061): Center map on location
- `handleSort()` (1063-1100): Sort results and re-render
- `populateStartLocationDropdown()` (787-804): Route builder start location options
- `getColorForScore()` (1102-1108): Color mapping (red/yellow/green gradient)
- `getScoreClass()` (1110-1115): CSS class for score badge
- `getWeatherEmoji()` (1000-1028): Weather icon selection based on conditions
- `showLoading()` (1117-1128): Toggle loading indicator

**Route Building (lines 1132-1561):**
- `buildRoute()` (1132-1175): Main route builder entry point
- `optimizeRoute()` (1177-1249): Day-by-day route optimization:
  - Considers staying at current location (+35 bonus)
  - Filters candidates by air distance + 20% buffer
  - Checks road distance via OSRM
  - Calculates direction penalty to avoid zigzagging
  - Scores: weather_score + distance_efficiency - direction_penalty
- `findNextBestLocation()` (1251-1328): Greedy selection of next best location
- `calculateDistance()` (1330-1343): Haversine formula for air distance (km)
- `calculateRoadDistance()` (1345-1377): OSRM API for actual road distance with fallback
- `displayRoute()` (1379-1429): Draw polyline and numbered markers on map
- `displayItinerary()` (1441-1561): Render timeline with days, distances, weather
- `generateGoogleMapsUrl()` (1431-1439): Create Google Maps directions URL

**Mode Switching (lines 132-148):**
- `switchMode()`: Update active tab, show/hide control panels, toggle draw controls

## Naming Conventions

**Files:**
- Lowercase with extensions: `app.js`, `style.css`, `index.html`
- Documentation in root: `README.md`, `.nojekyll` (GitHub Pages)

**Functions:**
- camelCase: `handleSearch()`, `geocodeLocation()`, `displayResults()`
- Verb-first for actions: `fetch*`, `calculate*`, `display*`, `toggle*`
- Prefixed for related operations: `fetchWeatherForGrid()`, `fetchWeatherForPoint()`

**Variables:**
- camelCase: `weatherData`, `manualPlaces`, `searchMode`, `currentRoute`
- Descriptive names: `maxTravelPerDay`, `rainChanceScore`, `directionPenalty`
- Array suffixes: `markers`, `manualPlaces`, `gridPoints`, `weatherData`

**CSS Classes:**
- kebab-case: `.search-mode-tabs`, `.data-row`, `.score-badge`
- Descriptive: `.expand-icon`, `.place-input-row`, `.itinerary-timeline`
- Nested structure reflected in naming: `.weather-mini-card`, `.table-rain-cell`

**DOM IDs:**
- kebab-case: `#location`, `#searchBtn`, `#mapContainer`, `#resultsSection`
- Descriptive purpose: `#placeInput`, `#nearbySuggestions`, `#routeBuilderSection`

## Where to Add New Code

**New Search Feature (e.g., search by weather conditions):**
- Primary code: `app.js` - Add new method in `WeatherChaser` class
- Entry point: Add event listener in `attachEventListeners()` (lines 79-130)
- UI: Add new section in `index.html` controls-section (lines 22-110)
- Styling: Add CSS rules in `style.css`
- Integration: Call from `handleSearch()` (line 150)

**New Display Mode (e.g., heatmap instead of table):**
- Primary code: `app.js` - Add method like `displayAsHeatmap()`, call from `displayResults()` (line 765)
- UI: Add container div in `index.html` results-section (lines 146-186)
- Styling: Add CSS for heatmap visualization in `style.css`
- Data: Use existing `this.weatherData` array

**New External API Integration (e.g., pollution data):**
- Primary code: `app.js` - Add fetch method in API Integration section (lines 601-670)
- Execution: Call from `fetchWeatherForGrid()` (line 601) or create parallel fetch
- Data structure: Extend weather point object with new fields
- Display: Update `generateDetailContent()` (line 927) or create new detail section

**New Route Algorithm (e.g., minimize travel time instead of distance):**
- Primary code: `app.js` - Create new method `buildRouteByTime()` alongside `buildRoute()` (line 1132)
- Selection logic: Duplicate `findNextBestLocation()` and modify scoring formula (lines 1317-1319)
- UI: Add option in route builder controls (lines 193-207)

**Utilities and Helpers:**
- Shared helpers: Bottom of `app.js` (lines 753-763) - `average()`, `sum()` pattern
- Calculations: Co-locate with related methods (e.g., `calculateDistance()` near routing)

## Special Directories

**`.planning/`:**
- Purpose: GSD (Guided Software Development) planning documents
- Generated: Automatically by GSD command-line tool
- Committed: No (listed in `.gitignore`)
- Contents: Codebase analysis docs (ARCHITECTURE.md, STRUCTURE.md, etc.)

**`.git/`:**
- Purpose: Git version control history
- Generated: Yes (auto-created by git init)
- Committed: Yes (contains repository metadata)

## Key Integration Points

**Leaflet Map Integration:**
- Initialization: `initMap()` (line 27)
- Rendering markers: `displayOnMap()` (line 806)
- Route display: `displayRoute()` (line 1379)
- Drawing support: `drawnItems`, `drawControl`, event handlers (lines 37-70)
- Map state: `this.map`, `this.markers`, `this.routeMarkers`, `this.routePolyline`

**External APIs:**
- Nominatim (Geocoding): Called from `geocodeLocation()` (line 236)
- Open-Meteo (Weather): Called from `fetchWeatherForPoint()` (line 633)
- OSRM (Routing): Called from `calculateRoadDistance()` (line 1348)
- Overpass (Place Search): Called from `findNearbyLocations()` (line 406)
- Google Maps: URL generated in `generateGoogleMapsUrl()` (line 1431)

**State Synchronization:**
- Unidirectional flow: User input → API → Processing → Display
- Sort state reflected in: `currentSortColumn`, `currentSortDirection` (lines 7-8)
- Route state tracked in: `currentRoute` (line 15)
- Manual places state: `manualPlaces` (line 16)
- Search mode state: `searchMode` (line 9)

---

*Structure analysis: 2026-02-25*
