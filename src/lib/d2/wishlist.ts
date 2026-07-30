export type PerkSlot = 'barrel' | 'magazine' | 'perk1' | 'perk2';

export const PERK_SLOTS: PerkSlot[] = ['barrel', 'magazine', 'perk1', 'perk2'];

export const PERK_SLOT_LABELS: Record<PerkSlot, string> = {
  barrel: 'Cañón',
  magazine: 'Cargador',
  perk1: 'Rasgo 1',
  perk2: 'Rasgo 2',
};

export interface WishlistPerk {
  name: string;
  hash: string;
  icon: string;
  category: string;
}

export type WishlistPerkSlot = WishlistPerk | null;

export interface WishlistPerks {
  barrel: WishlistPerkSlot;
  magazine: WishlistPerkSlot;
  perk1: WishlistPerkSlot;
  perk2: WishlistPerkSlot;
}

export interface WishlistRow {
  itemHash: string;
  weaponName: string;
  weaponIconPath: string;
  perks: WishlistPerks;
  found: boolean;
  foundAt: number | null;
  addedAt: number;
}

interface D1Row {
  item_hash: string;
  weapon_name: string;
  weapon_icon_path: string;
  perks_json: string;
  found: number;
  found_at: number | null;
  added_at: number;
}

function emptyPerks(): WishlistPerks {
  return { barrel: null, magazine: null, perk1: null, perk2: null };
}

function stripPerk(input: unknown): WishlistPerkSlot {
  if (!input || typeof input !== 'object') return null;
  const p = input as Record<string, unknown>;
  if (typeof p.name !== 'string' || !p.name) return null;
  return {
    name: p.name,
    hash: typeof p.hash === 'string' ? p.hash : '',
    icon: typeof p.icon === 'string' ? p.icon : '',
    category: typeof p.category === 'string' ? p.category : '',
  };
}

function toRow(r: D1Row): WishlistRow {
  const perks = emptyPerks();
  try {
    const obj = JSON.parse(r.perks_json) as Partial<WishlistPerks>;
    perks.barrel = stripPerk(obj.barrel);
    perks.magazine = stripPerk(obj.magazine);
    perks.perk1 = stripPerk(obj.perk1);
    perks.perk2 = stripPerk(obj.perk2);
  } catch {
    // perks remain empty — old data without perks_json should not exist after
    // migration 0005, but be defensive.
  }
  return {
    itemHash: r.item_hash,
    weaponName: r.weapon_name,
    weaponIconPath: r.weapon_icon_path,
    perks,
    found: r.found === 1,
    foundAt: r.found_at,
    addedAt: r.added_at,
  };
}

export async function listWishlist(
  db: D1Database,
  username: string
): Promise<WishlistRow[]> {
  const res = await db
    .prepare(
      `SELECT item_hash, weapon_name, weapon_icon_path, perks_json,
              found, found_at, added_at
       FROM d2_wishlist
       WHERE username = ?
       ORDER BY found ASC, added_at DESC`
    )
    .bind(username)
    .all<D1Row>();
  return (res.results ?? []).map(toRow);
}

export async function addWishlist(
  db: D1Database,
  username: string,
  data: {
    itemHash: string;
    weaponName: string;
    weaponIconPath: string;
    perks: WishlistPerks;
  }
): Promise<'added' | 'duplicate'> {
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO d2_wishlist
           (username, item_hash, weapon_name, weapon_icon_path,
            perks_json, found, found_at, added_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`
      )
      .bind(
        username,
        data.itemHash,
        data.weaponName,
        data.weaponIconPath,
        JSON.stringify(data.perks),
        now
      )
      .run();
    return 'added';
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
      return 'duplicate';
    }
    throw err;
  }
}

export async function removeWishlist(
  db: D1Database,
  username: string,
  itemHash: string
): Promise<boolean> {
  const res = await db
    .prepare(
      'DELETE FROM d2_wishlist WHERE username = ? AND item_hash = ?'
    )
    .bind(username, itemHash)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function getWishlistRow(
  db: D1Database,
  username: string,
  itemHash: string
): Promise<WishlistRow | null> {
  const row = await db
    .prepare(
      `SELECT item_hash, weapon_name, weapon_icon_path, perks_json,
              found, found_at, added_at
       FROM d2_wishlist
       WHERE username = ? AND item_hash = ?
       LIMIT 1`
    )
    .bind(username, itemHash)
    .first<D1Row>();
  if (!row) return null;
  return toRow(row);
}

export async function updateWishlist(
  db: D1Database,
  username: string,
  itemHash: string,
  data: { perks: WishlistPerks }
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE d2_wishlist SET perks_json = ? WHERE username = ? AND item_hash = ?`
    )
    .bind(JSON.stringify(data.perks), username, itemHash)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function toggleFound(
  db: D1Database,
  username: string,
  itemHash: string
): Promise<{ found: boolean; foundAt: number | null } | null> {
  const current = await db
    .prepare('SELECT found FROM d2_wishlist WHERE username = ? AND item_hash = ?')
    .bind(username, itemHash)
    .first<{ found: number }>();
  if (!current) return null;
  const now = Date.now();
  const nextFound = current.found === 1 ? 0 : 1;
  const nextFoundAt = nextFound === 1 ? now : null;
  await db
    .prepare(
      'UPDATE d2_wishlist SET found = ?, found_at = ? WHERE username = ? AND item_hash = ?'
    )
    .bind(nextFound, nextFoundAt, username, itemHash)
    .run();
  return { found: nextFound === 1, foundAt: nextFoundAt };
}
