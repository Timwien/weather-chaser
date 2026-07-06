# 03 — UX-Verbesserungen (Feedback 2026-07)

Gezeichnete Gebiete persistent machen, Suchen speichern, Suchverlauf,
History-Integration. Neue Strings als i18n-Keys in DE **und** EN.

---

## X1 — Gezeichnete Gebiete bleiben erhalten (bis aktives Entfernen)

**Symptom:** Gezeichnetes Gebiet verschwindet visuell, sobald man aus den
Ergebnissen „zurück" geht.

**Root Cause (verifiziert):** Das Polygon wird ausschließlich auf dem
2D-Canvas von `DrawingControls` gerendert (`DrawingControls.tsx:54–153`), und
dessen Zustand lebt in **lokalen Refs/State** (`verticesRef`, `hasPolygon`).
In `routes/index.tsx:118,192` werden `onDrawComplete/onDrawClear` nur bei
`!showResults` übergeben → bei Ergebnissen unmountet `DrawingControls`
(MapContainer.tsx:242) und verliert beim Remount alles. Der Store
(`searchAreas` enthält weiterhin `{type:'polygon', id:'drawn-polygon'}`) und
die Anzeige laufen auseinander: Tag „Gezeichnetes Gebiet" existiert noch,
auf der Karte ist nichts mehr zu sehen, und der „Gebiet löschen"-Button ist
weg (`hasPolygon=false`).

**Ziel-Architektur — Single Source of Truth = Store:**

1. **Neue Komponente `SearchAreasLayer`** (`src/components/map/SearchAreasLayer.tsx`):
   rendert **alle** `searchAreas` vom Typ `polygon` (und optional `radius` als
   Kreis via `turf.circle`) als MapLibre GeoJSON-Source + `fill`/`line`-Layer.
   Immer gemountet (innerhalb `<Map>`), Sichtbarkeit per Prop
   (`visible={mode !== 'results'}` — oder dauerhaft sichtbar mit reduzierter
   Opacity in Ergebnissen; Empfehlung: dauerhaft sichtbar, dann sieht man in
   den Ergebnissen auch, worauf sich die Suche bezog).
   - Hinweis: Der Brand-Gradient des Canvas ist mit MapLibre-Fill-Layern nicht
     1:1 möglich → einfarbige Füllung mit `--color-primary` @ 0.2 Opacity +
     Gradient-ähnlicher Line-Color ist der pragmatische Tausch für Persistenz.
2. **`DrawingControls` wird reine Zeichen-UI:** Canvas nur noch für die
   **laufende** Zeichnung (Rubber-Band, Vertices). Bei `completePolygon` →
   `addSearchArea(...)` (wie heute) und Canvas leeren. Lokales `hasPolygon`
   entfernen; stattdessen aus dem Store ableiten:

```ts
const hasPolygon = useAppStore((s) => s.searchAreas.some((a) => a.type === 'polygon'));
```

3. **Entfernen nur noch explizit:** über den „Gebiet löschen"-Button oder das
   X am Tag in `LocationInput` (beides ruft `removeSearchArea('drawn-polygon')`).
   Moduswechsel/„Zurück"/Ergebnisse ändern daran nichts mehr.
4. `onDrawComplete/onDrawClear` in `index.tsx` nicht mehr an `!showResults`
   koppeln — `DrawingControls` blendet seine Buttons selbst aus, wenn
   `mode === 'results'` (Zeichnen aus Ergebnissen heraus bleibt gesperrt).

**Verifikation:** Polygon zeichnen → Suche → Ergebnisse → Zurück: Polygon ist
auf der Karte und als Tag sichtbar; „Gebiet löschen" funktioniert; erneute
Suche nutzt dasselbe Polygon.

---

## X2 — Suchen speichern (Finder **und** Route aus einer gespeicherten Suche)

**Feedback:** Es gibt keine sichtbare Funktion, eine Suche zu speichern.
Gewünscht: Suche speichern, später öffnen und **dann** entscheiden, ob
„Bestes Wetter" oder „Beste Route".

**Befund:** Backend existiert teilweise — Tabelle + Service
`saved_finder_searches` (`services/userdata.ts:97–123`), `SavedTab` rendert
die Sektion bereits (SavedTab.tsx:262–283), aber: kein Save-Button irgendwo,
und die Karten sind nicht klickbar (kein Load). Auch in `docs/OPEN-ITEMS.md`
§3 als offen vermerkt.

### Datenmodell

Da beim Laden erst der Modus gewählt wird, speichern wir den **Einstiegs-
Zustand**, nicht das Ergebnis. Bestehende Tabelle weiterverwenden
(`config_json` ist `jsonb`), Payload versionieren:

```ts
interface SavedSearchConfigV1 {
  v: 1;
  searchAreas: SearchAreaItem[];   // Orte, Polygone, Radien
  dateFrom: string | null;         // ISO
  dateTo: string | null;
  radiusKm: number;
  granularity: SearchGranularity;
  weatherPrefs: { preset: WeatherPreset; customWeights: ScoringWeights | null };
}
```

- Name auto-generieren: `"Ahlbeck +2 · 3.–4. Juli"` (erste Ortsnamen + Anzahl
  + Datumsbereich); Helper `buildSearchName(config)` in `userdata.ts` neben
  `buildRouteName`.
- Optional (empfohlen, klein): Tabelle in `saved_searches` umbenennen bzw.
  Supabase-View/Alias — kein „finder" im Namen mehr, da sie beide Szenarien
  speist. Falls Migrationsaufwand vermieden werden soll: Tabellename behalten,
  nur UI-Label ändern.

### Service (`userdata.ts`)

