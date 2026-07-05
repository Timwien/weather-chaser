# WeatherChaser — Offene Punkte

Konsolidierter Stand: 2026-06-11 (nach Production-Deploy + Beta-Freischaltung).
App live: https://weather-chaser.vercel.app · Premium kostenlos bis GA.

Pflege: Erledigtes abhaken/streichen, Neues einsortieren. Die GSD-Planung
(`.planning/ROADMAP.md` / `STATE.md`) bleibt führend für die großen Phasen;
dieses Dokument ist die operative Kurzliste.

---

## 1. Verifikation durch Tim (nur manuell möglich)

- [ ] E-Mail-Registrierung auf Prod: Bestätigungsmail kommt an, Login klappt
- [ ] Google-Login (eigene Adresse muss als Test User in der Google Console stehen)
- [ ] Route speichern → erscheint unter Account → Saved
- [ ] Wetterdaten mobil erneut testen (Retry-Fix deployed; Open-Meteo hatte am 11.06. eine Störung)
- [ ] Bottom-Sheet-Drag-Gefühl auf echtem Gerät (Phase-3.1-Restpunkt; Logik verifiziert)
- → danach: Phase 3 Plan 03-07 in `.planning/` als abgeschlossen dokumentieren

## 2. Bekannte Beta-Einschränkungen (bewusst akzeptiert)

- Fahrtzeiten in Prod = Haversine-Schätzung (kein eigenes OSRM; Demo-Server per ToS tabu)
- Open-Meteo Gratis-Tier: Retries + Batch-Splitting fangen Störungen ab,
  aber kein Fallback bei Totalausfall. Eskalation: `OPEN_METEO_API_KEY`
  in Vercel setzen (~29 €/Monat, dedizierte Server, kein Code nötig)
- Overpass-Ausfälle: abgefedert durch Retries über 3 Mirrors + GeoNames-Fallback
  (8,6k EU-Städte ≥15k Einwohner, gebündelt)
- Supabase-Standard-SMTP: ~4 Mails/Stunde (Registrierungs-Limit für Tester)

## 3. Kleinere Produkt-Todos

- [ ] Finder-Suchen speichern: Button im Finder fehlt — die SavedTab-Sektion
      "Finder searches" bleibt immer leer (Backend/Tabelle existiert)
- [ ] `packages/locales` extrahieren: EN/DE-JSONs aus apps/web teilen,
      damit die native App (apps/mobile) dieselben Übersetzungen nutzt
- [ ] Dev-Defaults entfernen vor Launch (6 vorbefüllte Orte, nur DEV-Build —
      prüfen, dass nichts davon in Prod sichtbar ist)

## 4. Vor öffentlichem Launch (Reihenfolge empfohlen)

- [ ] **Rechtliches: `/privacy` und `/tos` existieren nicht (404!)** — Settings
      verlinken darauf. Impressum + Datenschutzerklärung für DE-Markt Pflicht
- [ ] Eigene Domain in Vercel → danach Supabase Site/Redirect-URLs +
      Google-OAuth-Origins nachtragen (SETUP-BROWSER.md Teil 4 wiederholen)
- [ ] Resend-SMTP in Supabase (hebt Mail-Limit; braucht die eigene Domain)
- [ ] Google OAuth Consent Screen von "Testing" auf "In production" stellen
      (sonst können nur eingetragene Test User Google-Login nutzen)
- [ ] Open-Meteo-API-Key erwägen (siehe Abschnitt 2)
- [ ] Open-Meteo-Attribution/Kommerzialisierungs-Policy final prüfen
      (Blocker-Notiz aus Phase 1 in STATE.md)

## 5. Große Phasen (geplant)

- **Phase 4 GA / Stripe**: Code komplett & schlummernd. Aktivierung ohne
  Code: Stripe-Konto → `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
  `STRIPE_WEBHOOK_SECRET` in Vercel, Webhook `/api/stripe/webhook` anlegen
  (3 Events), dann `VITE_PREMIUM_FREE_BETA=false` + `PREMIUM_FREE_BETA=false`.
  Details: SETUP-BROWSER.md Teil 6
- **Phase 5 Native Apps**: Expo-Scaffold läuft (shared core verifiziert).
  Aussteht: Map (@rnmapbox/maps — Kompatibilität mit Expo SDK prüfen!),
  Screens, Auth (expo-auth-session), EAS Build/Submit.
  Braucht: Apple-Developer- + Play-Console- + EAS-Accounts.
  Siehe apps/mobile/README.md

## Nächster sinnvoller Schritt (Vorschlag)

Impressum/Datenschutz-Seiten + Finder-Speichern-Button — beides klein,
beides launch-relevant.
