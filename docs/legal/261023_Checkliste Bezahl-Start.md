---
stand: 2026-10-23
status: Entwurf
---

# Checkliste Bezahl-Start (Premium mit Stripe)

> **Entwurf — vor Nutzung anwaltlich prüfen lassen.** Arbeitsliste für den Tag, an
> dem WeatherChaser Geld nimmt. Grundlage: `261023_Recherche AGB.md`,
> `261023_Recherche Datenschutz.md`, `261023_Entwurf AGB Premium.md`,
> `261023_Entwurf Widerrufsbelehrung.md`. Keine Rechtsberatung.

## 1. Vor der ersten Zahlung: Texte

- [ ] AGB Premium finalisieren und anwaltlich prüfen lassen (Entwurf liegt vor).
- [ ] Widerrufsbelehrung, Muster-Widerrufsformular und Checkbox-Text finalisieren.
- [ ] Datenschutzerklärung um Stripe ergänzen (Abschnitt 15 ersetzen): Zweck,
      Art. 6 Abs. 1 lit. b (Zahlung) und lit. c (Aufbewahrung), Daten (Name,
      E-Mail, Zahlungsart, Rechnungsdaten, Abo-Status), Speicherdauer
      (Buchungsbelege 8 Jahre, Bücher und Jahresabschlüsse 10 Jahre; § 147 AO,
      § 257 HGB — mit Steuerberater bestätigen), Stripe teils eigener
      Verantwortlicher, Drittland (DPF + SCC).
- [ ] Kontolöschung beschreiben: Stripe-Kunde und Rechnungen bleiben wegen
      Aufbewahrungspflicht; nur so lange wie nötig.
- [ ] Bestandsnutzer: neue AGB nur mit **aktiver Zustimmung** (Dialog beim
      nächsten Login, Zustimmung mit Zeitstempel speichern; kein „gilt als
      angenommen“).
- [ ] Englische Übersetzungen mit Vorrangklausel.

## 2. Bestellablauf (Button-Lösung, § 312j BGB)

- [ ] Unmittelbar über der Bestell-Schaltfläche: wesentliche Merkmale (was
      Premium enthält), **Gesamtpreis inkl. USt** und Intervall, bei Jahresabo
      auch die Jahressumme, Erstlaufzeit, Verlängerung, Kündigungsfrist.
- [ ] Schaltfläche genau „zahlungspflichtig bestellen“ oder gleich eindeutig
      („Jetzt kostenpflichtig abonnieren“). Text in Stripe Checkout prüfen
      (Stripe zeigt sonst „Abonnieren“/„Bezahlen“): ggf. eigene Bestellseite
      vor Stripe bauen, auf der der Vertrag geschlossen wird.
- [ ] Keine Vorauswahl kostenpflichtiger Extras (§ 312a Abs. 3 BGB).
- [ ] Checkbox „sofortiger Beginn / Wertersatz“ (nicht vorausgewählt),
      Zeitstempel speichern.
- [ ] Links zu AGB, Widerrufsbelehrung, Datenschutzerklärung auf der
      Bestellseite.
- [ ] Vorvertragliche Informationen nach Art. 246a EGBGB vollständig
      (Identität, Merkmale, Preis, Laufzeit, Kündigung, Widerrufsrecht,
      Funktionalität und Kompatibilität digitaler Produkte, Mängelrechte).
- [ ] Preisangaben überall als Endpreise (PAngV); bei Kleinunternehmer
      Hinweis „gemäß § 19 UStG keine Umsatzsteuer“.

## 3. Kündigungsbutton (§ 312k BGB)

- [ ] Dauerhaft sichtbarer Link **„Verträge hier kündigen“** (App-Einstellungen
      und Website-Footer), auch **ohne Login** erreichbar (LG München I,
      10.10.2023, 33 O 15098/22).
