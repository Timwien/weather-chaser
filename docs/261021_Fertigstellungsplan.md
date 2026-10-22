# WeatherChaser — Fertigstellungsplan (Oktober 2026)

Stand: 21.10.2026. Auftrag von Tim: „App so weit wie möglich fertig bauen,
mobil wie Desktop einfach nutzbar, alles selbst entscheiden, nur bei
wirklich Kritischem stoppen." Damit gelten die Tickets unten als freigegeben
(Status „Spec Ready"). Branch: `finish-2026-10`.

Grundlage: drei Prüfläufe am 21.10.2026 gegen die Live-Seite
(Mobil 390/360 px, Desktop/Tablet) und ein Code-Scan. Befund-IDs:
M = mobil, D = Desktop, C = Code.

Bewusst **nicht** in diesem Plan (braucht Tims Konten oder Daten):
native Apps (Apple/Play/EAS), Stripe-Livegang, eigene Domain, Resend-SMTP,
Google-OAuth-Freigabe, echte Betreiberdaten in Datenschutz/Impressum (M1).

---

## Welle A — Launch-Grundlagen (Plattform, Robustheit, Barrierefreiheit)

Ziel: Die App ist auf dem Handy installierbar, geteilte Links sehen gut aus,
nichts hängt bei Netzproblemen, Dialoge sind per Tastatur bedienbar, der
erste Ladevorgang ist leichter.

| # | Maßnahme | Befund |
|---|---|---|
| A1 | Web-App-Manifest + PNG-Icons (192, 512, maskable 512, apple-touch 180) aus `favicon.svg`; `theme-color` (hell/dunkel), `apple-mobile-web-app-*`-Metas, `meta description`, Open-Graph-/Twitter-Tags mit OG-Bild (1200×630), `robots.txt`. Kein Service-Worker (bewusst: Live-Wetter, Cache-Risiko). | C9 |
| A2 | `<html lang>` folgt der i18n-Sprache (`languageChanged`). | C9 |
| A3 | Pinch-Zoom wieder erlauben (`maximum-scale`/`user-scalable=no` raus; 16-px-Inputs verhindern den iOS-Auto-Zoom bereits). | C7 |
| A4 | Mobile Suchleiste: `top` mit `env(safe-area-inset-top)`. Modals: `90vh` → `90dvh` mit Fallback. | C6 |
| A5 | 404-Seite (`defaultNotFoundComponent`) im App-Stil mit Link zur App; `/trip` mit ungültigem/fehlendem Link zeigt eine Meldung statt leerer Karte; einfache Schema-Prüfung in `parseShareUrl`. | C10 |
| A6 | Nominatim (Client): Timeout 8 s für Suche und Reverse; Karten-Tap fängt Reverse-Fehler ab (Fallback Koordinatenname). | C3, C4 |
| A7 | Nominatim-Proxys: Timeout + 502 bei Fehler, `Cache-Control` nur bei Erfolg (sonst `no-store`); `limit` auf 1–10 begrenzen; lat/lon validieren. Weather-Proxy: lat/lon validieren. | C5, C12 |
| A8 | Gemeinsamer Hook `useModalA11y(onClose)`: Esc schließt, Fokus beim Öffnen in den Dialog, Tab bleibt im Dialog, Fokus kehrt zurück. In Feedback-, Account-, Upgrade-Modal und DatePicker-Popover. EntryPanel-Fehler-✕ bekommt `aria-label`. | C8, M11, C-i18n-1 |
| A9 | Code-Splitting: `React.lazy` für Privacy, ToS, Trip-Route, AccountModal, UpgradeModal, FeedbackModal; `posthog-js` dynamisch laden und nur, wenn ein Key gesetzt ist. | C14 |
| A10 | Aufräumen: `@turf/turf` entfernen (unbenutzt), `@watergis/maplibre-gl-terradraw` auf die installierte Version pinnen, Alt-Prototyp im Repo-Root (`app.js`, `index.html`, `style.css`) löschen und README anpassen. | C15, C16 |

Prüfung: `pnpm -r type-check`, `pnpm --filter @weatherchaser/core test`,
`pnpm build`; Boot-Check (Dev + Preview) ohne Error-Boundary und ohne
Konsolenfehler; Manifest/Icons per HTTP abrufbar; Esc schließt jedes Modal;
404- und Trip-Fehlerseite per Screenshot DE/EN; Main-Chunk kleiner als vorher
(736 kB).

---

## Welle B — Ortsdaten, Gebietssuche, Wetter-Pipeline

Diagnose (21.10.2026):
- **Overpass ist praktisch tot für uns.** overpass-api.de antwortet seit
  April 2026 mit strengen Sperrregeln (406 auch mit eigenem User-Agent und
  Referer); die zwei Spiegel antworten nicht. Der Proxy braucht 30 s bis zum
  503, der Client bricht nach 12 s ab und nutzt still die kleine
  GeoNames-Notfallliste (≥ 15k Einwohner). Jede Suche verliert dadurch 12 s
  und findet nur größere Städte.
- **Polygon ohne Ort → immer 0 Treffer**: `WeatherFinderPanel.tsx` verlangt
  einen Ursprung (`return []`) und filtert zusätzlich nach Radius.
  Ort + Polygon → `useFinder` wählt „multi-place" und ignoriert das Polygon.
- **Wetter-Pipeline kann > 3 min hängen**: Batches laufen nacheinander,
  Client-Timeout (15 s) < Proxy-Gesamtzeit (bis 37,8 s), Retries
  multiplizieren sich, Split-Retry über 3 Ebenen, ein Fehl-Batch verwirft
  alle Ergebnisse.

Entscheidung: **Overpass wird ersetzt** durch einen eigenen Ortsdatensatz
(GeoNames `cities1000`, CC BY 4.0, Europa-Ausschnitt, mit deutschen und
englischen Namen aus `alternateNamesV2`), ausgeliefert über eine eigene
GET-Schnittstelle `/api/places`, die am CDN cachebar ist. Damit entfallen die
12-s-Wartezeit, die Abhängigkeit von einem überlasteten Fremddienst und das
offene Overpass-Relay (C11).

| # | Maßnahme |
|---|---|
| B1 | Build-Skript `scripts/build-places.mjs` (einmalig ausgeführt, Ergebnis eingecheckt): lädt GeoNames `cities1000` + `alternateNamesV2`, filtert auf den bisherigen Europa-Ausschnitt, behält Name, Lat, Lng, Einwohner, bevorzugten DE- und EN-Namen; kompaktes JSON unter `apps/web/api/_data/`. |
| B2 | `GET /api/places?bbox=s,w,n,e` bzw. `?lat=&lng=&radiusKm=` + `minPop` + `limit` + `lang`; Validierung, Limits, `Cache-Control: s-maxage` langfristig. Ortsauswahl nach Einwohnerschwellen statt OSM-Ortstypen (gleiche Logik wie `placeTypes`/Granularität). Abfragelogik in einem reinen Modul mit Unit-Tests. |
| B3 | Client: `services/overpass.ts` → `services/places.ts` (Radius, Gebiet, Polygon mit Point-in-Polygon wie bisher), Overpass-Proxy und Notfall-Datei entfernen. Dev-Server bedient `/api/*` über ein kleines Vite-Plugin mit denselben Funktionsdateien. |
| B4 | Finder: Polygon-Modus ohne Ursprung und ohne Radiusfilter; Polygon hat Vorrang vor „multi-place"; leere Ergebnisse im Polygon zeigen einen passenden Hinweis (kein „Radius vergrößern"). |
| B5 | Wetter: Batches parallel (max. 3), ein Gesamtbudget (~30 s) mit Rückgabe der erfolgreichen Batches, Client-Timeout > Proxy-Gesamtzeit, Proxy max. 1 Retry, Split-Retry nur eine Ebene, 429 `Retry-After` beachten. |
| B6 | Quellenangabe „Ortsdaten: GeoNames (CC BY 4.0)" in Datenschutz/Nutzungsbedingungen bzw. Kartenattribution; Overpass-Erwähnungen in Datenschutz/Doku anpassen. |

