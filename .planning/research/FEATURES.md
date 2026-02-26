# Feature Landscape

**Domain:** Campervan weather routing / trip planning app
**Researched:** 2026-02-26
**Confidence Note:** Web search and WebFetch tools unavailable. Research draws on training knowledge (cutoff August 2025) of Park4Night, iOverlander, Carado, Weather Underground, Roadtrippers, Wanderlog, and related products. Confidence levels reflect this limitation.

---

## Context: What WeatherChaser Already Has

The existing prototype (static HTML/JS) implements:
- Location-based weather grid search (radius + grid density)
- Draw-area mode for custom search polygons
- Manual places mode (add up to 25 cities)
- Greedy route builder (max km/day, start location selector)
- Google Maps export of the built route
- Weather scoring: rain 40%, sun 30%, temp 20%, wind 10%
- 14-day forecast via Open-Meteo
- Color-coded interactive map (Leaflet) + sortable results table
- Trip stats (distance, duration, avg score)

The rebuild core innovation: **intelligent multi-day routing through real populated places** that maximizes cumulative weather score while minimizing backtracking, with configurable stay duration per location.

---

## Table Stakes

Features users expect from any serious travel/weather app. Missing any of these and users leave immediately.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Interactive map with route visualization | Every map-based app has this; users are visually oriented | Medium | Already partially exists; rebuild needs smooth animated route drawing, not just markers |
| Real weather data with forecast (7+ days) | Core utility of the app; users need actionable forecasts | Low | Open-Meteo covers this well; 14-day horizon is competitive |
| Day-by-day itinerary view | Users need to understand "where do I sleep each night" | Medium | Prototype has timeline; rebuild needs day-by-day breakdown with dates |
| Named real locations (towns/cities) | Grid points are meaningless; users navigate to named places | Low-Medium | Geocoding grid → nearest towns is core rebuild requirement |
| Mobile-responsive UI | 60-70% of travel planning happens on mobile | Medium | Current app claims responsive; native iOS/Android apps are phase 2 |
| Trip duration input | Fundamental constraint for any trip planner | Low | Already exists; straightforward |
| Start location selection | Users always have a fixed departure point | Low | Already exists; needs address search not just dropdown of results |
| Export / share route | Users share with travel partners; copy to navigation app | Low-Medium | Google Maps export exists; also need shareable link / PDF |
| Weather score explanation | Users distrust black-box scores; they need to understand why | Low | Score breakdown per location is expected |
| Loading states and error handling | Any network-dependent app must handle slow/failed requests gracefully | Low | Currently minimal; rebuild needs proper UX |
| Region/country scoping | "Search Germany" or "Search Bavaria" is natural for trip planners | Medium | Current radius-from-point is functional; named region search is more intuitive |
| Offline access to saved trips | Users are in areas with poor connectivity; saved itineraries must work offline | Medium | PWA offline caching or native app local storage |
| Unit preferences (km/miles, °C/°F) | EU-focused but British and US visitors exist | Low | Localization toggle |
| Clear reset / new search flow | Users iterate on search parameters constantly | Low | UX detail that matters; currently awkward |

---

## Differentiators

Features that would make WeatherChaser stand out from both generic weather apps and generic trip planners. These are the reasons users choose WeatherChaser over Google Maps + weather app.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Weather-optimized route algorithm (core) | No existing app does "find me the sunniest route for 10 days in Germany" end-to-end | High | This IS the product; algorithm quality is the moat |
| Configurable stay duration per location | "I want to spend at least 2 nights at each stop but max 3" is a campervan-specific need | Medium | Already conceptualized; needs min/max stay config not just max |
| Anti-backtracking penalty in routing | Campervans burn fuel and time; a route that doubles back is frustrating | High | TSP/greedy hybrid with geographic progression heuristic |
| Weather score customization by user preference | Beach campers weight sun; hikers weight wind and rain differently | Medium | Adjustable weight sliders for rain, sun, temp, wind; maybe preset profiles (Beach, Hiking, Sightseeing) |
| Multi-day temporal weather awareness | Don't just score location by average—score "this location on THIS specific day given when we arrive" | High | This is the hard algorithmic problem; location A might be great Tuesday but terrible Wednesday |
| "Weather window" detection | Alerts user: "Location X has a 3-day perfect weather window starting March 15" | High | Would require sweep across forecast horizon; compelling push notification feature |
| Campsite/parking integration | Overlay Park4Night or similar data so route stops at actual overnight spots, not just towns | High | Requires data partnership or scraping; major differentiator for serious van lifers |
| Freemium-viable sharing | "My friend sent me this WeatherChaser link" is viral growth; view-only shared trips should be free | Low | URL-based trip sharing with read-only view |
| Historical weather accuracy overlay | "This region is usually sunny in May based on 5 years of data" adds confidence beyond 14-day forecast | High | Requires historical climate API (Open-Meteo has this); major trust differentiator |
| Route comparison ("Plan A vs Plan B") | Users often want to compare two itinerary options side by side | Medium | Saved plans comparison view; premium feature |
| Carbon footprint / distance budget | Eco-conscious vanlifers care about fuel; also useful as hard constraint ("I have 2000km budget") | Medium | Distance budget as constraint is practical; CO2 estimate is a nice-to-have |
| Dynamic re-routing suggestions | "Weather has changed, here's an updated route" — push notification or in-app alert | High | Requires background jobs monitoring forecast changes for active trips |
| Elevation and terrain awareness | Mountain passes matter for campervans; 2000m pass in winter is impassable | High | Requires elevation API; phase 3 feature |
| Collaboration (shared trip planning) | Couples and groups plan together; real-time or async shared editing | Very High | Firebase or CRDT-based; this is a future differentiator, not MVP |

