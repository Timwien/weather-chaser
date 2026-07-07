# 01 — Bugfixes (Feedback 2026-07)

Analyse + Fix-Architektur für die gemeldeten Bugs. Alle Root Causes wurden im
Code verifiziert (Datei:Zeile-Referenzen). Umsetzung: siehe Reihenfolge in
`00-UEBERSICHT.md`. Neue UI-Strings immer als i18n-Keys in **beiden** Locales
(`apps/web/src/i18n/locales/{de,en}/common.json`) anlegen — Regel 4.

---

## B1 — Top-Suchleiste („Wohin, wann…") verschwindet nach „Zurück"

**Symptom:** Nach Antippen eines Wetter-/Routen-Details und anschließendem
„Zurück" ist die Such-Pill oben weg; nur noch die Karte ist bedienbar.

**Root Cause (verifiziert):** `apps/web/src/routes/index.tsx:132`

```tsx
<MobileSearchBar ... hidden={sheetSnap === 2 || sheetExists} />
```

- Tap auf ein Ergebnis-Detail setzt `sheetSnap = 2` (`handleFinderSelectFromPanel`
  / `handleStopSelectFromPanel`, index.tsx:64–74).
- „Zurück" ruft `reset()` → `finderTowns = null` / `mode = 'idle'` → das Sheet
  unmountet (`sheetExists = false`), **aber `sheetSnap` bleibt `2`**.
- Damit bleibt `hidden = true` → die Pill (und damit das gesamte EntryPanel,
  das nur als Kind der MobileSearchBar rendert) ist dauerhaft unsichtbar.

**Fix (beides umsetzen, defensiv):**

1. `hidden={sheetExists}` — die Bedingung `sheetSnap === 2` ist redundant, weil
   das Sheet bei Snap 2 ohnehin existiert. Damit kann veralteter Snap-State die
   Pill nie mehr verstecken.
2. Snap-State zurücksetzen, wenn das Sheet verschwindet:

```tsx
useEffect(() => {
  if (!sheetExists) setSheetSnap(0);
}, [sheetExists]);
```

**Refactoring-Hinweis:** `sheetSnap`/`searchExpanded` in einen Hook
`useMobileShell(mode)` ziehen, der die Zustände aus `mode` ableitet statt sie
imperativ zu setzen (siehe `05-REFACTORINGS.md` R3). Strukturell löst außerdem
die optionale History-Integration (03, U3) diese ganze Bug-Klasse.

**Verifikation:** Mobil: Suche ausführen → Ergebnis antippen (Sheet auf Full)
→ „Zurück" → Pill muss sofort wieder oben erscheinen. Gleiches für Routen-Flow.

---

## B2 — Städte-Dropdown erscheint zu weit unterhalb des Suchfelds

**Symptom (Screenshot):** Vorschläge/Favoriten erscheinen unter „Orte suchen"
(Granularitäts-Chips) statt direkt unter dem Eingabefeld.

**Root Cause (verifiziert):** `apps/web/src/components/entry/EntryPanel.css:540`

```css
.autocomplete-dropdown { position: absolute; top: calc(100% + 4px); ... }
```

Der Anker ist `.location-input-wrapper` (EntryPanel.css:348, `position:
relative`) — der Wrapper enthält aber **Label + Tags + Eingabezeile +
Radius-Slider + Granularitäts-Chips**. `top: 100%` platziert das Dropdown also
unter den gesamten Block, nicht unter das Eingabefeld. In
`LocationInput.tsx:326–350` wird das `<ul>` als Geschwister der Eingabezeile
gerendert.

**Fix:**

- Das `<ul className="autocomplete-dropdown">` in LocationInput.tsx **in den
  `.location-input-container`** verschieben (der hat bereits
  `position: relative`, EntryPanel.css:496) — direkt hinter das `<input>`.
  Dann ankert `top: 100%` an der Eingabezeile.
- **Empfehlung mobil:** Innerhalb der aufgeklappten Such-Pill
  (`.mobile-search-body`, scrollt mit `overflow-y: auto`) das Dropdown
  stattdessen **in-flow** rendern (`position: static`, volle Breite, direkt
  unter der Eingabezeile). Absolutes Positionieren in einem Scroll-Container
  führt sonst zu Clipping am unteren Rand. CSS-Variante über Media Query oder
  Modifier-Klasse `.autocomplete-dropdown--inline`.

