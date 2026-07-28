import weaponsIndex from '../../../data/d2/weapons-index.json';
import perksRaw from '../../../data/d2/perks.json';

export interface WeaponIndexEntry {
  hash: string;
  name: string;
  icon: string;
  damage: string;
  tier: 'exotic' | 'legendary';
  perkPoolHashes: string[];
  mainPerkHashes: string[];
}

export interface PerkEntry {
  name: string;
  icon: string;
  description: string;
}

const weapons = weaponsIndex as WeaponIndexEntry[];
const perks = perksRaw as Record<string, PerkEntry>;

const weaponsByHash = new Map<string, WeaponIndexEntry>(
  weapons.map((w) => [w.hash, w])
);

export function listWeapons(): WeaponIndexEntry[] {
  return weapons;
}

export function getWeapon(hash: string): WeaponIndexEntry | null {
  return weaponsByHash.get(hash) ?? null;
}

export function getPerk(hash: string): PerkEntry | null {
  return perks[hash] ?? null;
}

export function searchWeapons(query: string, limit = 10): WeaponIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches: { weapon: WeaponIndexEntry; score: number }[] = [];
  for (const w of weapons) {
    const name = w.name.toLowerCase();
    const idx = name.indexOf(q);
    if (idx === -1) continue;
    const score = idx === 0 ? 0 : idx;
    matches.push({ weapon: w, score });
  }
  matches.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.weapon.name.localeCompare(b.weapon.name);
  });
  return matches.slice(0, limit).map((m) => m.weapon);
}

export function bungieCdnUrl(iconPath: string | undefined | null): string | null {
  if (!iconPath) return null;
  return `https://www.bungie.net${iconPath}`;
}
