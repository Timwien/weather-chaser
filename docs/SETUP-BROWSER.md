# WeatherChaser — Browser-Setup für den Production-Deploy

Anleitung für das einmalige Einrichten von Supabase, Google OAuth und Vercel.
Schritt für Schritt ausführbar (auch durch einen Browser-Agenten). Stripe ist
**bewusst ausgeklammert** — Premium ist bis zur GA für alle kostenlos
(Flag `PREMIUM_FREE_BETA`, siehe Abschnitt 6).

Repo: `github.com/Timwien/weather-chaser` · Stand: 2026-06-11

---

## Teil 1 — Supabase (Datenbank + Auth)

1. https://supabase.com → **Sign in** (GitHub-Login empfohlen).
2. Falls noch kein Projekt existiert: **New project**
   - Organization: eigene
   - Name: `weather-chaser`
   - Database Password: **generieren lassen und sicher speichern** (Passwort-Manager)
   - Region: **Europe (Frankfurt) / eu-central-1** ← wichtig (GDPR)
   - **Create new project**, ~2 Min. warten bis "Project is ready".
3. **SQL Editor** (linke Sidebar) → **New query** → kompletten Inhalt von
   [`apps/web/src/lib/schema.sql`](../apps/web/src/lib/schema.sql) einfügen → **Run**.
   - Erwartung: "Success. No rows returned". Legt `saved_routes`,
     `saved_finder_searches`, `favorites`, `subscriptions` inkl. RLS-Policies an.
   - Kontrolle: **Table Editor** → die 4 Tabellen sind sichtbar.
4. **Project Settings → API** — drei Werte kopieren und notieren:
   - **Project URL** (z. B. `https://abcdefgh.supabase.co`)
   - **anon public** Key
   - **service_role** Key (⚠️ geheim — nie im Client/Repo)
5. **Authentication → Providers → Email**: muss **enabled** sein (Default).
   "Confirm email" eingeschaltet lassen.
6. **Authentication → URL Configuration**:
   - Site URL: vorerst `http://localhost:5173` (wird in Teil 4 auf die
     Vercel-Domain geändert)
   - **Additional Redirect URLs** hinzufügen:
     `http://localhost:5173`, `http://localhost:5174`

---

## Teil 2 — Google OAuth (Sign in with Google)

<!--
1. https://console.cloud.google.com → mit Google-Konto anmelden.
2. Projekt-Dropdown (oben) → **New Project** → Name `WeatherChaser` → Create →
   Projekt auswählen.
3. **APIs & Services → OAuth consent screen** (heißt teils "Google Auth Platform → Branding"):
   - User Type: **External** → Create
   - App name: `WeatherChaser`, User support email: eigene Adresse,
     Developer contact: eigene Adresse → Save
   - Publishing status darf auf **Testing** bleiben; unter **Test users**
     die eigene Google-Adresse hinzufügen (sonst schlägt der Login fehl).
4. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**:
   - Application type: **Web application**, Name: `WeatherChaser Web`
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - (nach Teil 3 ergänzen: `https://<vercel-domain>`)
   - **Authorized redirect URIs** — exakt eine, von Supabase:
     - `https://<supabase-projekt-ref>.supabase.co/auth/v1/callback`
       (die Projekt-URL aus Teil 1 Schritt 4 + `/auth/v1/callback`)
   - **Create** → **Client ID** und **Client Secret** kopieren.
5. Zurück zu Supabase: **Authentication → Providers → Google** →
   **Enable** → Client ID + Client Secret einfügen → **Save**.

*(Apple Sign-in: übersprungen — braucht Apple-Developer-Account, kommt mit
den nativen Apps in Phase 5.)*
-->

---

## Teil 3 — Vercel (Hosting + Serverless-Proxies)

1. https://vercel.com → **Sign up / Log in with GitHub**.
2. **Add New… → Project** → bei `Timwien/weather-chaser` auf **Import**.
3. Konfiguration im Import-Dialog:
   - Framework Preset: **Vite**
   - **Root Directory**: `Edit` → `apps/web` auswählen
     (Option "Include source files outside of the Root Directory" aktiviert lassen)
   - **Build Command** (Override aktivieren):
     `cd ../.. && pnpm turbo run build --filter=@weatherchaser/web`
   - Output Directory: `dist` (Default)
   - Install Command: Default lassen (Vercel erkennt pnpm-Workspace)
