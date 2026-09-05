/**
 * CRUD para la sub-app MediaTracker. Mismo patrón que `lib/games/store.ts`:
 * cada fila = un item audiovisual (peli o serie) del usuario en la misma D1
 * (`arthurapphub-auth-db`).
 *
 * `mediaType` distingue 'movie' de 'tv'. `externalId` es el id de TMDB.
 * `status` es uno de STATUSES:
 *   backlog   → Por ver (default al agregar)
 *   watching  → Mirando
 *   finished  → Terminada
 */

export const STATUSES = ['backlog', 'watching', 'finished'] as const;
export type MediaStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<MediaStatus, string> = {
  backlog: 'Por ver',
  watching: 'Mirando',
  finished: 'Terminada',
};

export const DEFAULT_STATUS: MediaStatus = 'backlog';

export const MEDIA_TYPES = ['movie', 'tv'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  movie: 'Película',
  tv: 'Serie',
};

export const MEDIA_TYPE_ICONS: Record<MediaType, string> = {
  movie: '🎬',
  tv: '📺',
};

export interface MediaRow {
  id: string;
  externalId: number | null;
  mediaType: MediaType;
  title: string;
  coverUrl: string | null;
  year: number | null;
  director: string | null;
  genre: string | null;
  status: MediaStatus;
  createdAt: number;
  updatedAt: number;
}

export interface MediaInput {
  externalId: number | null;
  mediaType: MediaType;
  title: string;
  coverUrl: string | null;
  year: number | null;
  director?: string | null;
  genre?: string | null;
}

interface D1Row {
  id: string;
  external_id: number | null;
  media_type: string;
  title: string;
  cover_url: string | null;
  year: number | null;
  director: string | null;
  genre: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export function isStatus(v: unknown): v is MediaStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

export function isMediaType(v: unknown): v is MediaType {
  return typeof v === 'string' && (MEDIA_TYPES as readonly string[]).includes(v);
}

function toRow(r: D1Row): MediaRow {
  return {
    id: r.id,
    externalId: r.external_id,
    mediaType: isMediaType(r.media_type) ? r.media_type : 'movie',
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

export async function listMedia(db: D1Database, username: string): Promise<MediaRow[]> {
  const res = await db
    .prepare(
      `SELECT id, external_id, media_type, title, cover_url, year, director, genre,
              status, created_at, updated_at
       FROM media
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
      ? 'SELECT 1 AS x FROM media WHERE username = ? AND lower(title) = lower(?) LIMIT 1'
      : 'SELECT 1 AS x FROM media WHERE username = ? AND lower(title) = lower(?) AND id != ? LIMIT 1';
  const stmt = db.prepare(sql);
  const row =
    excludeId === null
      ? await stmt.bind(username, title).first()
      : await stmt.bind(username, title, excludeId).first();
  return row !== null;
}

export async function addMedia(
  db: D1Database,
  username: string,
  media: MediaInput,
  id: string,
  status: MediaStatus = DEFAULT_STATUS
): Promise<MediaRow | 'duplicate'> {
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO media
           (username, id, external_id, media_type, title, cover_url, year,
            director, genre, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        username,
        id,
        media.externalId,
        media.mediaType,
        media.title,
        media.coverUrl,
        media.year,
        media.director ?? null,
        media.genre ?? null,
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
    externalId: media.externalId,
    mediaType: media.mediaType,
    title: media.title,
    coverUrl: media.coverUrl,
    year: media.year,
    director: media.director ?? null,
    genre: media.genre ?? null,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

export async function setMediaStatus(
  db: D1Database,
  username: string,
  id: string,
  status: MediaStatus
): Promise<MediaRow | null> {
  const now = Date.now();
  const row = await db
    .prepare(
      `UPDATE media
         SET status = ?, updated_at = ?
       WHERE username = ? AND id = ?
       RETURNING id, external_id, media_type, title, cover_url, year, director,
                 genre, status, created_at, updated_at`
    )
    .bind(status, now, username, id)
    .first<D1Row>();
  return row ? toRow(row) : null;
}

export async function removeMedia(
  db: D1Database,
  username: string,
  id: string
): Promise<boolean> {
  const res = await db
    .prepare('DELETE FROM media WHERE username = ? AND id = ?')
    .bind(username, id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export type EditField =
  | 'mediaType'
  | 'title'
  | 'year'
  | 'coverUrl'
  | 'director'
  | 'genre'
  | 'status';
export type EditPatch = Partial<
  Pick<MediaInput, 'mediaType' | 'title' | 'year' | 'coverUrl' | 'director' | 'genre'> & {
    status: MediaStatus;
  }
>;

export type EditResult =
  | { ok: true; media: MediaRow }
  | { ok: false; reason: 'not-found' | 'duplicate' | 'no-fields' };

/**
 * Actualiza uno o más campos editables de un item del usuario.
 * Ownership check via WHERE username = ?. Si se cambia `title` y ya existe
 * otro con el mismo título (case-insensitive), devuelve `duplicate` (409).
 */
export async function editMedia(
  db: D1Database,
  username: string,
  id: string,
  patch: EditPatch
): Promise<EditResult> {
  const fieldMap: Record<EditField, string> = {
    mediaType: 'media_type',
    title: 'title',
    year: 'year',
    coverUrl: 'cover_url',
    director: 'director',
    genre: 'genre',
    status: 'status',
  };
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const key of [
    'mediaType',
    'title',
    'year',
    'coverUrl',
    'director',
    'genre',
    'status',
  ] as const) {
    if (key in patch) {
      fields.push(fieldMap[key]);
      values.push(patch[key] as string | number | null);
    }
  }
  if (fields.length === 0) return { ok: false, reason: 'no-fields' };

  const now = Date.now();
  const setSql = fields.map((f) => `${f} = ?`).join(', ');
  const sql = `UPDATE media
                 SET ${setSql}, updated_at = ?
               WHERE username = ? AND id = ?
               RETURNING id, external_id, media_type, title, cover_url, year, director,
                         genre, status, created_at, updated_at`;
  try {
    const row = await db
      .prepare(sql)
      .bind(...values, now, username, id)
      .first<D1Row>();
    if (!row) return { ok: false, reason: 'not-found' };
    return { ok: true, media: toRow(row) };
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
      return { ok: false, reason: 'duplicate' };
    }
    throw err;
  }
}
