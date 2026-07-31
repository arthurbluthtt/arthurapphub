/**
 * Wishlist CRUD para Umamusume. Misma forma que `lib/d2/wishlist.ts` pero más simple:
 * cada fila = un personaje agregado. Las cartas NO se guardan en la wishlist —
 * se leen estáticamente desde data/uma/recommendations.json (regenerado con
 * `npm run build:uma-data`).
 */

export interface UmaWishlistRow {
  characterId: string;
  found: boolean;
  foundAt: number | null;
  addedAt: number;
}

interface D1Row {
  character_id: string;
  found: number;
  found_at: number | null;
  added_at: number;
}

function toRow(r: D1Row): UmaWishlistRow {
  return {
    characterId: r.character_id,
    found: r.found === 1,
    foundAt: r.found_at,
    addedAt: r.added_at,
  };
}

export async function listWishlist(
  db: D1Database,
  username: string
): Promise<UmaWishlistRow[]> {
  const res = await db
    .prepare(
      `SELECT character_id, found, found_at, added_at
       FROM uma_wishlist
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
  characterId: string
): Promise<'added' | 'duplicate'> {
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO uma_wishlist
           (username, character_id, found, found_at, added_at)
         VALUES (?, ?, 0, NULL, ?)`
      )
      .bind(username, characterId, now)
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
  characterId: string
): Promise<boolean> {
  const res = await db
    .prepare(
      'DELETE FROM uma_wishlist WHERE username = ? AND character_id = ?'
    )
    .bind(username, characterId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function toggleFound(
  db: D1Database,
  username: string,
  characterId: string
): Promise<{ found: boolean; foundAt: number | null } | null> {
  const current = await db
    .prepare('SELECT found FROM uma_wishlist WHERE username = ? AND character_id = ?')
    .bind(username, characterId)
    .first<{ found: number }>();
  if (!current) return null;
  const now = Date.now();
  const nextFound = current.found === 1 ? 0 : 1;
  const nextFoundAt = nextFound === 1 ? now : null;
  await db
    .prepare(
      'UPDATE uma_wishlist SET found = ?, found_at = ? WHERE username = ? AND character_id = ?'
    )
    .bind(nextFound, nextFoundAt, username, characterId)
    .run();
  return { found: nextFound === 1, foundAt: nextFoundAt };
}