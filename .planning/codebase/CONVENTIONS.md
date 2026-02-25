# Coding Conventions

**Analysis Date:** 2026-02-25

## Naming Patterns

**Files:**
- Single file application: `app.js` (main application logic)
- Stylesheet: `style.css` (standard CSS conventions)
- HTML structure: `index.html` (entry point)
- CSS class names use kebab-case: `.tab-btn`, `.control-group`, `.weather-popup`, `.score-badge`, `.expand-icon`

**Functions/Methods:**
- camelCase for method names: `handleSearch()`, `geocodeLocation()`, `calculateScores()`, `displayResults()`, `buildRoute()`, `optimizeRoute()`
- Async methods indicated with `async` keyword: `async handleSearch()`, `async addPlace()`, `async fetchWeatherForGrid()`, `async fetchWeatherForPoint()`
- Private methods (convention only, no `#` syntax): prefixed with no indicator, but grouped by functionality
- Internal utility methods: `average()`, `sum()`, `calculateTempScore()`, `calculateDistance()`
- Toggle/display methods: `showLoading()`, `toggleDrawControl()`, `switchMode()`, `displayOnMap()`, `displayInTable()`

**Variables:**
- camelCase for all variables and properties: `searchMode`, `weatherData`, `currentRoute`, `manualPlaces`, `drawnShape`
- Constants: camelCase with values at top of methods: `batchSize`, `delayBetweenBatches`, `retryCount`, `gridSize`, `radiusKm`
- Array plural names: `markers`, `weatherData`, `manualPlaces`, `routeMarkers`, `currentSuggestions`
- Numeric values often have units in name: `maxTravelPerDay`, `temperature_2m_max`, `rainfall_sum`, `windspeed_10m_max`

**Types/Classes:**
- Single main class: `WeatherChaser` - PascalCase for class name
- Constructor properties initialized as instance variables: `this.map`, `this.markers`, `this.weatherData`, `this.searchMode`

## Code Style

**Formatting:**
- Indentation: 4 spaces (consistent throughout)
- Line length: No strict limit, some lines exceed 100 characters
- Brace style: Opening brace on same line (Allman style): `if (condition) { ... }`
- No semicolons enforced (automatic insertion by JavaScript)
- Template literals used for string interpolation: `` `Weather API error for point ${point.index}` ``

**Linting:**
- No linting configuration detected (no `.eslintrc.*` files)
- No formatting tool configuration (no `.prettierrc` files)
- Code style appears manual/conventional, not enforced by tooling

**Spacing:**
- Single blank line between methods
- Multiple blank lines (2-3) between logical sections marked with comments
- Consistent spacing around operators: `i += batchSize`, `score - a.score`

## Import Organization

**External Libraries:**
- No module imports used (single-file application)
- External libraries included via CDN in HTML: `<link>` and `<script>` tags in `index.html`
- Library loading: Leaflet CSS/JS for maps, Leaflet Draw for drawing tools
- No npm/package management detected

**Path Aliases:**
- Not applicable (single-file vanilla JavaScript)

**Global Scope Usage:**
- Application instantiated as global: `const app = new WeatherChaser();` (presumably at end of app.js)
- DOM API accessed directly: `document.getElementById()`, `document.querySelectorAll()`
- Global Leaflet library accessed: `L.map()`, `L.tileLayer()`, `L.circleMarker()`

## Error Handling

**Patterns:**
- Try-catch blocks for async operations: Used in `handleSearch()`, `addPlace()`, `findNearbyLocations()`, `buildRoute()`, `fetchWeatherForPoint()`
- Error messages shown to user via `alert()`: Frequent throughout for user feedback
- Generic error messages sometimes: `'Error: ' + error.message`, `'Could not find location: ' + location`
- Fallback handling: Exponential backoff for API rate limiting in `fetchWeatherForPoint()` with retry logic
- Network error handling: Checks `response.ok` and `response.status === 429` before throwing
- Null checks for DOM elements: `if (buildRouteBtn) { ... }` pattern used frequently
- Default values for missing data: `point.location || \`${point.lat.toFixed(2)}, ${point.lon.toFixed(2)}\``
- Finally blocks for cleanup: `finally { this.showLoading(false); }` pattern used consistently

## Logging

**Framework:** Native `console` object

**Patterns:**
- `console.error()` for errors: `console.error('Error:', error)`, `console.error(error)`, `console.error('Route building error:', error)`
- `console.log()` for informational messages: `console.log(\`Weather data progress: ${progress}%\`)`, `console.log(\`Rate limited for point ${point.index}, retrying in ${waitTime}ms...\`)`
- `console.warn()` for warnings: `console.warn('OSRM API failed, using air distance')`, `console.warn('Error fetching road distance:', error)`
- Prefix context when useful: Some messages include context like point index or progress percentage
- Production logging: No structured logging, directly logging to console

## Comments

**When to Comment:**
- Section headers for logical groupings: `// Manual Places Functions`, `// Route Builder Functions`, `// Handle drawn shapes`
- Inline explanations for complex logic: `// Optimal temperature range: 20-25°C`, `// Convert seconds to hours`
- API explanations: `// Open-Meteo API with enhanced weather data`, `// Use Nominatim for geocoding`
- Rate limiting explanation: `// Rate limited - wait and retry with exponential backoff`
- Scoring weights: Comments explaining calculation methodology
- TODO-style markers: No TODO/FIXME comments found in codebase

**JSDoc/TSDoc:**
- Not used (vanilla JavaScript, no TypeScript)
- No formal documentation comments on methods
- Comments are informal inline explanations

## Function Design

**Size:** Methods range from 3-4 lines (utilities like `average()`, `sum()`) to 40-50+ lines (complex logic like `handleSearch()`, `buildRoute()`, `optimizeRoute()`)

**Parameters:**
- Most methods take 1-3 parameters
- Callback functions passed via addEventListener: `(e) => this.handleSearch()`
- Array destructuring not used
- Default parameters in use: `retryCount = 0` in `fetchWeatherForPoint()`

**Return Values:**
- Async functions return Promises
- Helper methods return calculated values: `calculateScores()` returns array, `geocodeLocation()` returns object with `{ lat, lon, name }`
- Display methods return void (side effects only)
- Constructors initialize instance state

## Module Design

**Exports:**
- Single class exported: `WeatherChaser` instantiated and used globally
- No named exports or barrel files
- Monolithic single-file architecture

**Barrel Files:**
- Not applicable (single file application)

**State Management:**
- Instance state stored in constructor properties: `this.weatherData`, `this.markers`, `this.currentRoute`
- Mutable state modified via methods: `this.weatherData = this.calculateScores(weatherData)`
- DOM serves as secondary state store: Selected input values accessed via `document.getElementById()`

---

*Convention analysis: 2026-02-25*