Dieselbe Korrektur gilt automatisch für alle Verwender, sobald das Dropdown in
die gemeinsame `PlaceAutocomplete`-Komponente extrahiert ist (05, R1).

**Verifikation:** Mit 1 Ort + Radius-Slider + Granularität sichtbar tippen →
Dropdown muss direkt unter dem Feld aufgehen, nicht unter den Chips.

---

## B3 — Dropdown bleibt nach Abbruch der Suche sichtbar

**Symptom:** Ort suchen, dann abbrechen (Text löschen, Tastatur schließen,
woandershin tippen) → Liste bleibt stehen.

**Root Causes (verifiziert), `LocationInput.tsx`:**

1. Outside-Close hört nur auf `mousedown` (Z. 163–171) — Desktop-Semantik.
   Auf Touch-Geräten ist `pointerdown` das robuste Ereignis; außerdem fehlt
   jegliches Blur-Handling (iOS „Fertig"-Taste schließt nur die Tastatur,
   der Fokus/das Dropdown bleiben).
2. Bei leerem Input matchen **alle** Favoriten (Z. 246–249) → `showDropdown`
   bleibt `true`, solange `dropdownOpen` nicht explizit false wird.
3. Race Condition in `useLocationSearch.ts`: zwei debounced Fetches können in
   falscher Reihenfolge auflösen (keine Sequenznummer) → veraltete Ergebnisse
   überschreiben neuere.
4. `StartLocationSearch` (`RouteConfigStep.tsx:29–112`) hat **gar kein**
   Outside-Close — nur Escape/Auswahl schließen das Dropdown.
5. **Wiederöffnen nach Auswahl mit veralteter Liste:** `selectResult`
   (LocationInput.tsx:202–220) leert zwar das Eingabefeld, aber **nicht**
   `results` im `useLocationSearch`-State, und ruft danach
   `inputRef.current?.focus()` auf. Auf Touch-Geräten blurt das Antippen der
   Option das Input → der programmatische `focus()` feuert ein Focus-Event →
   `handleFocus` → `setDropdownOpen(true)` → das Dropdown öffnet sofort
   wieder, mit den **alten** Suchergebnissen des gerade gewählten Orts plus
   Favoriten.

**Fix-Architektur:** zentral in der neuen `PlaceAutocomplete`-Komponente
(05, R1) lösen, nicht dreimal einzeln:

- Dismiss-Semantik: `pointerdown` außerhalb, `Escape`, Auswahl, **und**
  `onBlur` (mit `relatedTarget`-Check, damit Tap auf eine Option nicht als
  „außerhalb" zählt — Optionen behalten `onPointerDown` mit
  `e.preventDefault()`).
