# 05 — Refactorings (für Stabilität & sauberen Code)

Diese Refactorings sind die strukturelle Basis für die Fixes/Features aus
01–04. Jedes ist so geschnitten, dass es unabhängig gemergt werden kann.

---

## R1 — Gemeinsame `PlaceAutocomplete`-Komponente (höchste Priorität)

**Problem:** Drei divergierende Implementierungen derselben Interaktion:

1. `LocationInput.tsx` — mousedown-Outside-Close, Favoriten, falscher
   Dropdown-Anker (B2).
2. `StartLocationSearch` in `RouteConfigStep.tsx:29–112` — **kein**
   Outside-Close, kein Loading-Feedback im Dropdown.
3. Pflichtstopps (`RouteConfigStep.tsx:262`) — gar keine Suche, Freitext ohne
   Geocoding (B4: Stopps werden ignoriert).

**Ziel:** `src/components/common/PlaceAutocomplete.tsx`

```tsx
interface PlaceAutocompleteProps {
  onSelect: (place: { name: string; fullName: string; lat: number; lng: number;
                      bbox?: [number, number, number, number]; placeId: string }) => void;
  placeholder: string;
  showFavorites?: boolean;        // Favoriten oben einblenden (LocationInput-Fall)
  excludeNames?: Set<string>;     // bereits gewählte ausblenden
  clearOnSelect?: boolean;        // LocationInput: ja; Startort: nein
  disabled?: boolean;             // Polygon-aktiv-Fall
  inline?: boolean;               // mobil: Dropdown in-flow statt absolute (B2)
}
```

**Eingebaute Semantik (einmal richtig, überall gleich):**

- ARIA-Combobox-Pattern (`role="combobox"`, `aria-expanded`,
  `aria-activedescendant`), Pfeiltasten-Navigation.
- Dismiss: `pointerdown` außerhalb, `Escape`, Auswahl, `blur` mit
  `relatedTarget`-Check; Optionen mit `onPointerDown` + `preventDefault`.
- Anker: Dropdown im `position: relative`-Container direkt am Input (B2).
- Nutzt `useLocationSearch` (mit Sequenz-Guard, B3) + optional
  `getFavorites` über den neuen Favorites-Store (R4).
- Auswahl liefert **immer Koordinaten** → keine nicht-geocodierten Zustände
  mehr möglich.

**Migration:** LocationInput (behält Tag-Liste/Radius/Granularität drumherum),
StartLocationSearch, Pflichtstopps, später „Orte in der Nähe"-Suchfeld.

---

## R2 — `appStore` entrümpeln

Verifizierte Altlasten in `src/stores/appStore.ts`:

| Was | Beleg | Aktion |
|---|---|---|
| `searchArea` + `setSearchArea` (Legacy-Single-Area) | einziger echter Nutzer ist der tote Fallback-Zweig `useOptimizer.ts:85–91`; `routes/index.tsx` nutzt längst `addSearchArea` | beide entfernen, Fallback-Zweig löschen |
| `tripConfig.criteria` | toter State — einziger Leser `MobileSearchBar.tsx:55` (Pill-Icon) | entfernen (siehe 02, U2) |
| `tripConfig.preset/customWeights` + `finderConfig.preset` doppelt | Drift-Gefahr zwischen Route/Finder | in `weatherPrefs`-Slice zusammenführen (02, U2) |
| `DEV_SEARCH_AREAS` (appStore.ts:157–169) | „remove before shipping" steht schon dran; auch OPEN-ITEMS §3 | vor Launch entfernen bzw. hinter `VITE_DEV_FIXTURES` |
| `mustVisitNames` + `mustVisitCoords` parallel | Namen werden nie geocodiert (B4) | nur noch `mustVisitCoords` (Name inklusive) |

**Type-Guards statt `in`-Casts:** Es gibt > 10 Stellen mit
`'lat' in area && area.lat !== undefined` + `as`-Casts (`useFinder.ts:83–93`,
`useOptimizer.ts:35–70`, `WeatherFinderPanel.tsx:116–122`,
`LocationInput.tsx`, `MobileSearchBar.tsx:34`…). In `appStore.ts` exportieren:

```ts
export const isPlaceArea   = (a: SearchAreaItem): a is PlaceArea   => a.type === 'place';
export const isPolygonArea = (a: SearchAreaItem): a is PolygonArea => a.type === 'polygon';
export const isRadiusArea  = (a: SearchAreaItem): a is RadiusArea  => a.type === 'radius';
/** Places mit garantierten Koordinaten */
export const isLocatedPlace = (a: SearchAreaItem): a is PlaceArea & { lat: number; lng: number } =>
  isPlaceArea(a) && typeof a.lat === 'number' && typeof a.lng === 'number';
```

Nebenbefund: `PlaceArea.lat/lng` optional zu machen war die Wurzel dieser
Casts — nach R1 liefert jede Auswahl Koordinaten → `lat/lng` können
**required** werden (Favoriten/Picked liefern sie ohnehin), was die Guards
größtenteils überflüssig macht.

---

## R3 — Mobile-Shell-State konsolidieren (Sheet + Suchleiste)

**Problem:** `sheetSnap`/`searchExpanded` sind lokale States in
`routes/index.tsx`, die imperativ an Modewechsel angepasst werden (Effekte in
Z. 48–54) — B1 ist genau ein vergessener Übergang.

**Ziel:** kleiner Hook `useMobileShell(mode, hasResults)` in
`src/hooks/useMobileShell.ts`, der die Regeln deklarativ bündelt:

- `sheetExists` = Ergebnis-Modus (Route oder Finder mit Daten)
- `sheetSnap`: bei Ergebnis-Eintritt → 1; bei Sheet-Unmount → 0
- `searchBarHidden` = `sheetExists` (abgeleitet, nie gespeichert)
- `searchExpanded`: bei Ergebnis-Eintritt → false

