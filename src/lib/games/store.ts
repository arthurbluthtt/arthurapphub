/**
 * CRUD para la sub-app GameTracker. Misma forma que `lib/subs/store.ts`:
 * cada fila = un juego del usuario en la misma D1 (`arthurapphub-auth-db`).
 *
 * `appId` es el appid de Steam. `status` es uno de STATUSES:
 *   backlog  → Por jugar (default al agregar)
 *   playing  → Jugando
 *   finished → Terminado
 */

export const STATUSES = ['backlog', 'playing', 'finished'] as const;
export type GameStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<GameStatus, string> = {
  backlog: 'Por jugar',
  playing: 'Jugando',
  finished: 'Terminado',
};

export const DEFAULT_STATUS: GameStatus = 'backlog';

export interface GameRow {
  id: string;
  appId: number | null;
  name: string;
  coverUrl: string | null;
  year: number | null;
  status: GameStatus;
  saga: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface GameInput {
  appId: number | null;
  name: string;
  coverUrl: string | null;
  year: number | null;
  saga?: string | null;
}

interface D1Row {
  id: string;
  app_id: number | null;
  name: string;
  cover_url: string | null;
  year: number | null;
  status: string;
  saga: string | null;
  created_at: number;
  updated_at: number;
}

export function isStatus(v: unknown): v is GameStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

function toRow(r: D1Row): GameRow {
  return {
    id: r.id,
    appId: r.app_id,
    name: r.name,
    coverUrl: r.cover_url,
    year: r.year,
    status: isStatus(r.status) ? r.status : DEFAULT_STATUS,
    saga: r.saga,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listGames(db: D1Database, username: string): Promise<GameRow[]> {
  const res = await db
    .prepare(
      `SELECT id, app_id, name, cover_url, year, status, saga, created_at, updated_at
       FROM games
       WHERE username = ?
       ORDER BY created_at DESC`
    )
    .bind(username)
    .all<D1Row>();
  return (res.results ?? []).map(toRow);
}

export async function isDuplicateName(
  db: D1Database,
  username: string,
  name: string,
  excludeId: string | null = null
): Promise<boolean> {
  const sql =
    excludeId === null
      ? 'SELECT 1 AS x FROM games WHERE username = ? AND lower(name) = lower(?) LIMIT 1'
      : 'SELECT 1 AS x FROM games WHERE username = ? AND lower(name) = lower(?) AND id != ? LIMIT 1';
  const stmt = db.prepare(sql);
  const row =
    excludeId === null
      ? await stmt.bind(username, name).first()
      : await stmt.bind(username, name, excludeId).first();
  return row !== null;
}

export async function addGame(
  db: D1Database,
  username: string,
  game: GameInput,
  id: string,
  status: GameStatus = DEFAULT_STATUS
): Promise<GameRow | 'duplicate'> {
  const now = Date.now();
  const saga = game.saga ?? null;
  try {
    await db
      .prepare(
        `INSERT INTO games
           (username, id, app_id, name, cover_url, year, status, saga, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(username, id, game.appId, game.name, game.coverUrl, game.year, status, saga, now, now)
      .run();
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
      return 'duplicate';
    }
    throw err;
  }
  return {
    id,
    appId: game.appId,
    name: game.name,
    coverUrl: game.coverUrl,
    year: game.year,
    status,
    saga,
    createdAt: now,
    updatedAt: now,
  };
}

export async function setStatus(
  db: D1Database,
  username: string,
  id: string,
  status: GameStatus
): Promise<GameRow | null> {
  const now = Date.now();
  const row = await db
    .prepare(
      `UPDATE games
         SET status = ?, updated_at = ?
       WHERE username = ? AND id = ?
       RETURNING id, app_id, name, cover_url, year, status, saga, created_at, updated_at`
    )
    .bind(status, now, username, id)
    .first<D1Row>();
  return row ? toRow(row) : null;
}

export async function removeGame(
  db: D1Database,
  username: string,
  id: string
): Promise<boolean> {
  const res = await db
    .prepare('DELETE FROM games WHERE username = ? AND id = ?')
    .bind(username, id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export type EditField = 'name' | 'year' | 'coverUrl' | 'saga';
export type EditPatch = Partial<Pick<GameInput, 'name' | 'year' | 'coverUrl' | 'saga'>>;

export type EditResult =
  | { ok: true; game: GameRow }
  | { ok: false; reason: 'not-found' | 'duplicate' | 'no-fields' };

/**
 * Actualiza uno o más campos editables de un juego del usuario.
 * El game debe pertenecer al `username` (ownership check via WHERE).
 * Si se cambia `name` y ya existe otro con el mismo nombre (case-insensitive),
 * devuelve `duplicate` (409).
 */
export async function editGame(
  db: D1Database,
  username: string,
  id: string,
  patch: EditPatch
): Promise<EditResult> {
  const fields: EditField[] = [];
  const values: (string | number | null)[] = [];
  for (const key of ['name', 'year', 'coverUrl', 'saga'] as const) {
    if (key in patch) {
      fields.push(key);
      values.push(patch[key] as string | number | null);
    }
  }
  if (fields.length === 0) return { ok: false, reason: 'no-fields' };

  const now = Date.now();
  const setSql = fields.map((f) => `${f === 'coverUrl' ? 'cover_url' : f} = ?`).join(', ');
  const sql = `UPDATE games
                 SET ${setSql}, updated_at = ?
               WHERE username = ? AND id = ?
               RETURNING id, app_id, name, cover_url, year, status, saga, created_at, updated_at`;
  try {
    const row = await db
      .prepare(sql)
      .bind(...values, now, username, id)
      .first<D1Row>();
    if (!row) return { ok: false, reason: 'not-found' };
    return { ok: true, game: toRow(row) };
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
      return { ok: false, reason: 'duplicate' };
    }
    throw err;
  }
}
