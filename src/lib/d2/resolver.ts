import { getPerk, getWeapon } from './manifest';
import { findCustomPerkIcon } from './perkIcons';
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

async function lookupPerk(
  db: D1Database | null,
  username: string | null,
  p: WishlistPerk | null
): Promise<ResolvedPerk | null> {
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
  if (db && username) {
    const custom = await findCustomPerkIcon(db, username, p.name);
    if (custom?.iconPath) {
      return {
        hash: '',
        name: p.name,
        icon: custom.iconPath,
        category: p.category || '',
        isCustom: true,
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

export async function resolveWishlistRow(
  db: D1Database,
  username: string,
  row: WishlistRow
): Promise<ResolvedWishlistRow | null> {
  const weapon = getWeapon(row.itemHash);
  if (!weapon) return null;
  const perks = {
    barrel: await lookupPerk(db, username, row.perks.barrel),
    magazine: await lookupPerk(db, username, row.perks.magazine),
    perk1: await lookupPerk(db, username, row.perks.perk1),
    perk2: await lookupPerk(db, username, row.perks.perk2),
  };
  return {
    itemHash: row.itemHash,
    name: row.weaponName || weapon.name,
    iconPath: row.weaponIconPath || weapon.icon,
    perks,
    found: row.found,
    foundAt: row.foundAt,
    addedAt: row.addedAt,
  };
}

export function emptyIconDataUrl(): string {
  return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="%23e4e4e7"/><text x="50%" y="58%" font-size="14" text-anchor="middle" fill="%2371717a" font-family="sans-serif">?</text></svg>';
}
