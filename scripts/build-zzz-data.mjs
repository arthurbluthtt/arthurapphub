#!/usr/bin/env node
/**
 * Build script: scrapea game8.co para generar dataset estático de ZZZ.
 * Foto manual — scraper para agentes, W-Engines y Drive Disc Sets.
 *
 * Fuentes:
 *   - https://game8.co/games/Zenless-Zone-Zero/archives/435684  Agents list
 *   - https://game8.co/games/Zenless-Zone-Zero/archives/435686  W-Engines hub
 *   - Specialty W-Engines: 452796 Attack, 452798 Anomaly, 452797 Stun, 452799 Support, 452800 Defense, 523310 Rupture
 *   - Rarity: 458168 S, 458170 A, 458172 B
 *   - Drive Discs hub: 446608 (o fallback lista en build guide)
 *
 * Salida:
 *   data/zzz/agents.json     [{id, game8Id, name, specialty, attribute, rarity, icon}]
 *   data/zzz/w-engines.json  [{id, game8Id, name, specialty, rarity, icon}]
 *   data/zzz/disc-sets.json  [{id, game8Id, name, icon}]
 *
 * Uso: node scripts/build-zzz-data.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://game8.co';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const SLEEP_MS = 1200;

const AGENTS_URL = `${BASE}/games/Zenless-Zone-Zero/archives/435684`;
const WENGINES_HUB_URL = `${BASE}/games/Zenless-Zone-Zero/archives/435686`;
const WENGINES_BY_SPECIALTY = {
  attack: `${BASE}/games/Zenless-Zone-Zero/archives/452796`,
  anomaly: `${BASE}/games/Zenless-Zone-Zero/archives/452798`,
  stun: `${BASE}/games/Zenless-Zone-Zero/archives/452797`,
  support: `${BASE}/games/Zenless-Zone-Zero/archives/452799`,
  defense: `${BASE}/games/Zenless-Zone-Zero/archives/452800`,
  rupture: `${BASE}/games/Zenless-Zone-Zero/archives/523310`,
};
const DISC_HUB_URL = `${BASE}/games/Zenless-Zone-Zero/archives/446608`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return await res.text();
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseLinks(html, filter) {
  const anchorRe = /<a[^>]+href=["']?https:\/\/game8\.co\/games\/Zenless-Zone-Zero\/archives\/(\d+)["']?[^>]*>([\s\S]*?)<\/a>/g;
  const out = new Map();
  let am;
  while ((am = anchorRe.exec(html))) {
    const game8Id = am[1];
    const inner = am[2];
    const altMatch = inner.match(/alt=["']([^"']+?)["']/);
    const srcMatch = inner.match(/data-src=["'](https:\/\/[^"']+)["']/);
    if (!altMatch || !srcMatch) continue;
    const alt = altMatch[1].trim();
    const icon = srcMatch[1];
    if (!alt) continue;
    if (filter && !filter(alt, game8Id)) continue;
    let name = alt.replace(/^Zenless Zone Zero\s*-\s*/i, '').replace(/^ZZZ\s*-\s*/i, '').trim();
    name = name.replace(/\s*Icon\s*$/i, '').replace(/\s*Image\s*$/i, '').trim();
    if (!name) continue;
    if (/^Member benefits/i.test(name)) continue;
    if (!out.has(game8Id)) out.set(game8Id, { game8Id, name, icon });
  }
  return out;
}

