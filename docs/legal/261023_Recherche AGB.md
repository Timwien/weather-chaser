# Recherche AGB / Verbraucherrecht (Stand 23.10.2026)

Quelle: Recherche-Agent mit Websuche. Keine Rechtsberatung; vor dem
kostenpflichtigen Start anwaltlich oder per geprüftem Generator (z. B.
IT-Recht Kanzlei, Händlerbund) gegenprüfen. Teils nur Sekundärquellen.

## 1. Gliederung der AGB

1. Geltungsbereich, Anbieter (Name, Anschrift, E-Mail); richtet sich an
   Verbraucher (§ 13 BGB).
2. Leistungsbeschreibung: kostenloses Konto, Premium-Funktionen, Daten von
   Dritten (DWD, Open-Meteo, OSM — Attributionen, ODbL).
3. Vertragsschluss: kostenlos durch Registrierung; kostenpflichtig durch Klick
   auf „zahlungspflichtig bestellen". AGB speicher-/druckbar (§ 312i).
4. Kostenlose Beta: kann sich ändern oder enden; spätere Bezahlfunktionen
   möglich, aber keine stille Umwandlung. Kein Verlass auf ein
   Haftungsprivileg (Leihe/Schenkung) — wegen §§ 327 ff. (Daten als
   Gegenleistung) ungeklärt; normale Haftungsklausel verwenden.
5. Preise/Zahlung: Endpreise inkl. USt (PAngV), Abrechnungsintervall, Stripe;
   ggf. Hinweis § 19 UStG (Kleinunternehmer).
6. Laufzeit/Kündigung (§ 309 Nr. 9): Erstlaufzeit max. 2 Jahre;
   Verlängerung nur auf unbestimmte Zeit mit max. 1 Monat Kündigungsfrist;
   § 314; Kündigung im Konto bzw. per Kündigungsbutton (§ 312k).
7. Widerrufsrecht: Verweis auf gesonderte Widerrufsbelehrung.
8. Änderungen digitaler Produkte (§ 327r) nur mit Grund, kostenfrei, mit
   Ankündigung; bei erheblicher Verschlechterung Kündigungsrecht.
   Preis-/AGB-Änderungen nur mit aktiver Zustimmung (BGH XI ZR 26/20 —
   Zustimmungsfiktion unwirksam).
9. Verfügbarkeit/Wartung: keine 100 %; Aktualisierungspflichten
   (§§ 327e, 327f) nicht abdingbar.
10. Hinweis: Vorhersagen/Routen ohne Gewähr; Warnungen, Straßenzustand,
    Stellplatz-/Fahrverbote selbst prüfen; nicht für Sicherheitsentscheidungen.
11. Haftung (§§ 309 Nr. 7, 307, 276 Abs. 3): unbeschränkt bei Leben, Körper,
    Gesundheit, Vorsatz, grober Fahrlässigkeit, ProdHaftG; leichte
    Fahrlässigkeit nur bei Kardinalpflichten, begrenzt auf vorhersehbaren
    typischen Schaden.
12. Nutzerpflichten/Konto: kein Missbrauch, kein Scraping; Sperre/Kündigung
    aus wichtigem Grund; kostenloses Konto ordentlich kündbar.
13. Nutzerinhalte/Feedback: einfache, kostenlose Lizenz nur zum Betrieb.
14. Recht/Gerichtsstand: deutsches Recht ohne Entzug zwingender
    Verbraucherschutzvorschriften (Rom I Art. 6 Abs. 2); keine
    Gerichtsstandsklausel gegenüber Verbrauchern.
15. Streitbeilegung (§ 36 VSBG): OS-Plattform am 20.07.2025 eingestellt → kein
    Link mehr; Erklärung „nicht bereit und nicht verpflichtet" (unter 10
    Beschäftigte).
16. Salvatorische Klausel nur als Höflichkeit; nichts Überraschendes (§ 305c).

## 2. Widerrufsbelehrung (bezahltes Abo)

- Muster-Widerrufsbelehrung (Anlage 1 zu Art. 246a § 1 Abs. 2 EGBGB) für
  Dienstleistungen + Muster-Widerrufsformular (Anlage 2); 14 Tage ab
  Vertragsschluss.
- Erlöschen (§ 356 Abs. 4) erst bei vollständiger Erfüllung — ein Abo ist
  innerhalb von 14 Tagen nie vollständig erfüllt. Bei sofortigem Beginn auf
  ausdrücklichen Wunsch schuldet der Verbraucher bei Widerruf anteiligen
  Wertersatz (§ 357a Abs. 2), wenn vorher darüber informiert.
