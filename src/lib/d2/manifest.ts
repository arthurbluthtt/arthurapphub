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
  category: string;
}

export const PERK_CATEGORIES = {
  barrel: 'Barrel',
  magazine: 'Magazine',
  trait: 'Trait',
} as const;

export type PerkCategoryKey = keyof typeof PERK_CATEGORIES;
export type PerkCategoryValue = (typeof PERK_CATEGORIES)[PerkCategoryKey];

export const PERK_CATEGORY_ORDER: PerkCategoryKey[] = ['barrel', 'magazine', 'trait'];

const NOISE_NAME_PATTERN =
  /\b(frame|shader|mod socket|masterwork|kill tracker|ornament|memento|tier \d|restore defaults|empty mod|set\s?bonus)\b/i;
const BARREL_NAME_PATTERN =
  /\b(barrel|sights?|scope|launcher|bolt|chamber|arrow|nose|guard|muzzle|hatch|wire|coil|hammer|crown|tooth|talon)\b/i;
const MAGAZINE_NAME_PATTERN =
  /\b(mag(azine)?|rounds|cartridge|battery|projectile|composite|cone|paq)\b/i;

const weapons = weaponsIndex as WeaponIndexEntry[];
const perks = perksRaw as unknown as Record<string, PerkEntry>;

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

export function searchWeapons(query: string): WeaponIndexEntry | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  let best: { weapon: WeaponIndexEntry; score: number } | null = null;
  for (const w of weapons) {
    const name = w.name.toLowerCase();
    if (name === q) return w;
    if (name.startsWith(q)) {
      const candidate = { weapon: w, score: 1 };
      if (!best || candidate.score < best.score) best = candidate;
      else if (candidate.score === best.score && w.name.localeCompare(best.weapon.name) < 0) {
        best = candidate;
      }
      continue;
    }
    const idx = name.indexOf(q);
    if (idx === -1) continue;
    const candidate = { weapon: w, score: idx + 2 };
    if (!best || candidate.score < best.score) best = candidate;
    else if (candidate.score === best.score && w.name.localeCompare(best.weapon.name) < 0) {
      best = candidate;
    }
  }
  return best?.weapon ?? null;
}

export function bungieCdnUrl(iconPath: string | undefined | null): string | null {
  if (!iconPath) return null;
  return `https://www.bungie.net${iconPath}`;
}

export interface PerkWithMeta extends PerkEntry {
  hash: string;
  categoryKey: PerkCategoryKey;
}

function isEligibleCategory(category: string): boolean {
  const values = Object.values(PERK_CATEGORIES) as string[];
  return values.includes(category);
}

function guessCategoryFromName(name: string): PerkCategoryKey {
  if (BARREL_NAME_PATTERN.test(name)) return 'barrel';
  if (MAGAZINE_NAME_PATTERN.test(name)) return 'magazine';
  return 'trait';
}

function isNoise(name: string): boolean {
  return NOISE_NAME_PATTERN.test(name);
}

export function classifyPerk(perk: PerkEntry): PerkCategoryKey | null {
  if (perk.category && isEligibleCategory(perk.category)) {
    for (const key of PERK_CATEGORY_ORDER) {
      if (PERK_CATEGORIES[key] === perk.category) return key;
    }
  }
  if (isNoise(perk.name)) return null;
  if (!perk.name) return null;
  return guessCategoryFromName(perk.name);
}

export function listEligiblePerksForWeapon(
  weapon: WeaponIndexEntry
): PerkWithMeta[] {
  const seen = new Set<string>();
  const result: PerkWithMeta[] = [];
  for (const hash of weapon.perkPoolHashes) {
    if (seen.has(hash)) continue;
    seen.add(hash);
    const perk = perks[hash];
    if (!perk) continue;
    const categoryKey = classifyPerk(perk);
    if (!categoryKey) continue;
    result.push({ ...perk, hash, categoryKey });
  }
  result.sort((a, b) => {
    const ai = PERK_CATEGORY_ORDER.indexOf(a.categoryKey);
    const bi = PERK_CATEGORY_ORDER.indexOf(b.categoryKey);
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
  return result;
}

export function getEligiblePerk(hash: string): PerkWithMeta | null {
  const perk = perks[hash];
  if (!perk) return null;
  const categoryKey = classifyPerk(perk);
  if (!categoryKey) return null;
  return { ...perk, hash, categoryKey };
}

export function searchPerksInPool(
  pool: PerkWithMeta[],
  query: string,
  limit = 8
): PerkWithMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches: { perk: PerkWithMeta; score: number }[] = [];
  for (const p of pool) {
    const name = p.name.toLowerCase();
    if (name === q) return [p];
    if (name.startsWith(q)) {
      matches.push({ perk: p, score: 1 });
      continue;
    }
    const idx = name.indexOf(q);
    if (idx === -1) continue;
    matches.push({ perk: p, score: idx + 2 });
  }
  matches.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.perk.name.localeCompare(b.perk.name);
  });
  return matches.slice(0, limit).map((m) => m.perk);
}
