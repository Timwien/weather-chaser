# Recherche Datenschutzerklärung (Stand 23.10.2026)

Quelle: Recherche-Agent mit Websuche. Keine Rechtsberatung; vor dem
kostenpflichtigen Start anwaltlich oder per geprüftem Generator gegenprüfen.
Mit „ungeprüft" markierte Punkte an der Primärquelle verifizieren.

## Pflichtinhalte (Art. 13 DSGVO)

1. Verantwortlicher: Name, ladungsfähige Anschrift, E-Mail.
2. Kein Datenschutzbeauftragter nötig (§ 38 BDSG ab 20 Personen) — Satz
   „kein DSB bestellt, Kontakt: …".
3. Je Verarbeitung Zweck, Rechtsgrundlage, Daten, Speicherdauer:
   - Hosting/Server-Logs (Vercel): Art. 6 Abs. 1 lit. f; kurze Frist nennen.
   - Konto/Login (Supabase): Art. 6 Abs. 1 lit. b.
   - Google-/Apple-Login: lit. b; Google/Apple sind für den Login-Schritt
     eigene Verantwortliche; Datenschutzhinweise verlinken.
   - Bestätigungs-/Transaktionsmails: lit. b; Mail-Dienst als Auftragsverarbeiter.
   - Gespeicherte Routen/Suchverlauf: lit. b; bis Löschung/Kontolöschung.
   - Ortssuche (Nominatim), Wetter (Open-Meteo) über eigenen Server: lit. b;
     keine Nutzer-IP weitergegeben.
   - Kartenkacheln (CARTO) und DWD direkt im Browser: lit. f (Kernfunktion);
     Anbieter und Datenschutzhinweise nennen.
   - Feedback: lit. f oder b; Inhalt und Löschfrist nennen.
   - Analyse/Session-Replay (PostHog EU): siehe unten.
   - Zahlungen (Stripe, später): lit. b; Buchhaltungsdaten 6–10 Jahre
     (lit. c, § 147 AO, § 257 HGB); Stripe teils eigener Verantwortlicher.
   - Kontolöschung (Art. 17): Ablauf und was bleibt.
4. Berechtigte Interessen konkret benennen.
5. Empfänger/Auftragsverarbeiter: Vercel, Supabase, PostHog, Mail-Dienst, Stripe.
6. Drittlandübermittlung je Anbieter mit Garantie (DPF bzw. SCC).
7. Speicherdauer oder Kriterien.
8. Rechte Art. 15–20, 77; Widerruf von Einwilligungen (Art. 7 Abs. 3).
9. Widerspruchsrecht Art. 21 optisch hervorgehoben (Art. 21 Abs. 4).
10. Aufsichtsbehörde: BayLDA (Ansbach) für Bayern.
11. Pflicht zur Bereitstellung: E-Mail + Passwort für ein Konto.
12. Keine automatisierte Entscheidung (Art. 22).
13. Stand/Version.

## § 25 TDDDG und Einwilligung

- Einwilligungspflichtig: Analyse-/Replay-IDs in Cookies oder Web-Storage,
  Drittanbieter-Cookies, unnötiges Fingerprinting.
- Ohne Einwilligung: Login-Token, vom Nutzer gewählte Einstellungen
  (Sprache, Theme), Server-Logs, Kartenkacheln (Mehrheitsmeinung).
- PostHog ohne Cookies (In-Memory): **rechtlich ungeklärt** (EDPB-Leitlinien
  2/2023 weit, DSK-Orientierungshilfe 2024 enger). Session-Replay ist ein
  starker Eingriff — viele raten unabhängig von § 25 zur Einwilligung.
