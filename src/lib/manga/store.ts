/**
 * CRUD para la sub-app MangaTracker. Mismo patrón que `lib/media/store.ts`:
 * cada fila = un manga/manhwa/manhua del usuario en la misma D1
 * (`arthurapphub-auth-db`).
 *
 * `mangaType` distingue 'manga' | 'manhwa' | 'manhua'. `externalId` es el id de Kitsu.
 * `status` es uno de STATUSES:
 *   backlog   → Por leer (default al agregar)
 *   reading   → Leyendo
 *   finished  → Terminado
 */

export const STATUSES = ['backlog', 'reading', 'finished'] as const;
export type MangaStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<MangaStatus, string> = {
  backlog: 'Por leer',
  reading: 'Leyendo',
  finished: 'Terminado',
};

export const DEFAULT_STATUS: MangaStatus = 'backlog';

export const MANGA_TYPES = ['manga', 'manhwa', 'manhua'] as const;
export type MangaType = (typeof MANGA_TYPES)[number];

export const MANGA_TYPE_LABELS: Record<MangaType, string> = {
  manga: 'Manga',
  manhwa: 'Manhwa',
  manhua: 'Manhua',
};

export const MANGA_TYPE_ICONS: Record<MangaType, string> = {
  manga: '📚',
  manhwa: '🇰🇷',
  manhua: '🇨🇳',
};

export interface MangaRow {
  id: string;
  externalId: number | null;
  mangaType: MangaType;
  title: string;
  coverUrl: string | null;
  status: MangaStatus;
  createdAt: number;
  updatedAt: number;
}

export interface MangaInput {
  externalId: number | null;
  mangaType: MangaType;
  title: string;
  coverUrl: string | null;
}

interface D1Row {
  id: string;
  external_id: number | null;
  manga_type: string;
  title: string;
  cover_url: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export function isStatus(v: unknown): v is MangaStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

export function isMangaType(v: unknown): v is MangaType {
  return typeof v === 'string' && (MANGA_TYPES as readonly string[]).includes(v);
}

function toRow(r: D1Row): MangaRow {
  return {
    id: r.id,
    externalId: r.external_id,
    mangaType: isMangaType(r.manga_type) ? r.manga_type : 'manga',
    title: r.title,
    coverUrl: r.cover_url,
    status: isStatus(r.status) ? r.status : DEFAULT_STATUS,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listManga(db: D1Database, username: string): Promise<MangaRow[]> {
  const res = await db
    .prepare(
      `SELECT id, external_id, manga_type, title, cover_url,
              status, created_at, updated_at
       FROM manga
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
      ? 'SELECT 1 AS x FROM manga WHERE username = ? AND lower(title) = lower(?) LIMIT 1'
      : 'SELECT 1 AS x FROM manga WHERE username = ? AND lower(title) = lower(?) AND id != ? LIMIT 1';
  const stmt = db.prepare(sql);
  const row =
    excludeId === null
      ? await stmt.bind(username, title).first()
      : await stmt.bind(username, title, excludeId).first();
  return row !== null;
}

export async function addManga(
  db: D1Database,
  username: string,
  manga: MangaInput,
  id: string,
  status: MangaStatus = DEFAULT_STATUS
): Promise<MangaRow | 'duplicate'> {
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO manga
           (username, id, external_id, manga_type, title, cover_url, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(username, id, manga.externalId, manga.mangaType, manga.title, manga.coverUrl, status, now, now)
      .run();
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
      return 'duplicate';
    }
    throw err;
  }
  return {
    id,
    externalId: manga.externalId,
    mangaType: manga.mangaType,
    title: manga.title,
    coverUrl: manga.coverUrl,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

export async function setMangaStatus(
  db: D1Database,
  username: string,
  id: string,
  status: MangaStatus
): Promise<MangaRow | null> {
  const now = Date.now();
  const row = await db
    .prepare(
      `UPDATE manga
         SET status = ?, updated_at = ?
       WHERE username = ? AND id = ?
       RETURNING id, external_id, manga_type, title, cover_url, status, created_at, updated_at`
    )
    .bind(status, now, username, id)
    .first<D1Row>();
  return row ? toRow(row) : null;
}

export async function removeManga(db: D1Database, username: string, id: string): Promise<boolean> {
  const res = await db.prepare('DELETE FROM manga WHERE username = ? AND id = ?').bind(username, id).run();
  return (res.meta?.changes ?? 0) > 0;
}

export type EditField = 'title' | 'coverUrl' | 'status' | 'mangaType';
export type EditPatch = Partial<
  Pick<MangaInput, 'title' | 'coverUrl'> & {
    mangaType: MangaType;
    status: MangaStatus;
  }
>;

export type EditResult =
  | { ok: true; manga: MangaRow }
  | { ok: false; reason: 'not-found' | 'duplicate' | 'no-fields' };

/**
 * Actualiza uno o más campos editables de un manga del usuario.
 * Ownership check via WHERE username = ?.
 */
export async function editManga(
  db: D1Database,
  username: string,
  id: string,
  patch: EditPatch
): Promise<EditResult> {
  const fieldMap: Record<EditField, string> = {
    title: 'title',
    coverUrl: 'cover_url',
    status: 'status',
    mangaType: 'manga_type',
  };
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const key of ['title', 'coverUrl', 'status', 'mangaType'] as const) {
    if (key in patch) {
      fields.push(fieldMap[key as EditField]);
      values.push(patch[key as keyof EditPatch] as string | number | null);
    }
  }
  if (fields.length === 0) return { ok: false, reason: 'no-fields' };

  const now = Date.now();
  const setSql = fields.map((f) => `${f} = ?`).join(', ');
  const sql = `UPDATE manga
                 SET ${setSql}, updated_at = ?
               WHERE username = ? AND id = ?
               RETURNING id, external_id, manga_type, title, cover_url, status, created_at, updated_at`;
  try {
    const row = await db
      .prepare(sql)
      .bind(...values, now, username, id)
      .first<D1Row>();
    if (!row) return { ok: false, reason: 'not-found' };
    return { ok: true, manga: toRow(row) };
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
      return { ok: false, reason: 'duplicate' };
    }
    throw err;
  }
}
