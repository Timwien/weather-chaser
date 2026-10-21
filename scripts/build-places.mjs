#!/usr/bin/env node
// Builds apps/web/api/_data/places.json from GeoNames dumps (CC BY 4.0, geonames.org).
//
// Usage:
//   node scripts/build-places.mjs <cities1000.txt> <alternateNamesV2.txt> <admin1CodesASCII.txt> [out.json] [--min-pop-far=2000]
//
// Inputs are the extracted text files of
//   https://download.geonames.org/export/dump/cities1000.zip
//   https://download.geonames.org/export/dump/alternateNamesV2.zip
//   https://download.geonames.org/export/dump/admin1CodesASCII.txt   (region names)
// The alternate-names file is ~800 MB and is streamed line by line.
//
// Output: { "regions": [[nameEn, nameDe|0], ...], "places": [tuple, ...] } with
//   tuple = [geonameId, name, lat, lng, population, nameDe|0, nameEn|0, countryCode, regionIdx]
// lat/lng are rounded to 4 decimals; nameDe/nameEn are only stored when they
// differ from the base name (0 otherwise). regionIdx is 1-based into "regions"
// (admin1: Bundesland, county, ...), 0 = unknown — keeps the file small and lets the
// API show "Neustadt - Rheinland-Pfalz, DE" in the UI language.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const [citiesPath, altPath, admin1Path, outArg] = args;
if (!citiesPath || !altPath || !admin1Path) {
  console.error('usage: build-places.mjs <cities1000.txt> <alternateNamesV2.txt> <admin1CodesASCII.txt> [out.json] [--min-pop-far=N]');
  process.exit(1);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = outArg ?? path.resolve(here, '../apps/web/api/_data/places.json');

// Same region the former bundled fallback covered: Europe incl. Turkey / Maghreb coast.
const BBOX = { south: 34.0, north: 70.0, west: -22.7, east: 45.0 };
// Optional size valve: outside these countries require a higher population.
const CORE = new Set(['DE', 'AT', 'CH', 'IT', 'FR', 'ES', 'PT', 'NL', 'BE', 'LU', 'DK']);
const minPopFar = Number(flags['min-pop-far'] ?? 0);

async function* lines(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

// 0. Admin1 regions: "DE.08" -> { en, de, geonameId }
const admin1 = new Map();
const admin1ById = new Map(); // geonameId -> admin1 entry (to attach German names below)
for await (const line of lines(admin1Path)) {
  const c = line.split('\t');
  if (c.length < 4) continue;
  // `name` is UTF-8 where GeoNames has one, but for many regions it equals the ASCII name
  // ("Baden-Wurttemberg"); `diacritic` collects votes for the real spelling from alternate names (step 2).
  const entry = { en: c[1], de: null, deRank: -1, diacritic: new Map() };
  admin1.set(c[0], entry);
  admin1ById.set(c[3], entry);
}

// 1. Cities
const places = new Map(); // id -> { name, lat, lng, pop }
for await (const line of lines(citiesPath)) {
  const c = line.split('\t');
  if (c.length < 15) continue;
  const lat = Number(c[4]);
  const lng = Number(c[5]);
  const pop = Number(c[14]) || 0;
  // PPLX = section of a populated place (city districts like Berlin-Marzahn): same weather as the city
  if (c[7] === 'PPLX') continue;
  if (lat < BBOX.south || lat > BBOX.north || lng < BBOX.west || lng > BBOX.east) continue;
  if (minPopFar > 0 && !CORE.has(c[8]) && pop < minPopFar) continue;
  places.set(c[0], { name: c[1], ascii: c[2], lat, lng, pop, cc: c[8], a1: `${c[8]}.${c[10]}`, de: null, en: null, deRank: -1, enRank: -1 });
}
console.error(`cities in region: ${places.size}`);

// 2. Localized names. Rank: preferred (2) > first plain name (1). Skip short/colloquial/historic.
const MIN_DIACRITIC_VOTES = 7;
const fold = (v) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
for await (const line of lines(altPath)) {
  const c = line.split('\t');
  const lang = c[2];
  // Region spelling with diacritics: any language's alternate name that folds to the ASCII name.
  const regionForDiacritics = admin1ById.get(c[1]);
  if (regionForDiacritics && c[3] && /[^\x00-\x7f]/.test(c[3]) && c[3] !== regionForDiacritics.en
      && fold(c[3]).toLowerCase() === fold(regionForDiacritics.en).toLowerCase()) {
    regionForDiacritics.diacritic.set(c[3], (regionForDiacritics.diacritic.get(c[3]) ?? 0) + 1);
  }
  if (lang !== 'de' && lang !== 'en') continue;
  const [, , , name, preferred, short, colloquial, historic] = c;
  const region = admin1ById.get(c[1]);
  // Regions: a *short* preferred name is the common one (Bayern, Niedersachsen), unlike for cities.
  if (region && lang === 'de' && name && colloquial !== '1' && historic !== '1') {
    const r = preferred === '1' ? (short === '1' ? 3 : 2) : 1;
    if (r > region.deRank) { region.de = name; region.deRank = r; }
  }
  const p = places.get(c[1]);
  if (!p) continue;
  if (!name || short === '1' || colloquial === '1' || historic === '1') continue;
  const rank = preferred === '1' ? 2 : 1;
  // A plain-ASCII transliteration (Poznan for Poznań) is no real exonym.
  if (name === p.ascii && name !== p.name) continue;
  const key = lang === 'de' ? 'de' : 'en';
  if (rank > p[`${key}Rank`]) {
    p[key] = name;
    p[`${key}Rank`] = rank;
  }
}

// 3. Emit — only regions actually used, deduped by (en, de)
const regionIdx = new Map(); // "en|de" -> 1-based index
const regions = [];
function regionIndex(code) {
  const a = admin1.get(code);
  if (!a) return 0;
  if (!a.fixed) {
    a.fixed = true;
    if (/^[\x00-\x7f]*$/.test(a.en) && a.diacritic.size > 0) {
      // Needs real consensus across languages — single-language variants (Catalan "Sòfia") are noise.
      const [best, votes] = [...a.diacritic.entries()].sort((x, y) => y[1] - x[1])[0];
      if (votes >= MIN_DIACRITIC_VOTES) a.en = best;
    }
  }
  const de = a.de && a.de !== a.en ? a.de : 0;
  const key = `${a.en}|${de}`;
  if (!regionIdx.has(key)) { regions.push([a.en, de]); regionIdx.set(key, regions.length); }
  return regionIdx.get(key);
}
const rows = [...places.entries()].map(([id, p]) => [
  Number(id),
  p.name,
  Math.round(p.lat * 1e4) / 1e4,
  Math.round(p.lng * 1e4) / 1e4,
  p.pop,
  p.de && p.de !== p.name ? p.de : 0,
  p.en && p.en !== p.name ? p.en : 0,
  p.cc,
  regionIndex(p.a1),
]);
rows.sort((a, b) => b[4] - a[4]);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ regions, places: rows }));
const size = fs.statSync(outPath).size;
console.error(`wrote ${rows.length} places, ${(size / 1e6).toFixed(2)} MB -> ${outPath}`);