Prüfung: Unit-Tests für Ortsabfrage und Polygon-Filter; Finder Radius,
kleines Polygon, großes Polygon, Ort + Polygon und Route jeweils mit
Ergebnissen und Laufzeit < 20 s im Dev-Server (mobil + Desktop).

Zusatzbefunde Desktop: D1 (Polygon ohne benannten Ort → Ergebnisliste
immer leer, `WeatherFinderPanel` verlangt einen Ursprung), Overpass-Proxy
bricht bei jeder Suche ab (`ERR_ABORTED`) → App fällt still auf die
GeoNames-Notfallliste zurück (erklärt dünne Ergebnisse, D12). Ort + Polygon
gleichzeitig → Polygon wird ignoriert.

## Welle C — Bedienung mobil & Desktop

Nach Welle B, nacheinander (gemeinsame Locale-Dateien).

**C1 Finder-Ergebnisse**
- Ergebnis antippen hält die halbe Sheet-Höhe und schwenkt die Karte (M3).
- In halber Höhe zuerst die Ergebnisse; Filter (Tag, Tageszeit,
  Wetterprofil) in einer einklappbaren Zeile „Filter"; Sortier-Chips in
  einer horizontal scrollbaren Zeile ohne Umbruch, Tag-Zeile mit Scroll statt
  Abschneiden (M4, D11).
- Marker: bester Rang liegt oben (z-index nach Rang), Ränge > 3 kleiner;
  Startort als eigener Marker (M6).
- Plural „1 Ort gefunden" (M15); `Score:` im Marker-Popup übersetzen (D10).

**C2 Einstieg**
- Unter jedem CTA eine Zeile, was er tut (Route vs. Orte) (M7).
- CTAs auf Mobil im Suchformular unten fixiert (sticky), auch bei 360×640
  und Desktop 1280×720 sichtbar (M7, D11).
- „Eigene Gewichtung" standardmäßig eingeklappt; klar, ob Profil oder
  eigene Gewichtung gilt (M8).
