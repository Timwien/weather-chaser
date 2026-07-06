# 04 — Neue Features (Feedback 2026-07)

Refresh-Funktion, „Orte in der Nähe", Ort per Karten-Tap, lokalisierte
Ortsnamen. Neue Strings als i18n-Keys in DE **und** EN.

---

## F1 — Refresh-Funktion (installierte Web-App ohne Browser-Chrome)

**Problem:** In der als App installierten PWA gibt es keinen
Browser-Reload; friert die UI ein, kommt man nicht mehr raus.

**Maßnahmen (gestaffelt, alle klein):**

1. **Expliziter Refresh-Button** an zwei Stellen:
   - `SettingsTab` im AccountModal: Zeile „App neu laden" mit
     `window.location.reload()`.
   - Footer des EntryPanels (neben dem Account-Button,
     `EntryPanel.tsx:184–211`): kleines Reload-Icon — erreichbar, ohne dass
     irgendein anderes Feature funktionieren muss.
2. **Globale ErrorBoundary** (`src/components/common/AppErrorBoundary.tsx`,
   um `<App/>` in `main.tsx`): fängt Render-Crashes (häufigste Ursache für
   „eingefroren") und zeigt einen Screen mit Fehlermeldung + „Neu laden"-CTA
   statt weißem/totem Bildschirm.
3. **Reload-Angebot in Fehlerzuständen:** im Fehlerbanner des EntryPanels und
   im `LoadingOverlay`, wenn ein Ladevorgang > 30 s läuft („Dauert
   ungewöhnlich lange — neu laden?").
4. Bewusst **kein** Custom-Pull-to-Refresh: kollidiert mit den
   Bottom-Sheet-Drag-Gesten.

**Nebenbefund (verifiziert):** Es gibt **kein Web-App-Manifest** und keine
`apple-mobile-web-app-*`-Meta-Tags (`index.html`, `public/` enthält nur
Favicon + Fallback-Daten). „Zum Home-Bildschirm" läuft also ohne
Standalone-Modus/Icon/Name. Falls echte PWA-Installierbarkeit gewünscht:
`manifest.webmanifest` (name, icons 192/512, `display: standalone`,
`theme_color` je Theme) + Meta-Tags ergänzen — kleines separates Vorhaben,
unabhängig vom Refresh-Button. Ein Service Worker ist dafür **nicht** nötig
und sollte wegen Cache-Invalidierungs-Risiken vorerst vermieden werden.

**i18n:** `common.reload` (DE „Neu laden" / EN „Reload"),
`errors.boundary_title` (DE „Etwas ist schiefgelaufen" / EN „Something went
wrong"), `loading.taking_long` (DE „Dauert ungewöhnlich lange…" / EN „Taking
unusually long…").

**Verifikation:** Im DevMode einen Render-Fehler provozieren → Boundary-Screen
mit funktionierendem Reload; Reload-Button in Settings/Footer lädt die App neu.

---

## F2 — „Orte in der Nähe" (intelligente Vorschläge)

**Ziel:** Größere Orte/Städte vorschlagen, die nahe den bereits gewählten
Orten liegen — 1-Tap-Hinzufügen.

**Datenquelle — bereits vorhanden, kein API-Call nötig:**
`/fallback-places.json` (8.604 EU-Orte ≥ 15.000 Einwohner inkl. Population,
~300 KB, lazy-geladen; Loader existiert in `services/fallbackPlaces.ts`).
Damit sind Vorschläge **sofort, offlinefähig und kostenlos**.

**Neuer Service `src/services/nearbyPlaces.ts`:**

```ts
interface NearbySuggestion { name: string; lat: number; lng: number; population: number; distanceKm: number; }

async function suggestNearby(
  anchors: Array<{ lat: number; lng: number }>,   // aus searchAreas (places + polygon-centroid)
  opts: { limit?: number; maxKm?: number; exclude?: Set<string> } = {},
): Promise<NearbySuggestion[]>
```

- Kandidaten = Orte mit `min(dist zu einem Anchor) <= maxKm` (Default 75 km),
  ohne bereits gewählte (Name+Koordinaten-Epsilon).
- Ranking: `score = population / (distanceKm + 10)²` — bevorzugt große Städte,
  bestraft Entfernung; Top-`limit` (Default 6).
- `loadPlaces()`/`haversineKm` aus `fallbackPlaces.ts` wiederverwenden →
  gemeinsame Helfer nach `src/utils/geo.ts` extrahieren (siehe 05, R7).

**UI:** Chip-Reihe unter dem Ort-Input in `LocationInput` (nur wenn
≥ 1 Ort gewählt und < 8 Orte insgesamt):

```
IN DER NÄHE   [+ Stettin] [+ Greifswald] [+ Stralsund] …
```

- Tap → `addSearchArea({type:'place', id:'nearby-…', name, lat, lng})`;
  Liste aktualisiert sich (der neue Ort wird selbst Anchor).
- Styling wie `must-visit-suggestions`-Pills, aber in Touch-Größe (U1).
- Gleiche Komponente optional im Pflichtstopps-Feld wiederverwenden.

**i18n:** `entry.nearby_label` (DE „In der Nähe" / EN „Nearby"),
`a11y.add_nearby` (DE „{{name}} hinzufügen" / EN „Add {{name}}").

**Verifikation:** Ahlbeck hinzufügen → Vorschläge müssen plausible größere
Nachbarorte zeigen (z. B. Świnoujście/Swinemünde, Greifswald); Tap fügt hinzu
und Vorschläge rotieren nach.

---

## F3 — Orte per Tippen auf die Karte hinzufügen

**Ist-Zustand (verifiziert):** `PickLocationOnClick`
(`MapContainer.tsx:162–197`) existiert, aber: nur über den Pin-Button im
Ort-Input aktivierbar, **one-shot** (`once('click')`), fügt ohne Bestätigung
hinzu, und reverse-geocodiert mit `Accept-Language: en`.

**Ziel-Architektur — Tap mit Bestätigungs-Popup, immer verfügbar im
Einstiegsmodus:**

1. **Neuer Flow `TapToAddLocation`** (ersetzt `PickLocationOnClick`):
   - Aktiv, wenn `mode` ∈ {idle, route-config, weather-finder-Eingabe} und
     **nicht** `isDrawing` (Kollision mit Polygon-Zeichnen ausschließen) und
     kein Marker/Feature unter dem Tap (Marker-Handler stoppen Propagation —
     verifizieren; sonst `e.originalEvent.defaultPrevented` prüfen).
   - Tap → MapLibre-Popup am Punkt mit reverse-geocodetem Namen + Button
     „+ Hinzufügen" und X. Kein stilles Hinzufügen — verhindert
     Versehens-Adds beim Pannen/Verklicken.
   - Bestätigen → `addSearchArea({ type:'place', id:'picked-<ts>', name, lat, lng })`,
     Popup zu. Mehrfach hintereinander möglich (kein Modus nötig).
   - Debounce: während `flyTo`-Animationen und < 300 ms nach `moveend` keine
     Taps akzeptieren (verhindert Fehltaps beim Karten-Stoppen).
2. **Pin-Button im Ort-Input bleibt** als expliziter Einstieg (setzt nur noch
   einen Hinweis-Toast „Tippe auf die Karte" — der Flow selbst ist derselbe);
   `pickingLocation`-State im Store kann entfallen oder auf „Hinweis anzeigen"
   reduziert werden.
3. Reverse-Geocoding-Sprache: siehe F4 (gleicher Fix).

**i18n:** `map.tap_add_title` (DE „Ort hinzufügen?" / EN „Add place?"),
`map.tap_add_confirm` (DE „Hinzufügen" / EN „Add"), `map.tap_hint`
(DE „Tippe auf die Karte, um einen Ort zu wählen" / EN „Tap the map to pick a
place").

**Verifikation:** Im Einstieg auf die Karte tippen → Popup mit Ortsname →
Hinzufügen → Tag erscheint im Ort-Input. Während des Zeichnens: kein Popup.
In Ergebnissen: kein Popup.

---

## F4 — Ortsnamen in der eingestellten Sprache (Stettin statt Szczecin)

**Root Cause (verifiziert):** Drei Stellen liefern heute Namen ohne
Sprachbezug:

1. `services/nominatim.ts:38,67` — hartkodiert `'Accept-Language': 'en'`
   (Suche **und** Reverse-Geocoding).
2. Die Vercel-Proxys `api/proxy/nominatim.ts` / `nominatim-reverse.ts` reichen
   keine Sprache an Upstream weiter — und cachen pro URL, ein
   Accept-Language-**Header** würde die Cache-Trennung brechen.
3. Overpass-Towns (`overpass.ts:114 parseTowns`) nutzen nur `tags.name`
   (Endonym); Kartenlabels sind fest auf Deutsch
   (`MapContainer.tsx:44 switchLabelsToGerman`).

**Fix-Architektur — Sprache als Query-Parameter durchreichen:**

1. **Client (`nominatim.ts`):** `searchPlace(query, lang)` /
   `reverseGeocode(lat, lng, lang)` — `lang` aus `i18n.language`
   (`'de' | 'en'`, auf 2 Buchstaben normalisieren). Als
   **URL-Param** `accept-language=<lang>` setzen (Nominatim unterstützt das) —
   nicht als Header, damit der Proxy-Cache pro Sprache separiert (Cache-Key =
   volle URL).
2. **Proxys:** Param `accept-language` whitelisten und an Upstream weitergeben
   (beide Proxy-Dateien, je 2 Zeilen).
3. **Overpass-Towns:** `parseTowns(nodes, lang)` bevorzugt lokalisierten Tag:

```ts
name: n.tags[`name:${lang}`] ?? n.tags.name
```

   `lang` läuft über `FinderWorkerInput.config.lang` in den Worker (Aufrufer:
   `useFinder.ts`; analog `optimizer.worker.ts`). Kein Query-Mehraufwand —
   `out body` liefert alle Tags bereits mit.
4. **Kartenlabels:** `switchLabelsToGerman` → `applyMapLanguage(map, lang)`
   mit `['coalesce', ['get', `name:${lang}`], ['get', 'name']]`; auf
   `i18n.on('languageChanged', …)` reagieren (Re-Apply wie beim Theme-Switch,
   Mechanik existiert über `styledata`).
5. **Suggestions-Cache:** `useLocationSearch`-Cache-Key um `lang` erweitern
   (`services/`-Cache in `useLocationSearch.ts:5` ist Modul-global).
6. Grenzen dokumentieren: GeoNames-Fallback und gespeicherte
   Favoriten/Suchen behalten den Namen, mit dem sie erfasst wurden —
   akzeptiert für v1.

**Verifikation:** App auf Deutsch → „Stettin" suchen → Vorschlag „Stettin…";
App auf Englisch → „Szczecin". Finder-Ergebnisse in PL-Polygon zeigen
deutsche Exonyme, wo OSM `name:de` hat. Kartenlabels wechseln mit der Sprache.

## Betroffene Dateien

F1: `main.tsx`, neu `components/common/AppErrorBoundary.tsx`,
`components/account/SettingsTab.tsx`, `EntryPanel.tsx`, `LoadingOverlay`.
F2: neu `services/nearbyPlaces.ts`, `utils/geo.ts`, `LocationInput.tsx`.
F3: `MapContainer.tsx`, `LocationInput.tsx`, `appStore.ts`.
F4: `services/nominatim.ts`, `api/proxy/nominatim.ts`,
`api/proxy/nominatim-reverse.ts`, `services/overpass.ts`,
`workers/finder.worker.ts`, `workers/optimizer.worker.ts`,
`hooks/useFinder.ts`, `hooks/useLocationSearch.ts`, `MapContainer.tsx`.
Alle: beide Locale-JSONs.