- **Empfehlung:** Opt-in für PostHog (insbesondere Replay) mit kurzem Banner,
  „Akzeptieren" und „Ablehnen" gleichwertig; ohne Opt-in kein PostHog-Code und
  keine Anfrage an PostHog. Widerruf so einfach wie Einwilligung
  („Datenschutz-Einstellungen" im Footer). Einwilligungsstatus speichern
  (gilt als erforderlich). Kein `identify()` vor Einwilligung.

## AVV / DSB / Dokumentation

- AVV (Art. 28) mit Vercel, Supabase, PostHog, Mail-Dienst, Stripe — online
  akzeptieren, Kopie mit Datum ablegen. Supabase-Vertragspartner: Supabase
  Pte. Ltd. (Singapur), US-Support — Übermittlungsklausel im DPA prüfen.
- Kein AVV: CARTO, DWD, Open-Meteo, Nominatim (Browser-Pfad bzw. nur
  Anfragedaten). Nutzungsbedingungen prüfen: Nominatim verlangt gültigen
  User-Agent, Open-Meteo gratis nur nicht-kommerziell.
- Verzeichnis von Verarbeitungstätigkeiten (Art. 30) und kurze TOM-Doku führen.

## Besondere Punkte

- Koordinaten/Suchbegriffe sind personenbezogen, sobald mit Konto/IP verknüpft.
- Server-Logs: IP, Zeit, URL, User-Agent, Status; Frist nennen.
- Google Fonts: LG München I, 20.01.2022, 3 O 17493/20 (100 € Schadensersatz)
  → selbst hosten (Aktenzeichen/Link ungeprüft).
- E-Mail-Bestätigung: Absender, Inhalt (Link), Löschung unbestätigter Konten.
- Mindestalter bzw. „nicht an Kinder gerichtet" angeben.

## Struktur

Kurzübersicht oben, Inhaltsverzeichnis, je Verarbeitung gleiche Unterpunkte,
klare Sprache, Anbieter mit Firma, Anschrift, Link. Deutsch verbindlich,
englische Übersetzung mit Vorrangklausel. Von jeder Seite und am
Registrierungs-/Feedbackformular erreichbar.

## Häufige Abmahngründe

Google Fonts/CDN-Ressourcen; Banner mit Vorauswahl oder verstecktem
„Ablehnen"; Tracking vor Einwilligung; fehlendes/veraltetes Impressum;
genannte Dienste stimmen nicht mit der Realität überein; keine Fristen;
Art. 21 nicht hervorgehoben; falsche Behörde; „angemessen" ohne DPF/SCC.

## DPF-Status 2026

| Anbieter | Stand | Zu nennen |
|---|---|---|
| EU-US DPF | gültig; EuG (Latombe, T-553/23) wies Klage am 03.09.2025 ab; Rechtsmittel zum EuGH seit 31.10.2025 anhängig | DPF + SCC als Rückfall |
| Vercel | laut Vercel DPF-zertifiziert (auf dataprivacyframework.gov prüfen) | DPF + SCC |
| Supabase | ungeprüft; EU-Region | DPA prüfen (vermutlich SCC) |
| PostHog | ungeprüft; EU-Cloud in Frankfurt, US-Unterauftragnehmer gelistet | DPA/Unterauftragnehmer prüfen |
| Stripe | laut Stripe DPF + SCC | DPF + SCC |
| Google (OAuth) | ungeprüft, gilt als zertifiziert | DPF, eigener Verantwortlicher |

## Quellen

- [§ 25 TDDDG](https://lxgesetze.de/tdddg/25)
- [DSK Orientierungshilfe Digitale Dienste](https://datenschutzkonferenz-online.de/media/oh/OH_Digitale_Dienste.pdf)
- [LfDI BW FAQ Cookies und Tracking](https://www.baden-wuerttemberg.datenschutz.de/wp-content/uploads/2019/04/FAQ-zu-Cookies-und-Tracking.pdf)
- [activemind zu EDSA Reichweitenmessung](https://www.activemind.legal/de/guides/edsa-reichweitenmessung/)
- [dr-datenschutz.de Webanalyse](https://www.dr-datenschutz.de/webanalyse-datenschutz-nutzerstatistiken-ohne-einwilligung/)
- [PostHog GDPR](https://posthog.com/docs/privacy/gdpr-compliance), [PostHog Unterauftragnehmer](https://posthog.com/subprocessors)
- [Supabase Transfers FAQ](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq)
- [Stripe DTA](https://stripe.com/en-se/legal/dta)
- [Vercel DPF](https://vercel.com/guides/is-vercel-certified-under-dpf)
- [Heuking zum EuG-Urteil DPF](https://www.heuking.de/de/news-events/newsletter-fachbeitraege/artikel/eug-bestaetigt-wirksamkeit-des-eu-us-data-privacy-framework.html)
- [WilmerHale zum Rechtsmittel](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework)
