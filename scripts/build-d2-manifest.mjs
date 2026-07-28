#!/usr/bin/env node
/**
 * Build script: descarga el Destiny 2 Manifest desde la API oficial de Bungie,
 * filtra a armas legendarias/exóticas con perks random-rollable y perks de sandbox,
 * y emite los archivos JSON que consume el hub.
 *
 * Prereq:
 *   - BUNGIE_API_KEY (obtenida gratis en https://www.bungie.net/en/Application)
 *
 * Uso:
 *   BUNGIE_API_KEY=<key> npm run build:d2-manifest
 *
 * Output:
 *   data/d2/weapons-index.json   array con { hash, name, icon, tier, damage, perkPoolHashes }
 *   data/d2/perks.json           { hash: { name, icon } } lookup
 */

import { mkdir, writeFile } from 'node:fs/promises';

const API_KEY = process.env.BUNGIE_API_KEY;
if (!API_KEY) {
  console.error('Error: BUNGIE_API_KEY no está definida en el entorno.');
  console.error('Conseguí una gratis en https://www.bungie.net/en/Application');
  process.exit(1);
}

const HEADERS = { 'X-API-Key': API_KEY };
const API_BASE = 'https://www.bungie.net/Platform';
const CDN_BASE = 'https://www.bungie.net';

const DAMAGE_TYPES = {
  1: 'kinetic',
  2: 'arc',
  3: 'solar',
  4: 'void',
  6: 'stasis',
  7: 'strand',
};

// itemType (Destiny item type enum)
// 3 = Weapon
// 19 = Mod (incluye barrels, mags, perks — todo lo random-rollable)
const ITEM_TYPE_WEAPON = 3;
const ITEM_TYPE_MOD = 19;

