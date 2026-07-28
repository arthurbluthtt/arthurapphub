export interface WishlistRow {
  itemHash: string;
  weaponName: string;
  weaponIconPath: string;
  topPerkHashes: [string, string];
  found: boolean;
  foundAt: number | null;
  addedAt: number;
}

interface D1Row {
  item_hash: string;
  weapon_name: string;
  weapon_icon_path: string;
  top_perk_hashes: string;
  found: number;
  found_at: number | null;
  added_at: number;
}

function toRow(r: D1Row): WishlistRow {
  let perks: [string, string];
  try {
    const parsed = JSON.parse(r.top_perk_hashes);
    perks = [parsed[0], parsed[1]];
  } catch {
    perks = ['', ''];
  }
  return {
    itemHash: r.item_hash,
    weaponName: r.weapon_name,
    weaponIconPath: r.weapon_icon_path,
    topPerkHashes: perks,
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
      `SELECT item_hash, weapon_name, weapon_icon_path, top_perk_hashes,
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
    topPerkHashes: [string, string];
  }
): Promise<'added' | 'duplicate'> {
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO d2_wishlist
           (username, item_hash, weapon_name, weapon_icon_path, top_perk_hashes,
            found, found_at, added_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`
      )
      .bind(
        username,
        data.itemHash,
        data.weaponName,
        data.weaponIconPath,
        JSON.stringify(data.topPerkHashes),
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
