import { getPerk, getWeapon } from './manifest';
import type { WishlistRow } from './wishlist';

export interface ResolvedPerk {
  hash: string;
  name: string;
  icon: string;
}

export interface ResolvedWishlistRow {
  itemHash: string;
  name: string;
  iconPath: string;
  perk1: ResolvedPerk | null;
  perk2: ResolvedPerk | null;
  found: boolean;
  foundAt: number | null;
  addedAt: number;
}

function lookupPerk(hash: string): ResolvedPerk | null {
  if (!hash) return null;
  const def = getPerk(hash);
  if (!def) return null;
  return { hash, name: def.name, icon: def.icon };
}

export function resolveWishlistRow(row: WishlistRow): ResolvedWishlistRow | null {
  const weapon = getWeapon(row.itemHash);
  if (!weapon) return null;
  const [hash1, hash2] = row.topPerkHashes;
  return {
    itemHash: row.itemHash,
    name: weapon.name,
    iconPath: weapon.icon,
    perk1: lookupPerk(hash1),
    perk2: lookupPerk(hash2),
    found: row.found,
    foundAt: row.foundAt,
    addedAt: row.addedAt,
  };
}