---

## Anti-Features

Features to deliberately NOT build, at least in early phases. Each is a complexity trap.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Turn-by-turn navigation | Google Maps, Waze, Apple Maps do this perfectly and are free; WeatherChaser can't compete and it's a huge engineering cost | Deep-link to Google Maps / Apple Maps for navigation; this is already done right in prototype |
| Campsite booking/reservation system | Requires partnerships with campsite operators, legal agreements, payment processing, customer support for cancellations | Link to booking.com/camping, Pitchup, or ACSI instead |
| Social feed / travel blog feature | Building a community takes years and distracts from the core algorithm; Park4Night already owns this space | Allow trip export and sharing; don't build UGC infrastructure |
| Real-time traffic routing | Live traffic data is expensive and irrelevant to multi-day planning; users don't need minute-by-minute ETAs | ETAs are approximate; traffic is navigation app territory |
| Hotel/accommodation search | WeatherChaser is for campervan/free camping; adding hotels dilutes the identity and competes with Booking.com | Stay focused on van-life; free camping and campsite parking |
| User-generated content / reviews | Spam risk, moderation cost, legal liability; Park4Night owns EU camping reviews | Integrate with Park4Night API or data if partnership is possible |
| Offline map tile downloads | Massive storage, licensing costs, sync complexity; better UX investment elsewhere in phase 1 | Use cached route data; encourage users to screenshot or export before going offline |
| Freemium feature: unlimited AI chat assistant | LLM API costs are unpredictable at scale; "chat with an AI about your trip" sounds compelling but the algorithm IS the intelligence | Invest in algorithm quality rather than an AI chat layer |
| Full internationalization (20+ languages) | Huge maintenance cost; EU-focused launch means German + English covers 80% of users | German and English first; add French, Dutch, Spanish as premium market grows |
| Weather widgets / embeds for third-party sites | API developer program is a distraction at MVP stage | Build for end users first; developer API is a late-stage revenue play |

---

## Feature Dependencies

```
Region/area input
  → Location geocoding
    → Grid point weather fetch
      → Weather scoring per location
        → Route optimization algorithm
          → Day-by-day itinerary generation
            → Map route visualization
            → Itinerary text view
            → Export (Google Maps, PDF, share link)

User account (auth)
  → Saved trips
    → Trip history
    → Re-routing alerts
    → Premium feature gate

Weather score customization
  → Requires weather scoring engine to be weight-parameterized (not hardcoded)

Temporal weather awareness (day-specific scoring)
  → Requires route algorithm to pass dates through scoring, not just averages
  → Harder than current prototype approach

Campsite integration
  → Requires Park4Night API or data source (external dependency)
  → Can be phased: route first, overlay campsite data second
```

---

## MVP Recommendation

Prioritize these for the first shippable version:

1. **Named-place routing** — Replace grid points with real town/village names; this is the single biggest UX improvement over the prototype
2. **Weather-optimized multi-day route** — The core algorithm: given region + duration + start point, output a sequenced itinerary through towns with weather scores per day
3. **Configurable stay duration** — Min/max nights per location; makes the product feel like it was built for campervans not generic travelers
4. **Day-by-day itinerary with dates** — "Monday 3 March: Freiburg (2 nights, score 84)" is what users need to see
5. **Route map visualization** — Animated route on Leaflet/Mapbox with numbered stops
6. **Google Maps / Apple Maps deep-link export** — Already exists; keep it
7. **Weather score weight sliders (free tier)** — Preset profiles (Beach, Hiking, City); custom sliders as a premium signal
8. **Shareable link** — URL-encoded trip = viral growth mechanism, zero server cost initially