async function getApiJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Bungie ${path} → ${res.status}`);
  const body = await res.json();
  return body.Response;
}

async function getCdnJson(path) {
  const res = await fetch(`${CDN_BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Bungie ${path} → ${res.status}`);
  return await res.json();
}

// Socket type hashes que corresponden a columnas de perks de arma (trait 3 y trait 4).
// 1215804697 = perk column 3 (regular trait)
// 1215804696 = perk column 4 (regular trait)
// 514622187  = exotic trait column 4 (Ace of Spades, etc.)
const KNOWN_PERK_SOCKET_HASHES = new Set([1215804697, 1215804696, 514622187]);

// Socket types que NO queremos como fallback (no son perks random-rolleables).
// 3956125808 = Intrinsic (frame del arma)
// 1288200359 = Shader
const EXCLUDED_SOCKET_TYPES = new Set([3956125808, 1288200359]);

function pickWeapon(item) {
  if (item.itemType !== ITEM_TYPE_WEAPON) return null;
  if (item.redacted) return null;
  if (!item.displayProperties?.name) return null;

  const tier = item.inventory?.tierType;
  if (tier !== 5 && tier !== 6) return null;

  const sockets = item.sockets?.socketEntries ?? [];
  // Coleccionamos singleInitialItemHash de cada socket que tenga uno.
  // Bungie usa 0 como placeholder para sockets vacíos — los descartamos.
  const perkPoolHashes = sockets
    .map((s) => (typeof s.singleInitialItemHash === 'number' && s.singleInitialItemHash > 0 ? String(s.singleInitialItemHash) : null))
    .filter(Boolean);

  if (perkPoolHashes.length < 2) return null;

  // Identificamos los perks principales (trait 3 y trait 4) por socket type hash.
  // Usamos los hashes conocidos porque filtrar por socketCategoryHash no funciona
  // (barrels, mags y perks están todos bajo "WEAPON PERKS").
  const isValidHash = (h) => typeof h === 'number' && h > 0;
  const perkSocketHashes = sockets
    .filter((s) => KNOWN_PERK_SOCKET_HASHES.has(s.socketTypeHash))
    .map((s) => (isValidHash(s.singleInitialItemHash) ? String(s.singleInitialItemHash) : null))
    .filter(Boolean);

  // Para el fallback (armas con perk sockets vacíos / legacy data), elegimos
  // sockets que NO sean intrinsic ni shader para evitar mostrar el frame del arma
  // o el Default Shader como si fueran perks.
  const fallbackCandidates = sockets
    .filter((s) => !EXCLUDED_SOCKET_TYPES.has(s.socketTypeHash) && isValidHash(s.singleInitialItemHash))
    .map((s) => String(s.singleInitialItemHash));

  let mainPerkHashes;
  if (perkSocketHashes.length >= 2) {
    mainPerkHashes = perkSocketHashes.slice(0, 2);
  } else if (perkSocketHashes.length === 1) {
    const second = fallbackCandidates.find((h) => h !== perkSocketHashes[0]);
    mainPerkHashes = second ? [perkSocketHashes[0], second] : [];
  } else {
    // Si no encontramos ningún perk socket, NO mostramos mod/masterwork como perks.
    // Devolvemos array vacío; resolveWeapon en runtime devolverá null y el usuario
    // no podrá agregar esta arma (debería poblar top-picks.json manualmente).
    mainPerkHashes = [];
  }

  return {
    hash: String(item.hash),
    name: item.displayProperties.name,
    icon: item.displayProperties.icon ?? '',
    damage: DAMAGE_TYPES[item.defaultDamageType] ?? 'kinetic',
    tier: tier === 6 ? 'exotic' : 'legendary',
    perkPoolHashes,
    mainPerkHashes,
  };
}

function pickPerk(item) {
  if (item.itemType !== ITEM_TYPE_MOD) return null;
  if (!item.displayProperties?.name) return null;
  return {
    name: item.displayProperties.name,
    icon: item.displayProperties.icon ?? '',
    description: item.displayProperties.description ?? '',
  };
}

async function build() {
  console.log('Fetching manifest index...');
  const manifest = await getApiJson('/Destiny2/Manifest/');

  const invPath =
    manifest.jsonWorldComponentContentPaths?.en?.DestinyInventoryItemDefinition ??
    manifest.jsonWorldComponentPaths?.en?.DestinyInventoryItemDefinition;
  if (!invPath) {
    throw new Error(
      'Manifest index no incluye DestinyInventoryItemDefinition (¿cambió el schema de Bungie?).'
    );
  }

  console.log(`Fetching inventory items (${invPath})...`);
  const inventory = await getCdnJson(invPath);
  console.log(`  → ${Object.keys(inventory).length} items totales.`);

  // Pasada 1: armas.
  const weapons = [];
  const allPerkHashes = new Set();
  for (const [, item] of Object.entries(inventory)) {
    const w = pickWeapon(item);
    if (w) {
      weapons.push(w);
      w.perkPoolHashes.forEach((h) => allPerkHashes.add(h));
    }
  }
  console.log(`  → ${weapons.length} armas filtradas (legendary/exotic con perks).`);
  console.log(`  → ${allPerkHashes.size} perks únicos referenciados.`);

  // Pasada 2: perks (mods random-rolleables: barrels, mags, perks).
  const perks = {};
  let perkCount = 0;
  for (const hash of allPerkHashes) {
    const item = inventory[hash];
    if (!item) continue;
    const def = pickPerk(item);
    if (!def) continue;
    perks[hash] = def;
    perkCount++;
  }
  console.log(`  → ${perkCount} perks con nombre resueltos.`);

  // Emisión.
  const weaponsIndex = weapons.map((w) => ({
    hash: w.hash,
    name: w.name,
    icon: w.icon,
    damage: w.damage,
    tier: w.tier,
    perkPoolHashes: w.perkPoolHashes,
    mainPerkHashes: w.mainPerkHashes,
  }));

  await mkdir('data/d2', { recursive: true });
  await writeFile('data/d2/weapons-index.json', JSON.stringify(weaponsIndex));
  await writeFile('data/d2/perks.json', JSON.stringify(perks));

  console.log(`\nWrote data/d2/weapons-index.json (${weaponsIndex.length} entries)`);
  console.log(`Wrote data/d2/perks.json (${Object.keys(perks).length} entries)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
