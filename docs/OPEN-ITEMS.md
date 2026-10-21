# WeatherChaser — Offene Punkte

Konsolidierter Stand: 2026-10-21 (nach Fertigstellungsrunde, Branch
`finish-2026-10`, siehe `docs/261021_Fertigstellungsplan.md`).
App live: https://weather-chaser.vercel.app · Premium kostenlos bis GA.

Pflege: Erledigtes abhaken/streichen, Neues einsortieren. Die GSD-Planung
(`.planning/ROADMAP.md` / `STATE.md`) bleibt führend für die großen Phasen;
dieses Dokument ist die operative Kurzliste.

---

## 0. Nur Tim kann das erledigen (Reihenfolge = Wichtigkeit)

- [ ] **Betreiberdaten eintragen** (Pflicht vor öffentlichem Launch):
      Platzhalter in `apps/web/src/i18n/locales/de/common.json` und
      `en/common.json`, Schlüssel `legal.privacy_controller_b`,
      `legal.imprint_operator_b`, `legal.imprint_contact_b`,
      `legal.imprint_responsible_b` (Name, ladungsfähige Anschrift, E-Mail).
      Alternativ die Daten an Claude geben, dann trägt Claude sie ein.
- [ ] **Vorschau prüfen und live schalten:** Vercel-Vorschau des Branches
      `finish-2026-10` (eingeloggt in Vercel öffnen) kurz auf dem Handy testen,
      dann Branch nach `main` mergen → Vercel deployt Production.
      Rückweg: in Vercel „Instant Rollback" auf das vorherige Deployment.
- [ ] **Rate-Limit in Vercel** (Firewall → Rate Limiting) für
      `/api/proxy/weather` und `/api/places`, z. B. 60 Anfragen/Minute je IP.
      Wichtig, sobald ein bezahlter `OPEN_METEO_API_KEY` gesetzt ist.