async function main() {
  console.log('ZZZ build: fetching agents + w-engines + disc sets …');
  let agents = [];
  let wEngines = new Map();
  let discSets = new Map();

  try {
    const html = await fetchHtml(AGENTS_URL);
    await sleep(SLEEP_MS);
    const links = parseLinks(html);
    for (const [id, info] of links) {
      // heuristic: agents usually have specialty icon nearby, but just collect all and filter later
      agents.push({ id: slugify(info.name), game8Id: id, name: info.name, specialty: 'attack', attribute: null, rarity: 'S', icon: info.icon });
    }
    console.log(`Agents parsed: ${agents.length}`);
  } catch (e) {
    console.warn('Agents fetch failed:', e.message);
  }

  // Parse W-Engines from hub table with Type + Rarity columns
  try {
    const html = await fetchHtml(WENGINES_HUB_URL);
    await sleep(SLEEP_MS);
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let rowMatch;
    let parsed = 0;
    while ((rowMatch = rowRe.exec(html))) {
      const row = rowMatch[1];
      if (!row.includes('W-Engine_cell')) continue;
      const wMatch = row.match(/<td[^>]*class="W-Engine_cell[^"]*"[^>]*>[\s\S]*?href=["']?https:\/\/game8\.co\/games\/Zenless-Zone-Zero\/archives\/(\d+)["']?[^>]*>[\s\S]*?alt=["']([^"']+?)["'][\s\S]*?data-src=["']([^"']+)["']/);
      if (!wMatch) continue;
      const game8Id = wMatch[1];
      let alt = wMatch[2];
      const icon = wMatch[3];
      let name = alt.replace(/^Zenless Zone Zero\s*-\s*/i, '').trim();
      name = name.replace(/\s*Icon\s*$/i, '').trim();
      if (!name || /^Member/i.test(name)) continue;
      // Type from Type_cell
      const typeMatch = row.match(/<td[^>]*class="Type_cell[^"]*"[^>]*>[\s\S]*?>(Attack|Anomaly|Stun|Support|Defense|Rupture)/i);
      const specialtyRaw = typeMatch ? typeMatch[1].toLowerCase() : 'attack';
      const rarityMatch = row.match(/<td[^>]*class="Rarity_cell[^"]*"[^>]*>[\s\S]*?>(S Rank|A Rank|B Rank)/i);
      let rarity = 'A';
      if (rarityMatch) {
        const r = rarityMatch[1].toUpperCase();
        if (r.includes('S')) rarity = 'S';
        else if (r.includes('A')) rarity = 'A';
        else if (r.includes('B')) rarity = 'B';
      }
      if (!wEngines.has(game8Id)) {
        wEngines.set(game8Id, { id: slugify(name), game8Id, name, specialty: specialtyRaw, rarity, icon });
        parsed++;
      }
    }
    console.log(`W-Engines hub parsed: ${parsed} / total ${wEngines.size}`);
    // fallback: if hub parsed low (<30), also try specialty pages as supplements
    if (parsed < 30) {
      for (const [specialty, url] of Object.entries(WENGINES_BY_SPECIALTY)) {
        try {
          const h2 = await fetchHtml(url);
          await sleep(SLEEP_MS);
          const links = parseLinks(h2);
          let c = 0;
          for (const [gid, info] of links) {
            if (wEngines.has(gid)) continue;
            // only keep if name looks like W-Engine (skip Attack label etc)
            if (/^(Attack|Anomaly|Stun|Support|Defense|Rupture|S Rank|A Rank|B Rank)$/i.test(info.name)) continue;
            wEngines.set(gid, { id: slugify(info.name), game8Id: gid, name: info.name, specialty, rarity: 'S', icon: info.icon });
            c++;
          }
          console.log(`W-Engines ${specialty} supplement: ${c}`);
        } catch (e) {
          console.warn(`W-Engines ${specialty} failed:`, e.message);
        }
      }
    }
  } catch (e) {
    console.warn('W-Engines hub failed:', e.message);
  }

  try {
    const html = await fetchHtml(DISC_HUB_URL);
    await sleep(SLEEP_MS);
    const links = parseLinks(html);
    for (const [game8Id, info] of links) {
      discSets.set(game8Id, { id: slugify(info.name), game8Id, name: info.name, icon: info.icon });
    }
    console.log(`Disc sets: ${discSets.size}`);
  } catch (e) {
    console.warn('Disc sets failed:', e.message);
  }

  if (agents.length === 0) {
    console.warn('No agents scraped — keeping existing data/zzz/agents.json');
  } else {
    await mkdir('data/zzz', { recursive: true });
    await writeFile('data/zzz/agents.json', JSON.stringify(agents, null, 2));
  }
  if (wEngines.size > 0) {
    await mkdir('data/zzz', { recursive: true });
    await writeFile('data/zzz/w-engines.json', JSON.stringify([...wEngines.values()], null, 2));
  }
  if (discSets.size > 0) {
    await mkdir('data/zzz', { recursive: true });
    await writeFile('data/zzz/disc-sets.json', JSON.stringify([...discSets.values()], null, 2));
  }
  console.log(`Done. Agents ${agents.length} | W-Engines ${wEngines.size} | DiscSets ${discSets.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
