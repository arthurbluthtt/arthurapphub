import weaponsIndex from '../../../data/d2/weapons-index.json';
import perksRaw from '../../../data/d2/perks.json';

export interface WeaponIndexEntry {
  hash: string;
  name: string;
  icon: string;
  damage: string;
  tier: 'exotic' | 'legendary';
  weaponType?: string;
  perkPoolHashes: string[];
  mainPerkHashes: string[];
}

export interface PerkEntry {
  name: string;
  icon: string;
  description: string;
  category: string;
}

export interface PerkLookupResult {
  hash: string;
  name: string;
  icon: string;
  description: string;
  category: string;
}

export interface PerkWithIcon extends PerkLookupResult {
  hash: string;
}

const weapons = weaponsIndex as WeaponIndexEntry[];
const perks = perksRaw as unknown as Record<string, PerkEntry>;

const weaponsByHash = new Map<string, WeaponIndexEntry>(
  weapons.map((w) => [w.hash, w])
);

const perksByNormalizedName = new Map<string, string>();
const perksByHash = new Map<string, PerkEntry>();
const perksByCategory = new Map<string, PerkWithIcon[]>();

function buildPerksIndex() {
  for (const [hash, perk] of Object.entries(perks)) {
    if (!perk) continue;
    perksByHash.set(hash, perk);
    if (!perk.name) continue;
    const normalized = perk.name.toLowerCase();
    if (!perksByNormalizedName.has(normalized)) {
      perksByNormalizedName.set(normalized, hash);
    }
    if (perk.category) {
      const arr = perksByCategory.get(perk.category);
      const entry: PerkWithIcon = {
        hash,
        name: perk.name,
        icon: perk.icon,
        description: perk.description,
        category: perk.category,
      };
      if (arr) arr.push(entry);
      else perksByCategory.set(perk.category, [entry]);
    }
  }
}
buildPerksIndex();

export function listWeapons(): WeaponIndexEntry[] {
  return weapons;
}

export function getWeapon(hash: string): WeaponIndexEntry | null {
  return weaponsByHash.get(hash) ?? null;
}

export function getPerk(hash: string): PerkEntry | null {
  return perksByHash.get(hash) ?? null;
}

export function listPerksByCategory(category: string): PerkWithIcon[] {
  return perksByCategory.get(category) ?? [];
}

export function listAllPerks(): PerkWithIcon[] {
  const out: PerkWithIcon[] = [];
  for (const [hash, perk] of perksByHash) {
    out.push({
      hash,
      name: perk.name,
      icon: perk.icon,
      description: perk.description,
      category: perk.category,
    });
  }
  return out;
}

export function searchPerkByName(name: string): PerkLookupResult | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  const hash = perksByNormalizedName.get(normalized);
  if (!hash) return null;
  const perk = perksByHash.get(hash);
  if (!perk) return null;
  return {
    hash,
    name: perk.name,
    icon: perk.icon,
    description: perk.description,
    category: perk.category,
  };
}

export function bungieCdnUrl(iconPath: string | undefined | null): string | null {
  if (!iconPath) return null;
  return `https://www.bungie.net${iconPath}`;
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