- [ ] DB-Migrationen im Supabase SQL-Editor, falls noch nicht geschehen:
      `docs/feedback-2026-07/migration-search-history.sql` („Letzte Suchen")
      und `docs/analytics-2026-07/migration-feedback.sql` (Feedback-Tabelle).
- [ ] PostHog einrichten, falls noch nicht geschehen:
      `docs/analytics-2026-07/SETUP-POSTHOG.md`.
- [ ] Auf echtem Gerät (iPhone Safari + Android Chrome): App zum
      Home-Bildschirm hinzufügen, Suche, Route, Zurück-Geste, Konto-Dialog.
- [ ] Vercel-CLI neu anmelden (`vercel login`), das gespeicherte Token ist
      abgelaufen; nur nötig, wenn Claude Vorschauen selbst prüfen soll.

## 1. Verifikation durch Tim (Konto-Funktionen, nur manuell möglich)

- [ ] E-Mail-Registrierung auf Prod: Bestätigungsmail kommt an, Login klappt
- [ ] Google-Login (eigene Adresse muss als Test User in der Google Console stehen)
- [ ] Route speichern → erscheint unter Account → Saved
- → danach: Phase 3 Plan 03-07 in `.planning/` als abgeschlossen dokumentieren

## 2. Bekannte Beta-Einschränkungen (bewusst akzeptiert)

- Fahrtzeiten in Prod = Haversine-Schätzung (kein eigenes OSRM; Demo-Server per ToS tabu)
- Open-Meteo Gratis-Tier: parallele Batches mit 30-s-Gesamtbudget, Teilergebnisse
  statt Totalausfall, `Retry-After` wird beachtet. Eskalation:
  `OPEN_METEO_API_KEY` in Vercel setzen (~29 €/Monat, kein Code nötig)
- Ortsdaten: eigener Datensatz (GeoNames `cities1000`, CC BY 4.0, ~73k Orte
  in Europa, deutsche/englische Namen, Region + Land), ausgeliefert über
  `/api/places` mit CDN-Cache; kein Fremddienst mehr im Pfad (Overpass ist
  seit April 2026 für uns gesperrt und wurde entfernt). Aktualisieren:
  `scripts/build-places.mjs` erneut ausführen. Orte unter 1.000 Einwohnern
  fehlen bewusst.
- Ortssuche (Autovervollständigung) nutzt zusätzlich Nominatim (OSM) für
  Regionen, Inseln, Berge.
- Supabase-Standard-SMTP: ~4 Mails/Stunde (Registrierungs-Limit für Tester)
- Kein Offline-Modus (bewusst kein Service-Worker: Live-Wetter)

## 3. Kleinere Produkt-Todos

- [ ] `packages/locales` extrahieren: EN/DE-JSONs aus apps/web teilen,
      damit die native App (apps/mobile) dieselben Übersetzungen nutzt
- [ ] Ungenutzte i18n-Schlüssel `guide_next_*` entfernen (seit Welle C2 ohne Verwendung)

## 4. Vor öffentlichem Launch (Reihenfolge empfohlen)

- [x] `/privacy`, `/tos`, `/impressum` existieren (Platzhalter siehe §0)
- [ ] Eigene Domain in Vercel → danach Supabase Site/Redirect-URLs +
      Google-OAuth-Origins nachtragen (SETUP-BROWSER.md Teil 4 wiederholen);
      OG-Tags in `apps/web/index.html` und `PUBLIC_APP_URL` auf die Domain umstellen
- [ ] Resend-SMTP in Supabase (hebt Mail-Limit; braucht die eigene Domain)
- [ ] Google OAuth Consent Screen von "Testing" auf "In production" stellen
- [ ] Open-Meteo-API-Key erwägen (siehe Abschnitt 2)
- [ ] Open-Meteo-Attribution/Kommerzialisierungs-Policy final prüfen
      (Blocker-Notiz aus Phase 1 in STATE.md)
- [ ] Rechtstexte (Datenschutz, Nutzungsbedingungen, Impressum) juristisch
      gegenlesen lassen

## 5. Große Phasen (geplant)

- **Phase 4 GA / Stripe**: Code komplett & schlummernd. Aktivierung ohne
  Code: Stripe-Konto → `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
  `STRIPE_WEBHOOK_SECRET` + `PUBLIC_APP_URL` in Vercel, Webhook
  `/api/stripe/webhook` anlegen (3 Events), dann
  `VITE_PREMIUM_FREE_BETA=false` + `PREMIUM_FREE_BETA=false`.
  Details: SETUP-BROWSER.md Teil 6
- **Phase 5 Native Apps**: Expo-Scaffold läuft (shared core verifiziert).
  Bis dahin ist die Web-App als PWA installierbar (Manifest + Icons seit
  Oktober 2026). Ausstehend: Map (@rnmapbox/maps), Screens, Auth
  (expo-auth-session), EAS Build/Submit. Braucht Apple-Developer-,
  Play-Console- und EAS-Konten. Siehe apps/mobile/README.md

## Erledigt in der Fertigstellungsrunde Oktober 2026

PWA (Manifest, Icons, OG-Vorschau), 404-Seite, Impressum, Pinch-Zoom,
Tastaturbedienung der Dialoge, schnelleres Laden (Code-Splitting),
eigener Ortsdatensatz statt Overpass, Gebietssuche repariert (vorher immer
0 Treffer), Wetterabfrage parallel mit Zeitbudget, Proxys gegen Missbrauch
gehärtet, mobile Ergebnisliste zuerst sichtbar, erklärte und immer sichtbare
Haupt-Buttons, Ortssuche mit Region, Browser-Zurück bleibt in der App,
geteilte Routen mit echten Wetterwerten, Konto-Dialog über der ganzen App,
Tablet-Layout, Touch-Ziele ≥ 40 px. Details: `docs/261021_Fertigstellungsplan.md`.
