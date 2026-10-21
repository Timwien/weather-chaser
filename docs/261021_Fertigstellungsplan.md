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

## Welle B — Gebietssuche & Overpass (folgt nach Ursachenanalyse)

Offen bis Diagnose: M2 (großes Gebiet → 0 Treffer), M5 (kleines Gebiet
195 s), C11 (Overpass-Proxy per POST ist nicht cachebar und ein offenes
Relay). Geplante Richtung: Proxy nimmt nur geprüfte Parameter (Gebiet,
Ortstypen, Limit) per GET, baut die Abfrage serverseitig und wird
CDN-cachebar.

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
