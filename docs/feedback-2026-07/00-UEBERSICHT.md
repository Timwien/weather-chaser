# Feedback-Runde 2026-07 — Übersicht & Umsetzungsplan

Pläne und Code-Architekturen zum Test-Feedback vom 05.07.2026 (mobile
Web-App). Alle Root Causes wurden im Code verifiziert; jede Maßnahme nennt
Datei/Zeile. **Diese Dokumente sind reine Planung — es wurde kein Code
geändert.**

| Dokument | Inhalt |
|---|---|
| [01-BUGFIXES.md](01-BUGFIXES.md) | B1–B6: Zurück-Bug, Dropdown-Position, Dropdown-Dismiss, Pflichtstopps, Seiten-Zoom, Polygon-Ortssuche |
| [02-UI-VERBESSERUNGEN.md](02-UI-VERBESSERUNGEN.md) | U1–U4: Touch-Targets, Wetterprofil-Merge, Reisedauer raus, Konsistenz |
| [03-UX-VERBESSERUNGEN.md](03-UX-VERBESSERUNGEN.md) | X1–X4: Persistente Zeichengebiete, Suchen speichern, Suchverlauf, History |
| [04-NEUE-FEATURES.md](04-NEUE-FEATURES.md) | F1–F4: Refresh, Orte in der Nähe, Karten-Tap, lokalisierte Namen |
| [05-REFACTORINGS.md](05-REFACTORINGS.md) | R1–R8: PlaceAutocomplete, Store-Aufräumen, Mobile-Shell, Favoriten-Store, Fehler-Codes, i18n, Geo-Utils, Supabase-Typen |

---

## Feedback → Maßnahme (vollständiges Mapping)

| Feedback-Punkt | Maßnahme |
|---|---|
| „Wohin, wann"-Menü weg nach „Zurück" | **B1** (+ strukturell X4, R3) |
| Städte-Dropdown zu weit unten (Screenshot) | **B2** (+ R1) |
| Dropdown bleibt nach Abbruch sichtbar | **B3** (+ R1) |
| Gleiche Probleme bei „Pflichtstopps" | **B4** (+ R1) — Zusatzbefund: Pflichtstopps werden aktuell **komplett ignoriert** (nie geocodiert) |
| Spielraum links/rechts, Menü-Zoom mobil | **B5** |
| Ortssuche in gezeichneten Gebieten buggy/langsam | **B6** |
| Kleine Menüpunkte (Herzen, Gewichtung, Pflichtstopps) | **U1** |
| Wetterprofil unverständlich + gehört zu „Was ist wichtig" | **U2** — Zusatzbefund: „Was ist wichtig"-Chips sind wirkungslos (toter State) |
| „Reisedauer" unnötig im Routen-Schritt | **U3** |
| Menü verschlanken: initial nur Score, Sortierung in Ergebnissen | **U2** (Kriterien-Chips entfallen; Sortierleiste bleibt nur in Ergebnissen) |
| Gezeichnete Gebiete verschwinden zu schnell | **X1** |
| Suche speichern (Finder oder Route später wählbar) | **X2** |
| Letzte 15 Suchen im Profil | **X3** |
| Refresh-Funktion (eingefrorene PWA) | **F1** |
| „Orte in der Nähe" intelligent vorschlagen | **F2** |
| Orte per Karten-Tap hinzufügen | **F3** |
| Stettin statt Szczecin (Sprache der Ortsnamen) | **F4** |

---

## Empfohlene Umsetzungsreihenfolge (Wellen)

Jede Welle ist unabhängig deploybar; innerhalb einer Welle sind die Punkte
parallelisierbar. Refactorings stehen jeweils **vor** den Features, die sie
brauchen.

### Welle 1 — Quick Wins (kleine Diffs, große Wirkung)
1. **B1** Zurück-Bug (2 Zeilen + Effect in `routes/index.tsx`)
2. **B5** Viewport/16px-Inputs (index.html + global.css)
3. **U3** Reisedauer-Feld entfernen
4. **B2** Dropdown-Anker (falls R1 nicht sofort kommt: minimaler JSX-Move)
5. **F1** Refresh-Button + ErrorBoundary

### Welle 2 — Autocomplete-Kern
1. **R1** `PlaceAutocomplete` + **B3**-Semantik + `useLocationSearch`-Guard
2. **B4** Pflichtstopps auf Koordinaten-Auswahl umstellen (Bugfix inklusive)
3. **R2** appStore entrümpeln (Legacy `searchArea`, Type-Guards; `criteria`
   fällt erst in Welle 4)
4. **U1** Touch-Target-Pass (unabhängig, gut parallel)

### Welle 3 — Karte & Suche im Gebiet
1. **R7** `utils/geo.ts`
2. **X1** `SearchAreasLayer` + DrawingControls-Umbau
3. **B6** Overpass: BBox-Query + Zeitbudget + Proxy-Härtung
4. **F3** Karten-Tap mit Bestätigungs-Popup
5. **F2** „Orte in der Nähe"

### Welle 4 — Wetterprofil & Store-Konsolidierung
1. **U2** `weatherPrefs`-Slice + gemeinsamer Präferenz-Abschnitt +
   CriteriaSelector entfernen
2. **R5** Fehler-Codes, **R6** i18n-Hygiene (guter Zeitpunkt: viele Dateien
   ohnehin offen)

### Welle 5 — Persistenz & Sprache
1. **R4** Favoriten-Store, **R8** Supabase-Typen
2. **X2** Suchen speichern (+ Migration/Policy prüfen)
3. **X3** Suchverlauf (+ Migration `search_history`)
4. **F4** Lokalisierte Ortsnamen (Client + Proxys + Worker + Kartenlabels)
5. **X4** (optional) History-Integration des App-Modus

---

## Definition of Done (für jede Welle)

- `pnpm type-check` grün; keine neuen `as any`.
- Neue/geänderte UI-Strings existieren in **beiden** Locale-Dateien
  (`locales/de/common.json`, `locales/en/common.json`) — CLAUDE.md Regel 4;
  keine Inline-Default-Strings.
- Dark Mode gegengeprüft (`[data-theme="dark"]`).
- Mobile-Verifikation am echten Gerät (mind. iOS Safari) gemäß
  „Verifikation"-Abschnitt der jeweiligen Maßnahme; für automatisierte Checks
  existiert das Puppeteer-Harness-Rezept (siehe `docs/SETUP-BROWSER.md` bzw.
  Verify-Notizen).
- `docs/OPEN-ITEMS.md` aktualisieren (X2 schließt den Punkt „Finder-Suchen
  speichern" in §3; `DEV_SEARCH_AREAS`-Entfernung dort ebenfalls tracken).

## Querverbindungen zu bestehenden offenen Punkten

- OPEN-ITEMS §3 „Finder-Suchen speichern" → wird durch **X2** erledigt.
- OPEN-ITEMS §3 „Dev-Defaults entfernen" → in **R2** enthalten.
- OPEN-ITEMS §2 Overpass-Ausfälle → **B6** verbessert genau diesen Pfad.