- Checkbox an der Kasse (nicht vorausgewählt, mit Zeitstempel speichern):
  „Ich verlange ausdrücklich, dass [Name] vor Ablauf der Widerrufsfrist mit
  der Ausführung des Vertrags beginnt. Mir ist bekannt, dass ich bei
  vollständiger Vertragserfüllung mein Widerrufsrecht verliere und dass ich
  bei Widerruf nach Beginn der Leistung Wertersatz für die bis dahin
  erbrachte Leistung schulde."
- Ungeklärt: Erlöschen bei Abos; nicht behaupten, das Recht erlösche mit Beginn.

## 3. Pflichten außerhalb der AGB (Oberfläche)

- Button-Lösung (§ 312j): Schaltfläche „zahlungspflichtig bestellen" (oder
  gleich klar); unmittelbar davor wesentliche Merkmale, Gesamtpreis inkl.
  USt und Intervall, Mindestlaufzeit, Verlängerung, Zusatzkosten; keine
  Vorauswahl (§ 312a Abs. 3). Stripe-Checkout-Texte entsprechend prüfen.
- Kündigungsbutton (§ 312k): gut sichtbarer, dauerhaft erreichbarer Link
  „Verträge hier kündigen" → Bestätigungsseite ohne Login-Hürde (LG München I,
  10.10.2023, 33 O 15098/22), nur nötige Angaben, Schaltfläche „jetzt
  kündigen", sofortige Eingangsbestätigung per E-Mail mit Datum/Uhrzeit.
  Laut Sekundärquellen BGH I ZR 200/25 (16.07.2026): keine Alternativen
  (Rabatt, Pause) auf der Bestätigungsseite — verifizieren. Eigenen Ablauf
  über die Stripe-API statt Customer Portal bauen (sicherer).
- Vertragsbestätigung (§ 312f) per E-Mail mit AGB, Widerrufsbelehrung,
  Formular.
- Vorvertragliche Informationen (Art. 246a EGBGB) vor der Bestellung.
- Preisangaben: Endpreise inkl. USt, bei Jahresabo auch Jahressumme.

## 4. Beta vs. kostenpflichtiger Start

- **Beta (jetzt):** kurze Nutzungsbedingungen (ohne Gewähr, Haftungsklausel,
  Beta kann sich ändern/enden, keine Zahlungen), Impressum,
  Datenschutzerklärung, § 36-VSBG-Erklärung, Kontolöschung.
- **Vor der ersten Zahlung:** vollständige AGB (Laufzeit nach § 309 Nr. 9),
  Widerrufsbelehrung + Formular + Checkbox, Button-Lösung + Pflichtinfos,
  Kündigungsbutton + Bestätigungen, Vertragsbestätigung per E-Mail,
  Preisangaben inkl. USt bzw. § 19-UStG-Hinweis, neue AGB für Bestandsnutzer
  nur mit aktiver Zustimmung.

## Quellen

- [§ 309 BGB](https://www.gesetze-im-internet.de/bgb/__309.html)
- [IHK Köln: Gesetz für faire Verbraucherverträge](https://www.ihk.de/koeln/hauptnavigation/recht-steuern/faire-verbrauchervertraege-5329466)
- [CMS: Kündigungsbutton](https://cms.law/de/deu/legal-updates/kuendigungsbutton-gerichte-praezisieren-anforderungen)
- [LG München I, 33 O 15098/22](https://www.gesetze-bayern.de/Content/Rtf/Y-300-Z-GRURRS-B-2023-N-36681?all=False)
- [Rechtslupe: keine Kündigungsalternativen auf der Bestätigungsseite](https://www.rechtslupe.de/wirtschaftsrecht/online-kuendigung-und-keine-kuendigungsalternativen-auf-der-bestaetigungsseite-3353458)
- [IT-Recht Kanzlei: Widerrufsrecht digitale Inhalte/Dienstleistungen](https://www.it-recht-kanzlei.de/widerrufsrecht-digitale-inhalte-dienstleistungen-2022.html)
- [Heuking: Widerrufsbelehrungen digital](https://www.heuking.de/de/news-events/newsletter-fachbeitraege/artikel/vorsicht-bei-widerrufsbelehrungen-bei-digitalen-inhalten-und-dienstleistungen.html)
- [IHK Regensburg: Verbraucherstreitbeilegung](https://www.ihk.de/regensburg/fachthemen/recht/schlichtung/verbraucherstreitbeilegung-3357872)
- [IHK Bodensee-Oberschwaben: OS-Plattform eingestellt](https://www.ihk.de/bodensee-oberschwaben/recht/news/os-plattform-zur-streitbeilegung-wird-eingestellt-6512866)
