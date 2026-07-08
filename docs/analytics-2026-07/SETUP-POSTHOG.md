# WeatherChaser — PostHog-Setup (Analytics + Error-Tracking + Session-Replay)

Einmalige Einrichtung, ~10 Minuten. Ohne diese Schritte no-op't das Analytics
einfach (die App funktioniert normal, es wird nur nichts erfasst).

## 1. PostHog-Projekt anlegen (EU Cloud!)

1. https://eu.posthog.com/signup → Konto anlegen (**wichtig: `eu.`** — Frankfurt,
   nicht `us.`; passt zur GDPR-Linie wie Supabase eu-central-1).
2. Neues Projekt: Name `weather-chaser`.
3. **Project Settings → Project API Key** kopieren (beginnt mit `phc_...`).
   Der Key ist public-safe (landet im Client-Bundle).

## 2. Vercel-Env setzen (nur Production)

Vercel → Projekt *weather-chaser* → **Settings → Environment Variables**:

| Name | Wert | Environment |
|---|---|---|
| `VITE_POSTHOG_KEY` | `phc_...` (aus Schritt 1) | **nur Production** |
| `VITE_POSTHOG_HOST` | `https://eu.i.posthog.com` | **nur Production** |

Preview/Development bewusst leer lassen → dortige Builds senden nichts und
halten die Prod-Daten sauber. Danach einmal re-deployen (Env wird zur
Build-Zeit eingebettet).

## 3. PostHog-Projekt-Einstellungen

- **Session replay** → aktivieren; „Mask all input fields" anlassen (der
  Client sendet ohnehin `maskAllInputs: true`).
- **Error tracking → Exception autocapture**: **AUS lassen!** Die App meldet
  Exceptions selbst über eigene Handler (`src/lib/logger.ts`) — der Toggle
  würde alles doppelt erfassen.
- Web Analytics / Product Analytics: keine weitere Konfiguration nötig,
  `$pageview` kommt automatisch (History-Change-Tracking).

## 4. Smoke-Test (optional, empfohlen)

Lokal mit einem **zweiten** PostHog-Projekt („weather-chaser-dev"):

```bash
# apps/web/.env.local
VITE_POSTHOG_KEY=phc_devprojekt...
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

`pnpm dev` → im DEV-Modus loggt PostHog in die Konsole (`posthog.debug()`)
und ist als `window.posthog` verfügbar. Prüfen:
- Suche ausführen → `search_started` / `search_completed` in der Konsole
- `window.posthog.captureException(new Error('smoke'))` → erscheint in
  PostHog unter Error tracking
- Feedback absenden → `feedback_submitted`

Danach die Zeilen aus `.env.local` wieder entfernen (sonst sendet jede
Dev-Session Events).

## Wo was landet

| Was | Wo in PostHog |
|---|---|
| Nutzungs-Events (Suchen, Saves, Feedback…) | **Activity / Product analytics** |
| Fehler (Boundary, Worker, window.onerror) | **Error tracking** |
| Session-Aufzeichnungen (Inputs maskiert) | **Session replay** |
| Feedback-Inhalte (Rating + Text) | **Supabase → Tabelle `feedback`** (PostHog bekommt nur das Event `feedback_submitted` ohne Text) |

## Datenschutz-Eckpunkte (so ist es implementiert)

- `persistence: 'memory'` → keine Cookies, kein localStorage durch PostHog →
  kein Cookie-Banner nötig. Preis: Gäste zählen pro Pageload als „neuer" Nutzer.
- EU-Host, IP-Erfassung bei EU-Cloud-Projekten standardmäßig deaktiviert.
- `identify()` nur mit der Supabase-User-ID — nie E-Mail/Name.
- `/privacy` beschreibt die Verarbeitung (Abschnitt „Nutzungsanalyse").
