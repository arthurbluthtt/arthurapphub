import { getPerk, getWeapon } from './manifest';
import type { WishlistRow, WishlistPerk, PerkSlot } from './wishlist';

export interface ResolvedPerk {
  hash: string;
  name: string;
  icon: string;
  category: string;
  isCustom: boolean;
}

export interface ResolvedWishlistRow {
  itemHash: string;
  name: string;
  iconPath: string;
  perks: Record<PerkSlot, ResolvedPerk | null>;
  found: boolean;
  foundAt: number | null;
  addedAt: number;
}

function lookupPerk(p: WishlistPerk | null): ResolvedPerk | null {
  if (!p) return null;
  if (p.hash) {
    const def = getPerk(p.hash);
    if (def) {
      return {
        hash: p.hash,
        name: p.name || def.name,
        icon: p.icon || def.icon,
        category: p.category || def.category,
        isCustom: false,
      };
    }
  }
  return {
    hash: '',
    name: p.name || '',
    icon: '',
    category: p.category || '',
    isCustom: true,
  };
}

export function resolveWishlistRow(row: WishlistRow): ResolvedWishlistRow | null {
  const weapon = getWeapon(row.itemHash);
  if (!weapon) return null;
  return {
    itemHash: row.itemHash,
    name: row.weaponName || weapon.name,
    iconPath: row.weaponIconPath || weapon.icon,
    perks: {
      barrel: lookupPerk(row.perks.barrel),
      magazine: lookupPerk(row.perks.magazine),
      perk1: lookupPerk(row.perks.perk1),
      perk2: lookupPerk(row.perks.perk2),
    },
    found: row.found,
    foundAt: row.foundAt,
    addedAt: row.addedAt,
  };
}

export function emptyIconDataUrl(): string {
  return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="%23e4e4e7"/><text x="50%" y="58%" font-size="14" text-anchor="middle" fill="%2371717a" font-family="sans-serif">?</text></svg>';
}
