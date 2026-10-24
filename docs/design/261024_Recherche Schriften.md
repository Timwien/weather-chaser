# Recherche: „KI-Schriften" und Alternativen (Stand 24.10.2026)

Quelle: Recherche-Agent mit Websuche. Es gibt keine harte Nutzungsstudie;
Belege sind Anthropics eigene Prompt-Empfehlungen, Designer-Kommentare und
Hacker-News-Beobachtungen. Kernbefund: Schriften, die in verbreiteten
KI-Prompts empfohlen werden, tauchen dadurch überall auf.

## Meiden

| Schrift | Grund |
|---|---|
| Inter | Standard-Look der Modelle (Claude Cookbook nennt es ausdrücklich) |
| Space Grotesk | Modelle „konvergieren" laut Cookbook darauf |
| Instrument Serif (+ JetBrains Mono) | Standard-Serif vibe-codierter Seiten |
| JetBrains Mono | auf HN als „starkes Erkennungszeichen" genannt |
| Fraunces, Newsreader, Playfair Display | im Cookbook als „editorial/distinctive" empfohlen |
| Clash Display, Satoshi, Cabinet Grotesk | „Startup-Trio" aus dem Cookbook |
| IBM Plex, Source Sans 3 | „technische" Empfehlung im Cookbook |
| Bricolage Grotesque | „distinctive"-Empfehlung, daher verbreitet |
| Roboto, Open Sans, Lato, Arial, System-UI | „nie verwenden" im Cookbook (System-Schrift auf iOS ist trotzdem echt nativ — Abwägung) |
| Geist, Geist Mono | v0-/shadcn-Standard (Beobachtung, ohne Quelle) |
| DM Sans/Serif, Manrope, Outfit, Plus Jakarta Sans, Sora, Poppins, General Sans, Lora | Template-Pool (Beobachtung) — Plus Jakarta Sans und Sora nutzt die App heute |

## Alternativen (alle OFL-1.1, auf Fontsource, mit Umlauten/ß; tnum geprüft)

| Schrift | Rolle | Paket | tnum | Charakter |
|---|---|---|---|---|
| Big Shoulders Display | Display | `big-shoulders-display` (var) | nein | schmale Schilder-/Plakat-Überschriften |
| Overpass | UI, Zahlen | `overpass` (var) | ja | nach Highway Gothic, Straßenschild |
| Sofia Sans Condensed | Labels | `sofia-sans-condensed` (var) | ja | platzsparend für Karte/Chips |
| Young Serif | Display | `young-serif` | ja | warme 70er-Nationalpark-Serif, nur 400 |
| Caprasimo | Logo/Hero | `caprasimo` | nein | verspielt, Cooper-artig |
| Zilla Slab | Überschriften | `zilla-slab` | ja | robuste Slab, Wegmarke |
| Schibsted Grotesk | UI/Text | `schibsted-grotesk` (var) | ja | charaktervolle Grotesk, Inter-Ersatz |
| Familjen Grotesk | UI/Text | `familjen-grotesk` (var) | ja | leicht eigenwillig |
| Atkinson Hyperlegible Next | Text, Zahlen | `atkinson-hyperlegible-next` (var) | ja | sehr gut lesbar klein |
| Shantell Sans | Akzente | `shantell-sans` (var) | ja | Marker-Handschrift, „Bounce" |
| Patrick Hand | Notizen | `patrick-hand` | nein | Feldbuch-Notizen, nur kurz |
| Martian Mono | Zahlen | `martian-mono` (var) | ja | Koordinaten/Messwerte, breit |

## Paarungen

1. **Wegweiser:** Big Shoulders Display + Overpass (+ Overpass tnum).
2. **Nationalpark-Poster:** Young Serif (Logo: Caprasimo) + Schibsted Grotesk (tnum).
3. **Feldbuch:** Shantell Sans (Akzente) + Atkinson Hyperlegible Next + Patrick Hand (Kartennotizen).
4. **Topokarte:** Zilla Slab + Familjen Grotesk + Martian Mono.

Fontshare-Schriften bewusst nicht empfohlen (Lizenz für Selbst-Hosting
widersprüchlich belegt; teils ohnehin auf der Meiden-Liste).

## Quellen

- [Claude Cookbook: Prompting for frontend aesthetics](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)
- [Claude Blog: Improving frontend design through skills](https://claude.com/resources/articles/improving-frontend-design-through-skills)
- [Vadgama: The serif renaissance in AI branding](https://keyavadgama.substack.com/p/the-serif-renaissance-in-ai-branding)
- [UGA-Zusammenfassung des WIRED-Artikels](https://agtechdata.uga.edu/ai-has-come-for-serif-fonts/)
- [Hacker News Thread](https://news.ycombinator.com/item?id=47177336)
- [superdesign: Lovable vs Bolt](https://superdesign.dev/blog/lovable-vs-bolt)
- Fontsource: https://fontsource.org/fonts/