- `saveSearch(config: SavedSearchConfigV1)` — wrappt bestehendes
  `saveFinderSearch(name, config)`.
- `deleteSavedSearch(id)` — analog `deleteSavedRoute` (fehlt bisher!).

### UI

1. **Speichern:** Bookmark-Button im EntryPanel neben den CTAs (sichtbar wenn
   `ctasReady`, Guest → `InlineSignInPrompt`-Flow wie beim Routen-Speichern,
   `pendingAction`-Mechanismus aus `ItineraryPanel.tsx:51–84` wiederverwenden)
   **und** je ein „Suche speichern" im Header von `WeatherFinderPanel` und
   `ItineraryPanel` (speichert die Einstiegs-Konfiguration der aktuellen
   Ergebnisse).
2. **Laden:** `SavedTab`-Karten klickbar machen → `applySavedSearch(config)`:

```ts
function applySavedSearch(c: SavedSearchConfigV1) {
  clearSearchAreas(); c.searchAreas.forEach(addSearchArea);
  setTripConfig({ startDate: c.dateFrom, endDate: c.dateTo });
  setSearchRadiusKm(c.radiusKm); setSearchGranularity(c.granularity);
  setWeatherPrefs(c.weatherPrefs);
  setMode('idle');            // EntryPanel mit gefüllten Feldern + beiden CTAs
}
```

   Modal schließen → Nutzer sieht den gefüllten Einstieg und wählt CTA.
3. Löschen-Button an den Karten (analog Routen).

### i18n-Keys

| Key | DE | EN |
|---|---|---|
| `save.search` | Suche speichern | Save search |
| `save.search_saved` | Suche gespeichert | Search saved |
| `account.saved_searches_title` | Gespeicherte Suchen | Saved searches |
| `a11y.load_saved_search` | Suche laden | Load search |

**Verifikation:** Suche konfigurieren → speichern → App neu laden → Saved →
Karte antippen → Felder gefüllt → beide CTAs funktionieren. Delete entfernt
die Karte.

---

## X3 — Vergangene Suchen im Profil (letzte 15)

**Architektur:** eigene Tabelle statt Überladung der gespeicherten Suchen.

```sql
create table search_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('finder','route')),
  config_json jsonb not null,           -- SavedSearchConfigV1 (gleiche Struktur!)
  created_at  timestamptz not null default now()
);
alter table search_history enable row level security;
create policy "own history" on search_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on search_history (user_id, created_at desc);
```

- **Schreiben:** fire-and-forget `recordSearch(kind, config)` nach
  erfolgreichem Lauf — Einhängepunkte: `useFinder.ts` im
  `complete`-Handler (Z. 52) und `useOptimizer.ts` im `complete`-Handler
  (Z. 110). Nur wenn eingeloggt + `supabaseConfigured`; Fehler schlucken
  (nicht-kritisch).
- **Pruning (einfach, clientseitig nach Insert):**

```ts
const { data } = await supabase.from('search_history').select('id')
  .eq('user_id', uid).order('created_at', { ascending: false }).range(15, 100);
if (data?.length) await supabase.from('search_history').delete()
  .in('id', data.map((r) => r.id));
```

- **UI:** neue Sektion „Letzte Suchen" in `SavedTab` (unter den gespeicherten
  Suchen): Icon nach `kind`, Name via `buildSearchName`, relative Zeit.
  Tap → `applySavedSearch(config)` (Wiederverwendung aus X2). Sekundäraktion
  „als Suche speichern" (Bookmark-Icon) → kopiert nach `saved_searches`.
- Dedupe: identische Konfiguration direkt hintereinander nicht doppelt
  einfügen (Hash-Vergleich mit letztem Eintrag).
- Gäste: bewusst weggelassen (Feedback sagt „in meinem Profil"); optional v2
  localStorage-Ringpuffer.

### i18n-Keys

| Key | DE | EN |
|---|---|---|
| `account.history_title` | Letzte Suchen | Recent searches |
| `account.history_empty` | Noch keine Suchen | No searches yet |
| `account.history_save_as` | Als Suche speichern | Save as search |

**Verifikation:** 2 Suchen (Finder + Route) ausführen → beide erscheinen im
Profil; 16. Suche verdrängt die älteste; Tap stellt die Konfiguration wieder her.

---

## X4 — (Empfohlen) App-Modus in die Browser-History integrieren

Nicht explizit gefordert, löst aber strukturell die „Zurück"-Bug-Klasse (B1)
und macht die Back-Geste in der installierten Web-App erwartungskonform.

- `mode` (+ ggf. `selectedDay`) als Search-Param der Index-Route über TanStack
  Router (`/?view=results`): `setMode('results')` → `navigate({ search: { view: 'results' } })`;
  Back-Geste → Router-State → `mode` folgt.
- Aufwand moderat, da `mode` zentral im Store liegt (ein Sync-Hook
  `useSyncModeWithUrl()` in `routes/index.tsx`).
- Empfehlung: nach Abschluss der Bugfix-Welle umsetzen, nicht gleichzeitig.

## Betroffene Dateien

`src/components/map/SearchAreasLayer.tsx` (neu), `DrawingControls.tsx`,
`MapContainer.tsx`, `routes/index.tsx`, `services/userdata.ts`,
`components/account/SavedTab.tsx`, `components/entry/EntryPanel.tsx`,
`components/finder/WeatherFinderPanel.tsx`, `components/itinerary/ItineraryPanel.tsx`,
`hooks/useFinder.ts`, `hooks/useOptimizer.ts`, `types/database.ts`,
Supabase-Migration (`search_history`), beide Locale-JSONs
