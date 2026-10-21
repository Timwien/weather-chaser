#!/usr/bin/env node
// Builds apps/web/api/_data/places.json from GeoNames dumps (CC BY 4.0, geonames.org).
//
// Usage:
//   node scripts/build-places.mjs <cities1000.txt> <alternateNamesV2.txt> [out.json] [--min-pop-far=2000]
//
// Inputs are the extracted text files of
//   https://download.geonames.org/export/dump/cities1000.zip
//   https://download.geonames.org/export/dump/alternateNamesV2.zip
// The alternate-names file is ~800 MB and is streamed line by line.
//
// Output: JSON array of tuples
//   [geonameId, name, lat, lng, population, nameDe|0, nameEn|0]
// lat/lng are rounded to 4 decimals; nameDe/nameEn are only stored when they
// differ from the base name (0 otherwise).

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
const [citiesPath, altPath, outArg] = args;
if (!citiesPath || !altPath) {
  console.error('usage: build-places.mjs <cities1000.txt> <alternateNamesV2.txt> [out.json] [--min-pop-far=N]');
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
  places.set(c[0], { name: c[1], ascii: c[2], lat, lng, pop, de: null, en: null, deRank: -1, enRank: -1 });
}
console.error(`cities in region: ${places.size}`);

// 2. Localized names. Rank: preferred (2) > first plain name (1). Skip short/colloquial/historic.
for await (const line of lines(altPath)) {
  const c = line.split('\t');
  const lang = c[2];
  if (lang !== 'de' && lang !== 'en') continue;
  const p = places.get(c[1]);
  if (!p) continue;
  const [, , , name, preferred, short, colloquial, historic] = c;
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

// 3. Emit
const rows = [...places.entries()].map(([id, p]) => [
  Number(id),
  p.name,
  Math.round(p.lat * 1e4) / 1e4,
  Math.round(p.lng * 1e4) / 1e4,
  p.pop,
  p.de && p.de !== p.name ? p.de : 0,
  p.en && p.en !== p.name ? p.en : 0,
]);
rows.sort((a, b) => b[4] - a[4]);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(rows));
const size = fs.statSync(outPath).size;
console.error(`wrote ${rows.length} places, ${(size / 1e6).toFixed(2)} MB -> ${outPath}`);
