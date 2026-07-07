# 02 — UI-Verbesserungen (Feedback 2026-07)

Schwerpunkt Mobile: größere Bedienelemente, Wetterprofil-Konsolidierung,
Entschlackung des Einstiegsmenüs. Neue Strings als i18n-Keys in DE **und** EN.

---

## U1 — Touch-Target-Offensive („viele recht kleine Menüpunkte")

**Prinzip:** Sichtbares Icon darf klein bleiben — die **Hit-Area** muss
≥ 44×44 px sein (Apple HIG). Umsetzung über Padding + negatives Margin, damit
das Layout kompakt bleibt.

**Neue Tokens** (`src/styles/tokens.css`):

```css
--touch-target: 44px;      /* Mindest-Hit-Area mobil */
--icon-size-touch: 20px;   /* sichtbare Icongröße für Touch-Aktionen */
```

**Utility-Klasse** (`global.css`) für Icon-Buttons:

```css
.touch-hit { position: relative; }
.touch-hit::after {            /* unsichtbare vergrößerte Trefferfläche */
  content: ''; position: absolute; inset: 50% auto auto 50%;
  width: max(100%, var(--touch-target));
  height: max(100%, var(--touch-target));
  transform: translate(-50%, -50%);
}
```

**Konkrete Audit-Liste (verifizierte Ist-Größen):**

| Element | Datei | Ist | Soll |
|---|---|---|---|
| Herz-Icon in Orts-Tags | `LocationInput.tsx:24` (`HeartIcon` 12px), `.loc-tag-heart` EntryPanel.css:401 | 12px Icon, ~16px Hit | 20px Icon, 44px Hit; Tag-Höhe mobil auf ≥ 36px (`padding: 8px 10px 8px 14px`) |
| Tag-Entfernen (X) | `.loc-tag-remove` EntryPanel.css:384, Icon 11px | ~14px Hit | wie oben |
| Favoriten-Herz in Ergebniszeilen | `FinderResultRow.tsx` | klein | 44px Hit-Area, Icon 20px |
| Granularitäts-Chips | `.loc-granularity-chip` EntryPanel.css:609 (`padding: 6px`, 11px Font) | ~28px hoch | mobil ≥ 40px Höhe, Font `--font-size-sm` |
| „Eigene Gewichtung"-Slider | `CustomWeights.css` (Thumb 18px in EntryPanel-Slider-Muster) | Zeilen eng | Slider-Höhe/Thumb 24px, Zeilenhöhe ≥ 44px, Labels `--font-size-sm` statt xs |
| Pflichtstopps: Add/Remove, Vorschlags-Pills | `RouteConfigStep.tsx:248–296` | klein | Pills ≥ 40px Höhe; Remove-X 44px Hit |
| Sortier-Buttons Finder | `.finder-sort-btn` (Icon 12px) `WeatherFinderPanel.tsx:255` | klein | Höhe ≥ 40px, Icon 16px |
| Stepper (max. Nächte) | `.stepper-btn` | prüfen | ≥ 44px |
| Autocomplete-Optionen | `.autocomplete-option` EntryPanel.css:557 (`padding: 8px 12px`) | ~34px | mobil `padding: 12px` → ≥ 44px |
| Datums-Tage im Kalender | `.drp-day` | ok (aspect-ratio 1, Panelbreite) | mobil prüfen, ggf. `min-height: 40px` |

**Leitbild:** Die Wetterprofil-Karten (`.finder-preset-card`) sind laut
Feedback die richtige Größe — als Referenz für alle neuen Elemente nehmen.

**Verifikation:** DevTools Device-Mode + echtes Gerät; jede Aktion aus der
Tabelle mit dem Daumen ohne Fehltipp treffbar.

---

## U2 — Wetterprofil + „Was ist wichtig" zusammenführen

**Feedback:** Wetterprofil ist schwer verständlich und gehört inhaltlich zu
„Was ist wichtig"; beides ist für beide Szenarien (Bestes Wetter / Beste
Route) relevant. Außerdem: Anfangs-Suche immer nach Score — Kriterien-Auswahl
im Einstieg entfällt, Sortierung in den Ergebnissen reicht.

**Befund, der die Entscheidung stützt (verifiziert):**
`tripConfig.criteria` („Was ist wichtig"-Chips) ist **toter State** — einziger
Leser ist das Pill-Icon in `MobileSearchBar.tsx:55`. Das Scoring läuft
ausschließlich über `preset`/`customWeights`. Die Chips suggerieren also eine
Wirkung, die es nicht gibt.

### Ziel-Architektur

**Ein** gemeinsamer Abschnitt „Wetter-Präferenz" im Einstiegs-Panel (für beide
Szenarien sichtbar), bestehend aus:

1. **Preset-Karten** (Strand / Wandern / Sightseeing) im großen Kartenformat
   der heutigen `FinderFilterBar`-Preset-Cards — inkl. kurzer
   Beschreibungszeile, die das Profil erklärt (adressiert „schwer
   verständlich"):
   - `preset.beach_desc` — DE „Viel Sonne, warm, wenig Wind" / EN „Lots of sun, warm, little wind"
   - `preset.hiking_desc` — DE „Trocken, mild, wenig Wind" / EN „Dry, mild, little wind"
   - `preset.sightseeing_desc` — DE „Vor allem trocken" / EN „Mainly dry"
2. **„Eigene Gewichtung"** (Premium, `CustomWeights`) als aufklappbare vierte
   Option innerhalb desselben Abschnitts — nicht mehr separat im
   Routen-Schritt vergraben.

### Store-Refactoring

Neuer Top-Level-Slice statt Duplikaten (`appStore.ts`):

```ts
interface WeatherPrefs {
  preset: WeatherPreset;              // ersetzt tripConfig.preset UND finderConfig.preset
  customWeights: ScoringWeights | null; // ersetzt tripConfig.customWeights
}
```

- `tripConfig.criteria`, `tripConfig.preset`, `tripConfig.customWeights`,
  `finderConfig.preset` entfernen; Leser umziehen:
  `useOptimizer.ts:137,141`, `useFinder`-Pipeline,
  `WeatherFinderPanel.tsx:145`, `FinderFilterBar.tsx:105`,
  `RouteConfigStep.tsx:219–243`, `CustomWeights.tsx:41–53`,
  `MobileSearchBar.tsx:55` (Pill-Icon jetzt aus `weatherPrefs.preset` ableiten,
  `PRESET_ICONS` statt `CRITERION_ICONS`).
- `FinderFilterBar` behält den schnellen Preset-Umschalter in den Ergebnissen
  (nützlich als Filter), liest/schreibt aber `weatherPrefs` — eine Quelle,
  kein Drift mehr zwischen Einstieg und Ergebnis.

### Entfallende Komponenten

- `CriteriaSelector.tsx` löschen (inkl. Aufruf `EntryPanel.tsx:85`).
- Preset-Buttons-Block in `RouteConfigStep.tsx:219–238` und
  `CustomWeights`-Block (Z. 240–243) entfernen → ersetzt durch den
  gemeinsamen Abschnitt im EntryPanel.
- `criterionIcons.tsx` ebenfalls löschen: Nach der Migration referenzieren es
  nur noch `CriteriaSelector` (entfällt) und `MobileSearchBar` (wechselt auf
  Preset-Icons); die Finder-Sortierleiste nutzt eigene `FinderIcons`.

**Ergebnis:** Einstieg = Datum + Orte + Wetter-Präferenz + 2 CTAs. Sortierung
(Score/Sonne/Temp/Regen/Wind) existiert nur noch in den Ergebnissen
(`finder-sort-bar` — bleibt unverändert). Genau die gewünschte Verschlankung.

---

## U3 — „Reisedauer" aus dem Routen-Schritt entfernen

**Befund:** `RouteConfigStep.tsx:169–190` zeigt bei gesetzten Daten nur noch
eine redundante Anzeige („X Tage" — steht schon in der Datumsauswahl inkl.
„2 Tage"-Badge). Der Stepper-Zweig greift nur, wenn **kein Enddatum** gewählt
wurde.

**Fix:**

- Anzeige-Zweig (`hasDates`) ersatzlos streichen.
- Empfehlung: Enddatum zur Pflicht machen (DateRangePicker erzwingt Range;
  `ctasReady` in `EntryPanel.tsx:40` um `endDate` erweitern) → dann kann das
  gesamte Feld inkl. Stepper und die `endDate`-Ableitung in
  `useOptimizer.ts:20–29` entfallen. `totalDays` wird überall aus
  `startDate/endDate` abgeleitet (kleine Helper-Funktion in `utils/`).
  Stützender Befund: Der **Finder verlangt das Enddatum bereits heute**
  (`useFinder.ts:23` → Fehler `missing_config` ohne Enddatum) — nur der
  Routen-Pfad leitet es her. Pflicht-Enddatum vereinheitlicht also lediglich
  das Verhalten beider CTAs.
- Falls Enddatum optional bleiben soll: nur den Anzeige-Zweig löschen,
  Stepper-Zweig behalten.

---

## U4 — Kleinere Konsistenzpunkte

- **Einheitliche Panel-Abstände mobil:** nach U1 wachsen einige Elemente —
  `--space`-Stufen beibehalten, keine Ad-hoc-Pixelwerte.
- **`.finder-preset-card` und CTA-Buttons** sind die Referenz für „gut groß" —
  neue Elemente daran ausrichten.
- **Dark Mode** bei allen angefassten Komponenten gegenprüfen (Projekt hat
  `[data-theme="dark"]`-Overrides, z. B. EntryPanel.css:436).

---

## Neue i18n-Keys (DE/EN — beide Dateien!)

| Key | DE | EN |
|---|---|---|
| `entry.weather_prefs` | Wetter-Präferenz | Weather preference |
| `preset.beach_desc` | Viel Sonne, warm, wenig Wind | Lots of sun, warm, little wind |
| `preset.hiking_desc` | Trocken, mild, wenig Wind | Dry, mild, little wind |
| `preset.sightseeing_desc` | Vor allem trocken | Mainly dry |

## Betroffene Dateien

`tokens.css`, `global.css`, `EntryPanel.tsx/.css`, `LocationInput.tsx`,
`RouteConfigStep.tsx`, `CriteriaSelector.tsx` (löschen), `CustomWeights.tsx/.css`,
`FinderFilterBar.tsx/.css`, `WeatherFinderPanel.tsx`, `FinderResultRow.tsx/.css`,
`MobileSearchBar.tsx`, `appStore.ts`, `useOptimizer.ts`, `useFinder.ts`,
`locales/de/common.json`, `locales/en/common.json`