Damit ist `index.tsx` nur noch Verdrahtung, und Zustands-Bugs dieser Art sind
an einer Stelle testbar. (Langfristig ersetzt X4/History-Integration Teile
davon.)

---

## R4 — Favoriten: ein Store statt dreier lokaler Kopien

**Problem:** `LocationInput` (Z. 127–145), `WeatherFinderPanel` (Z. 82–93) und
`SavedTab` laden Favoriten jeweils unabhängig in lokalen State — nach einem
Toggle sind die anderen Ansichten veraltet; Matching per
`place_name + |lat/lng| < 0.001` ist dreifach dupliziert
(`WeatherFinderPanel.tsx:199–203`).

**Ziel:** `src/stores/favoritesStore.ts` (zustand):

```ts
interface FavoritesState {
  favorites: Favorite[];
  load(): Promise<void>;                      // einmal pro Login
  toggle(name: string, lat: number, lng: number): Promise<void>; // optimistisch
  isFavorite(lat: number, lng: number): boolean;  // ein Matching, eine Definition
}
```

- Laden bei Auth-Änderung (Subscription auf `authStore` wie beim
  Subscription-Store-Muster).
- DB-Härtung: Unique-Constraint gegen Duplikate —
  `unique (user_id, round(lat::numeric, 3), round(lng::numeric, 3))` via
  Migration; `toggleFavorite` in `userdata.ts` bleibt, wird aber nur noch vom
  Store aufgerufen.

---

## R5 — Fehler-Codes statt String-Matching

**Problem (verifiziert):** `EntryPanel.tsx:140–146` mappt Fehlertexte per
`error.startsWith('Overpass')` und Regex `/^HTTP \d|Open-Meteo|TimeoutError|…/`
auf i18n-Keys — fragil (Worker-Messages ändern sich, Sprachen mischen sich).

**Ziel:** Worker liefern typed Codes:

```ts
type AppErrorCode = 'no_towns' | 'overpass_unavailable' | 'weather_failed'
                  | 'missing_config' | 'no_location' | 'unknown';
```

- `finder.worker.ts` / `optimizer.worker.ts`: `catch` → Fehler klassifizieren
  (an der Quelle, wo der Kontext existiert) und `{ type:'error', code, detail? }`
  posten; `detail` nur für Konsole/Debug.
- UI: `t(\`errors.${code}\`)` — ein Mapping, beide Sprachen, keine Regexe.
  Fehlende Keys in `en/common.json` ergänzen (Regel 4).

---

## R6 — i18n-Hygiene

Verstöße gegen Regel 4 (hartkodierte/deutsch-defaultete Strings) —
gefundene Stellen:

- Inline-Default-Strings in `t(key, 'Deutscher Text')`:
  `WeatherFinderStep.tsx` (mehrfach), `EntryPanel.tsx:128,141–144`,
  `LocationInput.tsx:263,308`, `FinderFilterBar.tsx` (alle Labels),
  `WeatherFinderPanel.tsx:239–256` (Sort-Labels + Titel). → Defaults in die
  **beiden** Locale-JSONs verschieben, Inline-Defaults entfernen (sonst fällt
  EN still auf Deutsch zurück).
- Hartkodierte Locales in Formatierung: `SavedTab.tsx:43–52`
  (`toLocaleDateString('de-DE')`), `FinderFilterBar.tsx:37`
  (`Intl.DateTimeFormat('de')`). → `i18n.language`-abhängig machen; Muster
  existiert bereits in `MobileSearchBar.tsx:44`. Empfohlen: Helper
  `src/utils/dateFormat.ts` mit `formatDay(date, lang)` /
  `formatRange(from, to, lang)`.
- Kartenlabels fest deutsch: `MapContainer.tsx:44` → F4 (04) löst das.

---

## R7 — Geo-Helfer deduplizieren

`haversineKm` existiert 2× (`WeatherFinderPanel.tsx:42`,
`fallbackPlaces.ts:39`), Point-in-Polygon 1× (`fallbackPlaces.ts:50`),
Grad→km-Näherungen 3× (`overpass.ts:66–84`, `useOptimizer.ts:49`,…).
→ `src/utils/geo.ts` mit `haversineKm`, `pointInPolygon`,
`polygonAreaKm2`, `bboxAroundPoint(lat, lng, radiusKm)`. Wird von B6, F2, F3
ohnehin gebraucht.

---

## R8 — Supabase-Typisierung reparieren statt `as any`

`userdata.ts` umgeht die Typen an 4 Stellen mit
`(supabase.from('…') as any)` (Z. 22, 75, 79, 106). Ursache ist meist ein
Client ohne `Database`-Generic. Fix: `getSupabase()` in `lib/supabase.ts` als
`SupabaseClient<Database>` typisieren (Typ existiert bereits vollständig in
`types/database.ts`), dann Casts entfernen. Neue Tabellen (X3
`search_history`) direkt in `types/database.ts` ergänzen.

---

## Nicht-Ziele (bewusst verschoben)

- Kein Wechsel auf eine Autocomplete-/UI-Library — Eigenbau ist klein genug.
- Keine Umstellung des Canvas-Zeichnens auf Terra Draw. Verifiziert:
  `@watergis/maplibre-gl-terradraw` wird **nirgends importiert** → Dependency
  aus `apps/web/package.json` entfernen. Nur das **Rendering** des fertigen
  Polygons zieht in die Map-Layer um (siehe 03/X1).
- `packages/locales`-Extraktion (OPEN-ITEMS §3) bleibt separates Vorhaben.