- [ ] Bestätigungsseite: nur nötige Angaben (Name, E-Mail oder Vertragsnummer,
      ordentliche/außerordentliche Kündigung, gewünschter Zeitpunkt, E-Mail für
      Bestätigung); Schaltfläche **„jetzt kündigen“**.
- [ ] Keine Halteangebote (Rabatt, Pause) auf der Bestätigungsseite (laut
      Sekundärquellen BGH I ZR 200/25 vom 16.07.2026 — Urteil verifizieren).
- [ ] Sofortige Eingangsbestätigung per E-Mail mit Datum, Uhrzeit, Inhalt und
      Vertragsende.
- [ ] Umsetzung über die Stripe-API (`cancel_at_period_end`) in einer eigenen
      Seite statt nur über das Stripe Customer Portal (Portal braucht Login).
- [ ] Gesperrtes oder gelöschtes Konto: Kündigung trotzdem per Formular möglich.

## 4. Widerrufsfunktion (§ 356a BGB, seit 19.06.2026)

- [ ] Schaltfläche **„Vertrag widerrufen“** während der Widerrufsfrist gut
      sichtbar; Bestätigungsseite mit **„Widerruf bestätigen“**; keinen Grund
      abfragen.
- [ ] Automatische Eingangsbestätigung per E-Mail mit Inhalt, Datum, Uhrzeit.
- [ ] Erstattung binnen 14 Tagen über Stripe (Refund), Wertersatz anteilig.
- [ ] Neben dem Kündigungsbutton, nicht statt ihm.

## 5. E-Mails

- [ ] Vertragsbestätigung (§ 312f BGB) unmittelbar nach Bestellung: Vertragsinhalt,
      AGB, Widerrufsbelehrung + Formular (als Text oder PDF), Bestätigung der
      Checkbox (sofortiger Beginn, Wertersatz).
- [ ] Rechnung je Zahlung (Stripe Invoices; Pflichtangaben § 14 UStG, bei
      Kleinunternehmer Hinweis § 19 UStG).
- [ ] Erinnerung vor Verlängerung eines Jahresabos (empfehlenswert, z. B. 30 Tage
      vorher).
- [ ] Bestätigungen für Kündigung und Widerruf (siehe 3 und 4).
- [ ] Info bei fehlgeschlagener Zahlung und bei Preisänderungswunsch
      (Zustimmung einholen).
- [ ] Versand über einen eigenen Mail-Dienst (z. B. Resend) mit Absender-Domain;
      dann AVV abschließen und in der Datenschutzerklärung nennen.

## 6. Steuer und Gewerbe (mit Steuerberater klären)

- [ ] Gewerbeanmeldung für den Verkauf der App nötig?
- [ ] Kleinunternehmerregelung (§ 19 UStG) ja/nein.
- [ ] Umsatzsteuer bei Verbrauchern in anderen EU-Staaten (digitale Leistung:
      Ort der Leistung beim Kunden; One-Stop-Shop ab 10.000 € EU-Umsatz).
- [ ] USt-IdNr. beantragen, falls nötig, und dann im Impressum ergänzen.
- [ ] Stripe Tax ein- oder ausschalten.

## 7. Datenquellen für kommerzielle Nutzung

- [ ] **Open-Meteo:** kostenlose API nur für nicht-kommerzielle Nutzung →
      kommerziellen Tarif buchen oder selbst hosten.
- [ ] **CARTO Basemaps:** Nutzungsbedingungen für kommerzielle Nutzung und
      Abrufvolumen prüfen; Alternative mit EU-Anbieter oder selbst gehosteten
      Kacheln erwägen (löst auch die USA-Übermittlung, siehe Datenschutzerklärung
      Abschnitt 14).
- [ ] **Nominatim:** Nutzungsrichtlinie (max. 1 Anfrage/s, gültiger User-Agent,
      kein Massenabruf); bei Wachstum eigenen Dienst oder kommerziellen Anbieter.