- Sichtbarkeit: Dropdown nur bei fokussiertem Feld; bei leerem Feld Favoriten
  nur direkt nach Fokus zeigen (bewusstes „Favoriten durchstöbern"), beim
  Verlassen sofort schließen.
- Nach Auswahl: `results` im Hook leeren (`useLocationSearch` bekommt eine
  `clear()`-Funktion) und Dropdown **nicht** durch den programmatischen
  Refokus wieder öffnen (Flag „openedByUser" oder Fokus ohne Open-Trigger) —
  behebt Ursache 5.
- `useLocationSearch`: Request-ID-Guard —

```ts
const seq = useRef(0);
// im Timeout:
const mySeq = ++seq.current;
const data = await searchPlace(query);
if (mySeq !== seq.current) return; // veraltete Antwort verwerfen
```

**Verifikation:** Tippen → Abbrechen über (a) Text löschen, (b) Tastatur
schließen, (c) Tap auf Karte/anderes Feld — Dropdown muss in allen Fällen zu
sein. Schnelles Tippen/Löschen darf keine veralteten Listen anzeigen.

---

## B4 — „Pflichtstopps": gleiche Dropdown-Probleme + stiller Funktionsverlust

**Zwei getrennte Punkte:**

1. **Dropdown-Probleme im Routen-Konfigurationsschritt** stammen vom
   Startort-Feld (`StartLocationSearch`) — Fix über B3/R1 (gemeinsame
   Komponente).
2. **Kritischer Befund (verifiziert): Pflichtstopps werden aktuell komplett
   ignoriert.** `RouteConfigStep` schreibt nur `mustVisitNames` (Freitext);
   **nichts** geocodiert die Namen nach `mustVisitCoords` —
   `grep mustVisitCoords` zeigt nur den Reader (`useOptimizer.ts:140`,
   `optimizer.worker.ts:102`). Der Optimizer bekommt immer eine leere Liste;
   der Nutzer merkt nichts.

**Fix:**

- Pflichtstopp-Eingabe auf `PlaceAutocomplete` umstellen: Auswahl liefert
  sofort `{ name, lat, lng }` → direkt in `tripConfig.mustVisitCoords`
  schreiben. `mustVisitNames` als separates Feld entfernen (Anzeige aus
  `mustVisitCoords[].name` ableiten) — ein State statt zwei, die
  auseinanderlaufen können.
- Die Quick-Add-Pills (Vorschläge aus `searchAreas`, RouteConfigStep.tsx:120)
  übernehmen `lat/lng` direkt aus der jeweiligen `PlaceArea`.
- Freitext ohne Auswahl: Enter übernimmt das erste Suchergebnis (wie heute in
  LocationInput), sonst kein Add — verhindert nicht-geocodierte Stopps.

**Verifikation:** Route mit 1 Pflichtstopp generieren → der Ort muss in der
Route auftauchen (vorher: nie). Unit-Check im Worker: `mustVisitCoords`
nicht leer.

---

## B5 — Seiten-Zoom mobil („Spielraum" links/rechts, Menü abgeschnitten)

**Symptom:** Horizontales Wackeln/Spielraum, Menü teils nicht ganz sichtbar;
Auto-Zoom beim Tippen in die Ortssuche.

**Root Causes (verifiziert):**

1. `apps/web/index.html:5` — Viewport ohne Zoom-Begrenzung:
   `content="width=device-width, initial-scale=1.0, viewport-fit=cover"`.
2. iOS Safari zoomt **automatisch** auf Inputs mit `font-size < 16px` —
   `.text-input` hat 13px (`--font-size-sm`, EntryPanel.css:505). Der
   Auto-Zoom bleibt nach dem Fokus bestehen → genau der beschriebene
   „hineingezoomte" Zustand mit seitlichem Spielraum.

**Fix (Reihenfolge wichtig — 2 ist die eigentliche Ursache):**

1. **Inputs mobil auf 16px:** in `global.css` (oder tokens):

```css
@media (max-width: 768px) {
  .text-input, .must-visit-input, select, textarea { font-size: 16px; }
}
```

2. **Viewport-Meta erweitern:**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0,
  maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

   `maximum-scale=1` unterbindet den Input-Auto-Zoom in Safari zuverlässig.
   **MapLibre-Zoom ist davon unabhängig** (eigene Gesten-Engine im Canvas) —
   Karten-Pinch/-Doppeltipp funktionieren weiter. A11y-Abwägung: iOS ignoriert
   `user-scalable=no` für bewussten 3-Finger-Zoom (Bedienungshilfen), der
   Verlust ist akzeptabel für eine Karten-App; dokumentieren.
3. `touch-action: manipulation` auf interaktive Elemente (Buttons, Chips,
   Pills) — entfernt die 300ms-Doppeltipp-Erkennung und Doppeltipp-Zoom:

```css
button, [role="button"], .loc-tag, .criteria-chip { touch-action: manipulation; }
```

4. Absicherung gegen horizontales Scrollen: `html, body { overflow-x: hidden;
   overscroll-behavior: none; }` (body hat bereits `overflow: hidden`,
   global.css:12 — prüfen, dass das nach den Layout-Änderungen so bleibt).

**Verifikation:** iPhone (echt, nicht nur Simulator): in Ortssuche tippen →
kein Zoom; danach kein seitlicher Spielraum; Karte weiterhin pinch-zoombar.

---

## B6 — Ortssuche in gezeichneten Gebieten: langes Laden, dann keine Orte

**Symptom:** Polygon zeichnen → „Bestes Wetter finden" → lange Ladezeit →
„Keine Orte gefunden".

**Analyse (verifiziert):**

- Worst Case heute in Prod: `overpass.ts` macht 2 Runden gegen den Proxy
  (Client-Timeout 15 s, `overpass.ts:132`), der Proxy iteriert intern 3 Mirrors
  à 10 s (`api/proxy/overpass.ts:32`) → **bis ~31 s Wartezeit**, bevor der
  GeoNames-Fallback überhaupt versucht wird.
- Polygon-Queries (`poly:"…"`-Filter) sind auf den öffentlichen Servern die
  teuerste Variante → häufige Soft-Timeouts (HTTP 200 + `remark: timed out`,
  wird korrekt als Fehlversuch gewertet, `overpass.ts:142` — kostet aber je
  Versuch die volle Zeit).
- Der GeoNames-Fallback enthält nur Orte **≥ 15.000 Einwohner**: Bei kleinen
  gezeichneten Gebieten liefert er 0 Treffer → Fehler `no_towns`, obwohl
  Overpass (wenn erreichbar) Dörfer gefunden hätte. Genau die Kombination
  „lange laden → keine Orte".
- Proxy-Hardening: Der Proxy gibt 200-Antworten mit Soft-Timeout-`remark`
  ungefiltert (und mit Cache-Headern) weiter — er sollte solche Antworten wie
  Fehler behandeln und den nächsten Mirror versuchen.

**Fix-Architektur (in dieser Reihenfolge, jede Stufe unabhängig wirksam):**

1. **Poly → BBox-Query + Client-Filter (größter Hebel):** Statt des teuren
   `poly:`-Filters die **Bounding Box** des Polygons bei Overpass abfragen
   (indexgestützt, um Größenordnungen schneller/zuverlässiger) und die
   Ergebnisse clientseitig per Point-in-Polygon filtern. Punkt-in-Polygon
   existiert bereits (`fallbackPlaces.ts:50` Ray-Casting) → in
   `utils/geo.ts` extrahieren und in `overpass.ts::fetchTownsInPolygon`
   wiederverwenden. `QUERY_LIMIT` ggf. auf 1200 anheben, da die BBox mehr
   Kandidaten liefert; Granularitäts-Logik (`placeTypes`) weiter über die
   echte Polygonfläche steuern, nicht über die BBox-Fläche.
2. **Gesamtzeitbudget:** `runOverpassQuery` bekommt eine Deadline (~12 s,
   `AbortController` um alle Runden). Danach GeoNames-Fallback. Ein
   Nutzer, der > 12 s wartet, ist verloren — lieber gute Näherung sofort.
3. **Proxy härten** (`api/proxy/overpass.ts`): Antwort parsen; bei
   `remark`-Timeout oder leerem `elements` bei nicht-leerer Query → nächsten
   Mirror probieren; Cache-Header nur auf valide Ergebnisse setzen.
4. **Polygon vereinfachen:** vor dem Query `@turf/turf` `simplify` (turf ist
   bereits Dependency) auf ≤ 32 Vertices — kürzere Query, weniger Last.
5. **Session-Cache:** `Map<polygonHash+granularity, Town[]>` im Modul —
   wiederholte Suche im selben Gebiet (z. B. nach Preset-Wechsel) ohne
   erneuten Netzwerk-Roundtrip.
6. **Ehrlichere Fehler-UX:** Wenn nur der Fallback griff und 0 Orte fand,
   differenzierten Hinweis zeigen: `errors.no_towns_small_area` (DE: „In
   diesem Gebiet wurden keine größeren Orte gefunden. Gebiet vergrößern oder
   ‚Alle Orte' wählen."; EN analog) statt generischem `no_towns`.

**Verifikation:** (a) Kleines Polygon (~20 km Kante) in ländlicher Region →
Ergebnisse < 5 s. (b) Overpass-Ausfall simulieren (Proxy-URL im Dev auf
ungültig) → GeoNames-Antwort < 3 s. (c) Wiederholte Suche im selben Polygon →
sofort (Cache).

---

## Betroffene Dateien (Übersicht)

| Bug | Dateien |
|-----|---------|
| B1 | `src/routes/index.tsx` |
| B2 | `src/components/entry/LocationInput.tsx`, `src/components/entry/EntryPanel.css` |
| B3 | `src/components/entry/LocationInput.tsx`, `src/hooks/useLocationSearch.ts`, neu: `src/components/common/PlaceAutocomplete.tsx` |
| B4 | `src/components/entry/RouteConfigStep.tsx`, `src/stores/appStore.ts` |
| B5 | `index.html`, `src/styles/global.css` |
| B6 | `src/services/overpass.ts`, `api/proxy/overpass.ts`, neu: `src/utils/geo.ts` |
