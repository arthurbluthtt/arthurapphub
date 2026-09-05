/**
 * CRUD para la sub-app AnimeTracker. Copia rich de `lib/media/store.ts`:
 * cada fila = un anime del usuario en la misma D1 (`arthurapphub-auth-db`).
 *
 * `animeType` distingue 'tv' (serie) de 'movie' (película anime). `externalId` es el id de Kitsu.
 * `status` es uno de STATUSES:
 *   backlog   → Por ver (default al agregar)
 *   watching  → Mirando
 *   finished  → Terminado
 */

export const STATUSES = ['backlog', 'watching', 'finished'] as const;
export type AnimeStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<AnimeStatus, string> = {
  backlog: 'Por ver',
  watching: 'Mirando',
  finished: 'Terminado',
};

export const DEFAULT_STATUS: AnimeStatus = 'backlog';

export const ANIME_TYPES = ['tv', 'movie'] as const;
export type AnimeType = (typeof ANIME_TYPES)[number];

export const ANIME_TYPE_LABELS: Record<AnimeType, string> = {
  movie: 'Película',
  tv: 'Serie',
};

export const ANIME_TYPE_ICONS: Record<AnimeType, string> = {
  movie: '🎬',
  tv: '📺',
};

export interface AnimeRow {
  id: string;
  externalId: number | null;
  animeType: AnimeType;
  title: string;
  coverUrl: string | null;
  year: number | null;
  director: string | null;
  genre: string | null;
  status: AnimeStatus;
  createdAt: number;
  updatedAt: number;
}

export interface AnimeInput {
  externalId: number | null;
  animeType: AnimeType;
  title: string;
  coverUrl: string | null;
  year: number | null;
  director?: string | null;
  genre?: string | null;
}

interface D1Row {
  id: string;
  external_id: number | null;
  anime_type: string;
  title: string;
  cover_url: string | null;
  year: number | null;
  director: string | null;
  genre: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export function isStatus(v: unknown): v is AnimeStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

export function isAnimeType(v: unknown): v is AnimeType {
  return typeof v === 'string' && (ANIME_TYPES as readonly string[]).includes(v);
}

function toRow(r: D1Row): AnimeRow {
  return {
    id: r.id,
    externalId: r.external_id,
    animeType: isAnimeType(r.anime_type) ? r.anime_type : 'tv',
    title: r.title,
    coverUrl: r.cover_url,
    year: r.year,
    director: r.director,
    genre: r.genre,
    status: isStatus(r.status) ? r.status : DEFAULT_STATUS,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listAnime(db: D1Database, username: string): Promise<AnimeRow[]> {
  const res = await db
    .prepare(
      `SELECT id, external_id, anime_type, title, cover_url, year, director, genre,
              status, created_at, updated_at
       FROM anime
       WHERE username = ?
       ORDER BY created_at DESC`
    )
    .bind(username)
    .all<D1Row>();
  return (res.results ?? []).map(toRow);
}

export async function isDuplicateTitle(
  db: D1Database,
  username: string,
  title: string,
  excludeId: string | null = null
): Promise<boolean> {
  const sql =
    excludeId === null
      ? 'SELECT 1 AS x FROM anime WHERE username = ? AND lower(title) = lower(?) LIMIT 1'
      : 'SELECT 1 AS x FROM anime WHERE username = ? AND lower(title) = lower(?) AND id != ? LIMIT 1';
  const stmt = db.prepare(sql);
  const row =
    excludeId === null
      ? await stmt.bind(username, title).first()
      : await stmt.bind(username, title, excludeId).first();
  return row !== null;
}

export async function addAnime(
  db: D1Database,
  username: string,
  anime: AnimeInput,
  id: string,
  status: AnimeStatus = DEFAULT_STATUS
): Promise<AnimeRow | 'duplicate'> {
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO anime
           (username, id, external_id, anime_type, title, cover_url, year,
            director, genre, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        username,
        id,
        anime.externalId,
        anime.animeType,
        anime.title,
        anime.coverUrl,
        anime.year,
        anime.director ?? null,
        anime.genre ?? null,
        status,
        now,
        now
      )
      .run();
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
      return 'duplicate';
    }
    throw err;
  }
  return {
    id,
    externalId: anime.externalId,
    animeType: anime.animeType,
    title: anime.title,
    coverUrl: anime.coverUrl,
    year: anime.year,
    director: anime.director ?? null,
    genre: anime.genre ?? null,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

export async function setAnimeStatus(
  db: D1Database,
  username: string,
  id: string,
  status: AnimeStatus
): Promise<AnimeRow | null> {
  const now = Date.now();
  const row = await db
    .prepare(
      `UPDATE anime
         SET status = ?, updated_at = ?
       WHERE username = ? AND id = ?
       RETURNING id, external_id, anime_type, title, cover_url, year, director,
                 genre, status, created_at, updated_at`
    )
    .bind(status, now, username, id)
    .first<D1Row>();
  return row ? toRow(row) : null;
}

export async function removeAnime(
  db: D1Database,
  username: string,
  id: string
): Promise<boolean> {
  const res = await db
    .prepare('DELETE FROM anime WHERE username = ? AND id = ?')
    .bind(username, id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export type EditField = 'title' | 'year' | 'coverUrl' | 'director' | 'genre' | 'status' | 'animeType';
export type EditPatch = Partial<
  Pick<AnimeInput, 'title' | 'year' | 'coverUrl' | 'director' | 'genre' | 'animeType'> & {
    status: AnimeStatus;
  }
>;

export type EditResult =
  | { ok: true; anime: AnimeRow }
  | { ok: false; reason: 'not-found' | 'duplicate' | 'no-fields' };

/**
 * Actualiza uno o más campos editables de un anime del usuario.
 * Ownership check via WHERE username = ?. Si se cambia `title` y ya existe
 * otro con el mismo título (case-insensitive), devuelve `duplicate` (409).
 */
export async function editAnime(
  db: D1Database,
  username: string,
  id: string,
  patch: EditPatch
): Promise<EditResult> {
  const fieldMap: Record<EditField, string> = {
    title: 'title',
    year: 'year',
    coverUrl: 'cover_url',
    director: 'director',
    genre: 'genre',
    status: 'status',
    animeType: 'anime_type',
  };
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const key of ['title', 'year', 'coverUrl', 'director', 'genre', 'status', 'animeType'] as const) {
    if (key in patch) {
      fields.push(fieldMap[key as EditField]);
      values.push(patch[key as keyof EditPatch] as string | number | null);
    }
  }
  if (fields.length === 0) return { ok: false, reason: 'no-fields' };

  const now = Date.now();
  const setSql = fields.map((f) => `${f} = ?`).join(', ');
  const sql = `UPDATE anime
                 SET ${setSql}, updated_at = ?
               WHERE username = ? AND id = ?
               RETURNING id, external_id, anime_type, title, cover_url, year, director,
                         genre, status, created_at, updated_at`;
  try {
    const row = await db
      .prepare(sql)
      .bind(...values, now, username, id)
      .first<D1Row>();
    if (!row) return { ok: false, reason: 'not-found' };
    return { ok: true, anime: toRow(row) };
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
      return { ok: false, reason: 'duplicate' };
    }
    throw err;
  }
}