- Karten-Hinweis „Tippe…" auf Desktop „Klicke…" (D10).
- Ortssuche: Siedlungen bevorzugen (Nominatim `featureType=settlement`
  bzw. Ranking), Namen in UI-Sprache (D9); Startort nicht als
  Pflichtstopp vorschlagen (D11).

**C3 Route & geteilte Route**
- Zurück nach Neugewichtung braucht nur einen Klick (D4).
- Geteilte Route zeigt dieselben Wetterwerte wie in der App (Werte in den
  Share-Payload) (M10, D6); doppelten Speichern-Button entfernen (D6).
- Browser-/Android-Zurück führt aus Ergebnissen zurück zur Eingabe statt
  die App zu verlassen (M12).
- Prüfen: Sonnen-Teilscore 0 bei 6,5 h Sonne (M10) — Scoring-Logik.

**C4 Layout & Zugänglichkeit**
- Account-Modal über der ganzen App (Portal), Tabs ohne Abschneiden (M9, D11).
- Tablet/Desktop: Karte berücksichtigt die Panelbreite (fitBounds-Padding,
  Hinweis mittig über sichtbarer Karte) (D5).
- Tab-Reihenfolge: Eingabe vor Karte; `aria-activedescendant` im
  Autocomplete; deaktivierte CTAs korrekt (D8).
- Touch-Ziele ≥ 40 px, Schrift ≥ 11 px für Bedienelemente (M13, M14);
  Dark-Mode-Chips mit sichtbarer Fläche (M13).

---

## Stand am Ende der Runde (21.10.2026)

Alle Wellen A, B, C1–C4 umgesetzt; jede Welle durch frische Review-Agenten
geprüft (A und B: Korrektheit + Sicherheit; C: Korrektheit), alle bestätigten
Funde behoben. Zusätzlich: Impressum-Seite (`/impressum`, Platzhalter).

Abschluss-QA (Browser-Durchlauf 390/360/820/1280/1440 px, DE/EN, hell/dunkel):
alle 11 Prüfbereiche bestanden, keine blockierenden Fehler.

Messwerte (Dev-Server, Live-Daten):
- Finder Radius / Polygon / Ort + Polygon: < 1 s nach dem Tippen (vorher
  13 s bzw. 195 s bzw. 0 Treffer)
- Route Freiburg, 5 Nächte: < 1 s Berechnung, Neugewichtung ~4 s
- Haupt-Bundle 736 kB → ~512 kB (gzip 231 → 160 kB)
- Tests: Core 61, Web 69 (vorher Core 58, Web 0)

Nicht verifiziert: Laufzeit der Vercel-Funktionen in der echten Vercel-Umgebung
(Vorschau ist login-geschützt, CLI-Token abgelaufen). Ersatzprüfung: Build
auf Vercel erfolgreich, Funktion `/api/places` unter reinem Node 20 korrekt.

Offene Punkte für Tim: `docs/OPEN-ITEMS.md` §0.

---

## Welle D — Wetterebenen auf der Karte + Pins verschieben (22.10.2026)

Auftrag Tim: Pins am Desktop per Drag & Drop verschieben; Wolken- und
Regenradar-ähnliche Ansicht, möglichst kostenlos.

Recherche Datenquellen (22.10.2026):
- RainViewer: seit 01.01.2026 nur private/edukative Nutzung, Zoom ≤ 7,
  keine Vorhersage → für eine App mit Bezahlmodell ungeeignet.
- Open-Meteo Weather-Map-Layer: technisch passend, aber GPL-2.0 und laut
  Hersteller „nicht produktionsreif" → nicht jetzt.
- OpenWeatherMap-Kacheln: gratis nur nicht-kommerziell.
- **DWD GeoServer WMS (maps.dwd.de), CC BY 4.0, CORS offen → gewählt:**
  `Niederschlagsradar` (Radar DE, 5 min, ~+2 h), `Icon-eu_reg00625_fd_sl_TOTPREC03H`
  (Niederschlag Europa, 3 h, ~+6 Tage), `Icon_reg025_fd_sl_TOTPREC06H`
  (global, bis ~+7 Tage), `Satellite_meteosat_1km_euat_rgb_day_hrv_and_night_ir108_3h`
  (Wolken Satellit Europa, 3 h, letzte ~33 h). Quellenvermerk
  „Deutscher Wetterdienst (CC BY 4.0)".

| # | Maßnahme |
|---|---|
| D1 | Kartenebenen-Schalter (Aus / Regenradar live / Regen-Vorhersage / Wolken Satellit) als WMS-Rasterquelle in MapLibre, Deckkraft, Legende, Quellenvermerk; mobil und Desktop. |
| D2 | Zeitwahl: Radar „jetzt" + Animation der letzten 2 h; Vorhersage an die Reisetage gekoppelt (Tag + 3-h-Schritt), verfügbarer Zeitraum aus GetCapabilities des Layers; außerhalb → Hinweis. |
| D3 | Pins (Orte der Suche) am Desktop per Drag & Drop verschieben; Name per Reverse-Geocoding aktualisieren; nur außerhalb von Lade-/Ergebniszustand. |