Defer from MVP:
- **User accounts / saved trips**: Add in phase 2 after proving the algorithm is worth saving
- **Campsite overlay**: External dependency; phase 2 or 3
- **Historical climate data**: Interesting differentiator but doesn't help with the core "what's the weather like during my trip" question; phase 3
- **Mobile native apps (iOS/Android)**: PWA first to validate; native is phase 3

---

## Freemium Split

Natural division between free and paid based on value, not arbitrary feature gates.

### Free Tier (must be generous enough to be useful and shareable)

| Feature | Rationale |
|---------|-----------|
| Route generation up to 7 days | Core utility; proves the product works |
| Up to 3 saved trips | Enough to try the product; creates lock-in |
| Standard weather metrics (temp, rain, sun, wind) | Table stakes; can't gate these |
| Google Maps / Apple Maps export | This drives viral growth; never gate it |
| Shareable read-only trip link | Viral acquisition mechanism; must be free |
| Preset weather profiles (Beach, Hiking, Sightseeing) | Easy enough to be useful; custom sliders are premium |
| Mobile web (PWA) | Must be free; native apps can be premium perk |

### Premium Tier (one-time purchase or annual subscription ~EUR 24-49/year)

| Feature | Rationale for Paywall |
|---------|----------------------|
| Trips longer than 7 days (up to 14 days forecast horizon) | Longer planning horizon is clearly more valuable |
| Unlimited saved trips | Storage cost + engagement signal |
| Custom weather score weight sliders | Power users who optimize preferences are enthusiasts; they'll pay |
| Route comparison (Plan A vs Plan B) | Power feature for serious planners |
| Historical climate confidence overlay | Data infrastructure cost; trust premium |
| Dynamic re-routing notifications | Requires push infrastructure and background jobs |
| Ad-free experience | If ads are present on free tier |
| Priority API (no throttling) | Free tier can have soft rate limits |
| Export to GPX / PDF itinerary | Document generation is a power-user need |
| Early access to new regions (outside DACH/EU) | Geographic expansion as a premium perk in growth phase |

### Pricing Signal

Based on comparable travel apps (Roadtrippers Plus at ~USD 30/year, Park4Night Premium at ~EUR 20/year, Windy.app subscription at ~EUR 20/year): **EUR 29/year or EUR 3.99/month** is the natural price anchor. One-time lifetime purchase at EUR 49 appeals to van lifer community norms (own-your-data, anti-subscription sentiment). MEDIUM confidence on pricing; validate with user interviews before locking in.

---

## Competitive Gap Analysis

| App | What It Does | What WeatherChaser Does Differently |
|-----|-------------|-------------------------------------|
| Park4Night | Crowdsourced campsite database; no weather routing | Weather-optimized routing; campsite data is complementary |
| iOverlander | Overlanding-focused campsite/water/fuel spots; global | Focused on weather optimization, not just spot discovery |
| Carado / Hymer App | Motorhome manufacturer apps; vehicle diagnostics, dealer service | No weather routing at all; completely different use case |
| Google Maps / Apple Maps | Turn-by-turn navigation, place discovery | Zero weather integration; WeatherChaser is upstream (planning) not navigation |
| Roadtrippers | US-focused road trip planner with POI recommendations | No weather optimization; attraction-focused not weather-focused |
| Wanderlog | Collaborative trip planner with map itineraries | No weather optimization; general travel not campervan-specific |
| Windy.app / Ventusky | Advanced weather visualization for pilots/sailors | Beautiful weather maps but zero trip routing; different user intent |
| Weather Underground | Hyperlocal weather data | No routing; pure weather data |
| Open-Meteo | Free weather API | Data source, not end-user product |

**The gap WeatherChaser fills:** No product currently answers "I have 10 days, a campervan, and I'm starting from Munich — route me through the best weather in Germany/Austria/Switzerland." This is genuinely unclaimed territory as of training cutoff. MEDIUM-HIGH confidence this gap exists.

---

## Sources

- Existing WeatherChaser prototype (`README.md`, `index.html`, `app.js`) — HIGH confidence (direct inspection)
- Park4Night feature set (training knowledge, last confirmed ~2024) — MEDIUM confidence; verify current premium features at park4night.com
- iOverlander feature set (training knowledge) — MEDIUM confidence
- Roadtrippers / Wanderlog feature patterns (training knowledge) — MEDIUM confidence
- Windy.app / weather app patterns (training knowledge) — MEDIUM confidence
- Freemium pricing anchors (training knowledge of comparable apps ~2024) — LOW confidence; validate against current pricing
- No live web search available during this research session; all competitive claims should be verified against current app store listings and product pages before roadmap finalization
