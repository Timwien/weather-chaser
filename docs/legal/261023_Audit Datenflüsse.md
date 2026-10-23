# Audit der Datenflüsse (Stand 23.10.2026)

Quelle: Code-Audit eines Agenten auf Branch `finish-2026-10` plus Prüfung der
Live-Seite. Grundlage für Datenschutzerklärung und Technik-Korrekturen.
Nicht geprüft: Dashboard-Einstellungen von Vercel/Supabase/PostHog, tatsächliche
Supabase-Region (nur laut Doku), ob Resend-SMTP aktiv ist.

## 1. Browser kontaktiert Dritte direkt

| Host | Wann | Daten | Fundstelle |
|---|---|---|---|
| fonts.googleapis.com (+ fonts.gstatic.com) | jeder Seitenaufruf (CSS @import) | IP, User-Agent, Referrer | `apps/web/src/styles/tokens.css:11`; live im CSS-Bundle bestätigt |
| basemaps.cartocdn.com | Kartenaufbau (style.json, Vektorkacheln) | IP, Kartenausschnitt, User-Agent | `MapContainer.tsx:30,34` |
| maps.dwd.de | nur bei eingeschalteter Wetterebene | IP, Ausschnitt, Zeit | `services/dwdLayers.ts` |
| eu.i.posthog.com | nach JS-Start: Events, Fehler, Session-Replay | IP, Events, `identify(user.id)`, DOM-Aufzeichnung | `src/lib/analytics.ts:39-49` |
| <projekt>.supabase.co | Auth immer; DB nur angemeldet | E-Mail, JWT, User-ID, gespeicherte Inhalte | `src/lib/supabase.ts` |
| Google/Apple OAuth | nur bei Klick auf Anmelden | Konto-Identität | `src/stores/authStore.ts:74-82` |

Nicht direkt: Nominatim (nur über `/api/proxy/nominatim`), OSRM (in Produktion
nicht genutzt → Luftlinien-Schätzung), Stripe.js (nicht im Bundle). Keine CSP,
Referrer-Policy oder Permissions-Policy gesetzt.

## 2. Server-Funktionen (Vercel fra1)

| Funktion | Dritter | Daten |
|---|---|---|
| `/api/proxy/weather`, `/api/cloudgrid` | api.open-meteo.com | Koordinaten, Daten; keine Nutzer-IP |
| `/api/proxy/nominatim(-reverse)` | nominatim.openstreetmap.org | Suchtext/Koordinaten; keine Nutzer-IP |
| `/api/places` | keiner (lokale GeoNames-Datei) | – |
| `/api/feedback`, `/api/user/delete`, `/api/keepalive` | Supabase (Service-Role) | Feedback-Inhalt, User-ID |
| `/api/stripe/*` | api.stripe.com | E-Mail, User-ID, Abo-Status (ruht in der Beta) |

Keine Protokollierung personenbezogener Daten in Funktionen; Vercel selbst
speichert Request-Logs mit IP.

## 3. Personenbezogene Daten

- Supabase-Tabellen (`src/lib/schema.sql`), je `user_id` mit `on delete cascade`:
  `saved_routes`, `saved_finder_searches`, `favorites`, `search_history`
  (nur clientseitig ausgedünnt), `subscriptions` (ruht).
- `feedback`: `user_id` (bei Kontolöschung `set null`), Bewertung 1–5,
  Nachricht bis 2000 Zeichen, Kontext (source, mode, locale, Viewport,
  is_mobile). Rate-Limit nutzt IP nur im Arbeitsspeicher.
- Konto: E-Mail, Passwort-Hash, Google-/Apple-Identität (Supabase Auth).
- PostHog: `persistence:'memory'`, `autocapture:true`, Pageviews,
  Session-Replay mit `maskAllInputs`, `identify(userId)` nach Login, `reset`
  beim Abmelden. Events: sign_in_completed, search_started/completed/failed,
  search_saved, route_saved, reweight_confirmed, favorite_added,
  language_changed, theme_changed, feedback_prompt_shown/dismissed,
  feedback_submitted.
- Fehler-Logging (`src/lib/logger.ts`): Fehlerobjekt, Bereich, Datei, Zeile an
  PostHog — Meldungen können Ortsnamen enthalten.

## 4. Browser-Speicher

| Schlüssel | Zweck | unbedingt erforderlich? |
|---|---|---|
| `sb-<projekt>-auth-token` (localStorage) | Login-Sitzung | ja (erst nach Login) |
| `wc-theme` | Hell/Dunkel | vom Nutzer gewählte Einstellung |
| Wetterebenen-Wahl (`weatherLayerStore.ts`) | merkt die Ebene | vom Nutzer gewählte Einstellung |
| `wc_first_route_hint_shown` | Hinweis einmalig | Komfort |
| Feedback-Zähler/„gezeigt" | Steuerung Feedback-Hinweis | Komfort |
| Sprache (i18n-Detektor) | Sprache | vom Nutzer gewählte Einstellung |
| sessionStorage `wc_chunk_reload` | Neuladen nach Deploy | ja |

PostHog schreibt keine Cookies/localStorage. Kein `document.cookie` im Code.

## 5. Hosting

Vercel fra1 (Vercel Inc., USA), Supabase eu-central-1 (laut Doku), PostHog EU
Cloud (Frankfurt), Stripe ruht, Domain weather-chaser.vercel.app.

## 6. Löschung, Export, Aufbewahrung

- Kontolöschung (`api/user/delete.ts`) entfernt Auth-Nutzer + Kaskade.
- Bleibt erhalten: Feedback-Text (nur `user_id` → null), PostHog-Daten,
  (künftig) Stripe-Kunde.
- Kein Datenexport (Art. 20 nur auf Anfrage). Keine definierten Fristen für
  Feedback, PostHog, Vercel-Logs.

## 7. Bisherige Rechtstexte — Abweichungen

Platzhalter für Betreiber; Google Fonts fehlt; „kein Tracking" widerspricht
Replay/Autocapture/identify; „IP wird nicht gespeichert" (PostHog) nicht
geprüft; OSRM genannt, aber ungenutzt; Google-/Apple-Login fehlt;
Supabase-Token fehlt bei Speicher; kein Drittland-Abschnitt; keine Fristen;
„alle Daten werden gelöscht" stimmt für Feedback/PostHog nicht.

## 8. Rote Flaggen (Rangfolge)

1. Google Fonts von Google geladen → selbst hosten.
2. Session-Replay + Autocapture + identify ohne Einwilligung → Opt-in-Banner
   oder abschalten; `mask_all_text`.
3. Rechtstexte widersprechen der Realität → Texte bzw. Verhalten anpassen.
4. US-Übermittlungen (Vercel, Google/Apple OAuth) → DPF/SCC nennen, AVV.
5. Löschlücke Feedback/PostHog → Feedback anonymisieren, PostHog-Person löschen.
6. Fehler-Logging sendet Rohmeldungen → nur Name/Bereich senden.
7. Keine Sicherheits-Header → Referrer-Policy, Permissions-Policy, nosniff.
8. Keine Aufbewahrungsfristen → festlegen und nennen.
9. CARTO/DWD erhalten IP → berechtigtes Interesse dokumentieren.