- [ ] **DWD, GeoNames, OpenStreetMap:** Namensnennung beibehalten (CC BY 4.0,
      ODbL).

## 8. Auftragsverarbeitung (Art. 28 DSGVO)

AVV online abschließen bzw. akzeptieren, PDF mit Datum ablegen:

| Anbieter | Rolle | AVV |
|---|---|---|
| Vercel | Hosting, Server-Funktionen, Logs | [vercel.com/legal/dpa](https://vercel.com/legal/dpa) |
| Supabase | Datenbank, Auth, Auth-E-Mails | [supabase.com/legal/dpa](https://supabase.com/legal/dpa) (Unterschrift über PandaDoc) |
| PostHog | Analyse, Replay (nur Opt-in) | [posthog.com/dpa](https://posthog.com/dpa) |
| Stripe | Zahlungen (teils eigener Verantwortlicher) | [stripe.com/legal/dpa](https://stripe.com/legal/dpa) |
| Resend (falls genutzt) | Transaktions-E-Mails | [resend.com/legal/dpa](https://resend.com/legal/dpa) |

Kein AVV nötig (eigene Verantwortung oder keine Personendaten): CARTO, Deutscher
Wetterdienst, Open-Meteo, Nominatim/OSMF, Google und Apple (Login).

## 9. Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

Kurzes Dokument anlegen (Tabelle genügt), je Zeile: Verarbeitung, Zweck,
Rechtsgrundlage, betroffene Personen, Datenkategorien, Empfänger, Drittland +
Garantie, Löschfrist, technische und organisatorische Maßnahmen (TOM).

Zeilen: Hosting/Server-Logs · Konto/Auth · Auth-E-Mails · gespeicherte Inhalte ·
Wetter/Ortssuche über Server · Karte/Wetterebenen im Browser · Analyse/Replay
(Einwilligung) · Feedback · Browser-Speicher · Kontolöschung · Zahlungen/Rechnungen
· Kündigung/Widerruf · Support-E-Mails.

TOM kurz: HTTPS, Zeilenrechte in der Datenbank (RLS), Service-Key nur serverseitig,
2-Faktor-Login für alle Dashboards, Sicherheits-Header, Einwilligungs-Gate für
Analyse, Löschroutinen.

## 10. In den Dashboards (Tim)

Schon für die Beta (Datenschutzerklärung verspricht das):

- [ ] **PostHog:** EU-Projekt bestätigen; „Discard client IP data“ einschalten;
      Aufbewahrung prüfen (Ereignisse ≤ 12 Monate, Aufzeichnungen ≤ 30 Tage —
      bei Tarifwechsel anpassen); persönlichen API-Schlüssel für die
      Personen-Löschung bei Kontolöschung in Vercel hinterlegen; AVV.
- [ ] **Vercel:** Tarif und Log-Aufbewahrung prüfen (Observability Plus aus,
      keine Log Drains); Region fra1; AVV.
- [ ] **Supabase:** Region eu-central-1 bestätigen; AVV unterschreiben;
      Löschroutine für unbestätigte Registrierungen (3 Monate) und Feedback
      (24 Monate) einrichten; Absender und Texte der Auth-E-Mails prüfen.
- [ ] **Google Cloud / Apple Developer:** im OAuth-Zustimmungsbildschirm
      Datenschutzerklärung- und Nutzungsbedingungen-URL eintragen.
- [ ] 2-Faktor-Anmeldung in allen Dashboards.

Zusätzlich beim Bezahl-Start:

- [ ] **Stripe:** Konto verifizieren, Steuer-Einstellungen, Rechnungs-Layout mit
      Pflichtangaben, Kundenportal nur ergänzend, Webhooks für Kündigung und
      Widerruf, AVV/Datenschutz-Einstellungen.
- [ ] Domain mit eigener Adresse (statt weather-chaser.vercel.app) und
      Mail-Absender-Domain (SPF, DKIM, DMARC).
