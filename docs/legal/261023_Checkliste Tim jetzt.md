---
stand: 2026-10-23
status: offen
---

# Checkliste für Tim: jetzt erledigen (Beta, vor dem öffentlichen Start)

Die Datenschutzerklärung (Stand Oktober 2026) verspricht einige Dinge, die nicht
im Code stecken, sondern in Einstellungen bei den Anbietern. Solange diese Punkte
offen sind, stimmt der Text nicht. Reihenfolge = Wichtigkeit. Keine Rechtsberatung.

## 1. PostHog (Dashboard, EU-Projekt)

- [ ] **„Discard client IP data“ einschalten** (Project settings → General /
      IP data capture). Schaltet auch die Standort-Ermittlung aus der IP (GeoIP)
      ab. Datenschutzerklärung § 10 sagt: „IP-Adresse wird nicht gespeichert, kein
      Standort daraus abgeleitet“, das stimmt erst mit diesem Schalter.
- [ ] **Aufbewahrung:** Ereignisse höchstens 12 Monate, Sitzungsaufzeichnungen
      höchstens 30 Tage (Data retention bzw. Replay → Retention). Versprochen in § 10.
- [ ] **Exception autocapture AUS** (Error tracking → Settings). Die App schickt
      Fehler nur selbst als Typ + Prüfsumme; die Automatik würde Meldungstexte und
      Stack-Traces senden. Im Code ist sie zusätzlich aus (`capture_exceptions: false`).
- [ ] **Replay: Konsolen-Logs und Netzwerk-Aufzeichnung AUS** (Session replay →
      Settings: „Capture console logs“ und „Capture network requests“). Im Code
      sind Konsolen-Logs, Netzwerk-Zeiten sowie Header und Inhalte von Anfragen
      ebenfalls aus; der Dashboard-Schalter ist die zweite Sicherung.
- [ ] **Umgebungsvariablen in Vercel setzen** (Settings → Environment Variables,
      Production): `POSTHOG_PERSONAL_API_KEY` (Personal API Key mit Scope
      `person:write`) und `POSTHOG_PROJECT_ID`. Ohne beide löscht die
      Kontolöschung die PostHog-Daten NICHT, obwohl § 10 und § 13 das versprechen.
- [ ] **Auftragsverarbeitungsvertrag (DPA)** mit PostHog abschließen bzw. das
      unterschriebene Exemplar ablegen (posthog.com/dpa). § 14 behauptet, dass er
      besteht.

## 2. Supabase

- [ ] **DPA** abschließen/ablegen (Dashboard → Organization → Legal Documents).
- [ ] **Region prüfen:** Project settings → General → Region muss
      „Central EU (Frankfurt)“ / `eu-central-1` sein (so steht es in § 4).
- [ ] **Lösch-Jobs einrichten:** `docs/legal/261023_supabase-retention.sql` im
      SQL Editor ausführen (Anleitung steht oben in der Datei). Ohne die Jobs
      werden nicht gelöscht: unbestätigte Registrierungen nach 3 Monaten (§ 4),
      Feedback nach 24 Monaten (§ 11), Suchverlauf nach 12 Monaten (§ 7).
      Teil 3 der Datei (einmaliges Löschen von Feedback ohne Nutzer-ID) erst nach
      dem Deployment ausführen und dort das Datum des Deployments eintragen.
- [ ] Nach einigen Tagen kontrollieren, ob die Jobs gelaufen sind (Abfrage steht
      in der SQL-Datei).

## 3. Vercel

- [ ] **DPA** prüfen/ablegen (vercel.com/legal/dpa; gilt meist automatisch mit den
      Nutzungsbedingungen, trotzdem ein Exemplar sichern).
- [ ] **Log-Aufbewahrung:** keine Log Drains und keine Observability-Erweiterung
      mit längerer Speicherung einschalten (§ 3 sagt: wenige Stunden bis drei Tage,
      keine Weitergabe).
- [ ] Region der Functions = `fra1` (Settings → Functions).

## 4. Stripe

- [ ] Stripe-Schlüssel (`STRIPE_*`) bleiben in Vercel **leer**, solange die Beta
      kostenlos ist. § 15 sagt: keine Zahlungen. Für den Bezahl-Start gilt
      `261023_Checkliste Bezahl-Start.md`.

## 5. Google und Apple (Anmeldung)

- [ ] **Google Cloud Console → OAuth consent screen:** App-Name, Support-E-Mail,
      Links zu Datenschutzerklärung (`https://<domain>/privacy`) und
      Nutzungsbedingungen (`https://<domain>/tos`) eintragen; App veröffentlichen.
- [ ] **Apple Developer → Sign in with Apple:** Datenschutz-URL hinterlegen,
      E-Mail-Weiterleitung (Private Relay) für die Absenderdomain einrichten.

## 6. Impressum

- [ ] **USt-IdNr.:** Hast du eine, muss sie ins Impressum (§ 5 DDG). Dann mir oder
      dem Agenten Bescheid geben; sonst nichts tun.
- [ ] Das Impressum nennt jetzt nur die E-Mail als Kontakt (das Feedback-Formular
      hat keine Antwortadresse). Wenn du eine zweite schnelle Kontaktmöglichkeit
      willst (Telefon oder Kontaktformular mit Antwort-E-Mail), ergänzen lassen.

## 7. Drittland-Übermittlung: Listen prüfen

Die Datenschutzerklärung (§ 14) stützt sich auf Angaben der Anbieter. Auf
[dataprivacyframework.gov/list](https://www.dataprivacyframework.gov/list)
nachsehen, ob der Eintrag besteht und „Active“ ist:

- [ ] **Vercel Inc.**
- [ ] **PostHog, Inc.**
- [ ] **CartoDB Inc. / CARTO**: CARTO schreibt in seinen Datenschutzhinweisen
      (carto.com/privacy, abgerufen am 23.10.2026), es sei unter dem DPF
      zertifiziert. Den Eintrag in der offiziellen Liste konnte ich nicht
      automatisch abrufen (die Seite lädt nur im Browser). **Wenn CARTO nicht
      gelistet ist:** § 9/§ 14 ändern lassen (Übermittlung in die USA ohne
      Angemessenheitsbeschluss) und einen EU-Kartenanbieter erwägen, z. B.
      OpenFreeMap oder selbst gehostete Kacheln. Das wäre ohnehin die sauberste Lösung.
- [ ] **Google LLC** und **Apple Inc.**

## 8. Hinweis, kein Muss

- Open-Meteo (OpenMeteo GmbH, Schweiz) erlaubt die kostenlose API nur für
  nicht-kommerzielle Nutzung. Spätestens zum Bezahl-Start ein API-Abo abschließen.