4. **Environment Variables** (für Production + Preview + Development):

   | Name | Wert |
   |------|------|
   | `VITE_SUPABASE_URL` | Project URL aus Teil 1 |
   | `VITE_SUPABASE_ANON_KEY` | anon public Key |
   | `SUPABASE_URL` | dieselbe Project URL |
   | `SUPABASE_ANON_KEY` | derselbe anon Key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role Key (als **Sensitive** markieren) |

   *Nicht setzen (bewusst):* Stripe-Keys, `PREMIUM_FREE_BETA` — Premium ist
   per Default kostenlos bis GA.
5. **Deploy** klicken, ~2–3 Min. warten. Die Produktions-Domain notieren
   (z. B. `https://weather-chaser-xyz.vercel.app`).

---

## Teil 4 — URLs nachtragen (5 Minuten, nicht überspringen!)

Mit der echten Vercel-Domain aus Teil 3:

1. **Supabase → Authentication → URL Configuration**:
   - Site URL: `https://<vercel-domain>`
   - Additional Redirect URLs: `https://<vercel-domain>` ergänzen
     (localhost-Einträge drinlassen für lokale Entwicklung).
2. **Google Cloud Console → Credentials → WeatherChaser Web**:
   - Authorized JavaScript origins: `https://<vercel-domain>` ergänzen → Save.

---

## Teil 5 — Verifikations-Checkliste

Auf `https://<vercel-domain>` durchklicken:

- [ ] Seite lädt, Karte erscheint, kein Console-Error
- [ ] Als **Gast**: Reisedaten + Ort wählen → "Beste Route finden" → Route generieren (funktioniert ohne Login)
- [ ] "Bestes Wetter finden" → Ranking erscheint
- [ ] Dark Mode + Sprachwechsel (Settings über Account-Icon)
- [ ] **Registrieren** mit E-Mail → Bestätigungs-Mail kommt an (Supabase-Standard-SMTP, Limit ~4 Mails/h — für Beta ok) → einloggen
- [ ] Eingeloggt: Route generieren → **Route speichern** → Account → Saved: Route ist da
- [ ] **Sign in with Google** funktioniert (Konto muss als Test user eingetragen sein, Teil 2 Schritt 3)
- [ ] Routen-Konfiguration: "Eigene Gewichtung" zeigt Badge **"In der Beta kostenlos"** und die Slider sind nach "Anpassen" nutzbar

Bekannte Einschränkung (ok für Beta): Fahrtzeiten nutzen in Production die
Haversine-Schätzung statt OSRM (kein `VITE_OSRM_URL` gesetzt; öffentlicher
OSRM-Demo-Server ist in Prod per ToS tabu). Selbst gehostetes OSRM ist ein
späteres Thema.

---

## Teil 6 — Später (nicht jetzt)

- **GA / Stripe aktivieren**: In Vercel `VITE_PREMIUM_FREE_BETA=false` und
  `PREMIUM_FREE_BETA=false` setzen + `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
  `STRIPE_WEBHOOK_SECRET` eintragen, Webhook-Endpoint `/api/stripe/webhook`
  im Stripe-Dashboard anlegen (Events: `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`). Redeploy.
- **Resend-SMTP** (vor öffentlichem Launch, braucht eigene Domain):
  resend.com-Konto → Domain verifizieren → SMTP-Zugangsdaten in Supabase
  unter Authentication → Emails → SMTP Settings eintragen. Hebt das
  4-Mails/h-Limit auf.
- **Eigene Domain** in Vercel verbinden (Settings → Domains) — danach
  Teil 4 mit der neuen Domain wiederholen.

---

## Lokale Entwicklung mit Auth (optional)

Datei `apps/web/.env.local` anlegen (ist gitignored):

```
VITE_SUPABASE_URL=https://<projekt-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Ohne diese Datei läuft die App lokal im Gast-Modus (alles außer
Speichern/Login funktioniert).
