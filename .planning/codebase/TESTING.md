# Testing Patterns

**Analysis Date:** 2026-02-25

## Test Framework

**Runner:**
- Not detected - No test runner configured

**Assertion Library:**
- Not applicable

**Run Commands:**
- No npm scripts configured for testing
- No test configuration files found (`jest.config.*`, `vitest.config.*`, `mocha.config.*`)

## Test File Organization

**Location:**
- No test files found in codebase
- No separate `test/`, `tests/`, `__tests__/` directories
- Application is not tested via automated unit/integration tests

**Naming:**
- Not applicable

**Structure:**
- Not applicable

## Test Coverage

**Requirements:**
- Not enforced (no coverage configuration detected)

**Current Status:**
- Zero test coverage - Application code is untested
- Single-file application with 1561 lines of code entirely without automated tests

## Testing Approach (Observed)

**Manual Testing Only:**
- Application relies on manual browser testing
- User interaction flows must be tested manually through UI
- API integrations verified through browser network inspection
- No CI/CD testing pipeline configured

## Key Functions Without Tests

**Critical Paths Lacking Tests:**
- `handleSearch()` - Main search workflow with three modes (location, draw, places)
  - No validation tests for input parameters
  - No tests for geocoding failures or API errors
  - No tests for grid generation logic

- `fetchWeatherForGrid()` and `fetchWeatherForPoint()` - Weather API integration
  - No tests for rate limiting and exponential backoff retry logic
  - No tests for malformed API responses
  - No tests for network failures
  - Retry logic at lines 641-646 is untested

- `calculateScores()` - Weather scoring algorithm
  - Complex calculation at lines 672-739 with weighted scoring
  - No tests for edge cases (all-null values, extreme temperatures)
  - Score calculation weights: rain (25%), rain chance (25%), sun (30%), temperature (15%) - no validation tests

- `optimizeRoute()` - Route optimization logic
  - Lines 1177-1330 contain complex TSP-like algorithm
  - No tests for different start points or route constraints
  - No tests for edge case: only 2 locations

- `geocodeLocation()` - Location parsing and Nominatim API
  - Lines 223-259 handle coordinate parsing with regex
  - No tests for invalid coordinate formats
  - No tests for API failures or empty results

- `generateGridFromCenter()` and `generateGridFromShape()` - Grid generation
  - Lines 519-584 contain geometric calculations
  - No tests for boundary conditions or grid accuracy

- `calculateDistance()` - Distance calculation using OSRM API
  - Lines 1330-1378 have fallback to air distance
  - No tests for API failures triggering fallback

**Validation Logic Without Tests:**
- Input validation scattered throughout: location existence checks, array length validation
- No centralized validation framework
- Alert dialogs show error messages but no test coverage for validation flow

## Mocking Needs (If Tests Were Written)

**APIs to Mock:**
- Nominatim Geocoding API (`https://nominatim.openstreetmap.org/search`)
- OpenWeather API (`https://api.open-meteo.com/v1/forecast`)
- Overpass API for nearby locations (`https://overpass-api.de/api/interpreter`)
- OSRM API for road distances (`https://router.project-osrm.org/route/v1/driving`)

**DOM to Mock:**
- `document.getElementById()` for form elements: `location`, `placeInput`, `searchBtn`, `radius`, `gridSize`, `days`, etc.
- `document.querySelectorAll()` for tabs and sortable columns
- Leaflet map instance and drawing tools: `L.map()`, `L.circleMarker()`, `L.polyline()`
- CSS class manipulation for visibility: `classList.add()`, `classList.remove()`

**Browser APIs to Mock:**
- `fetch()` - All network requests
- `setTimeout()` - For sleep delays and retry waits
- `Math.random()` - If randomization added to routing

## Edge Cases and Error Scenarios Not Tested

**Geocoding:**
- Location not found (line 250-251: throws error)
- Invalid coordinate format (line 226)
- Nominatim API returns empty results

**Weather Data:**
- API returns null weather data (line 676: skipped with continue)
- Null or undefined values in weather arrays (lines 754, 761: filtered out)
- Extreme temperature values edge cases for scoring

**Route Building:**
- Less than 2 data points available (line 1133-1135)
- Route optimization fails to find valid path (line 1156-1158)
- Starting point not found in sorted spots (line 1187)

**API Rate Limiting:**
- 429 status handling with exponential backoff (lines 641-646)
- Retry exhaustion after 3 attempts
- Other HTTP error codes (logged but not specially handled)

**Manual Places Mode:**
- Duplicate location added (lines 279-285: prevented with check)
- Maximum 25 locations enforcement (lines 272-274)
- Clearing all places with confirmation dialog (line 330)

**State Management:**
- Mode switching between location/draw/places without clearing state
- Search mode validation before showing results
- Drawn shape cleared properly on DELETED event (line 68)

## Testing Patterns to Implement

**Unit Testing Framework Setup Needed:**
- No test infrastructure exists
- Would need to refactor to support dependency injection (currently tightly coupled to DOM)
- Separating business logic from UI presentation would enable testable units

**DOM-Independent Logic:**
For future tests, these functions could be extracted to testable units:
- `geocodeLocation(location)` - Pure async function returning coords
- `calculateScores(weatherData)` - Pure calculation function
- `calculateTempScore(temp)` - Pure utility function
- `average(arr)` and `sum(arr)` - Pure utility functions
- `generateGridFromCenter()` and `generateGridFromShape()` - Pure geometric calculations

**Integration Tests Needed For:**
- Full search workflow (input validation → geocoding → API calls → display)
- Route building workflow (selection → optimization → display)
- Mode switching (location ↔ draw ↔ places)
- Map interactions (drawing, clicking markers)

---

*Testing analysis: 2026-02-25*
