/**
 * CRUD para la sub-app GameTracker. Misma forma que `lib/subs/store.ts`:
 * cada fila = un juego del usuario en la misma D1 (`arthurapphub-auth-db`).
 *
 * `appId` es el appid de Steam. `status` es uno de STATUSES:
 *   backlog  → Por jugar (default al agregar)
 *   playing  → Jugando
 *   dropped  → Dropeado
 *   finished → Terminado
 */

export const STATUSES = ['backlog', 'playing', 'dropped', 'finished'] as const;
export type GameStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<GameStatus, string> = {
  backlog: 'Por jugar',
  playing: 'Jugando',
  dropped: 'Dropeado',
  finished: 'Terminado',
};

export const DEFAULT_STATUS: GameStatus = 'backlog';

export interface GameRow {
  id: string;
  appId: number;
  name: string;
  coverUrl: string;
  year: number | null;
  status: GameStatus;
  createdAt: number;
  updatedAt: number;
}

export interface GameInput {
  appId: number;
  name: string;
  coverUrl: string;
  year: number | null;
}

interface D1Row {
  id: string;
  app_id: number;
  name: string;
  cover_url: string;
  year: number | null;
  status: string;
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
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listGames(db: D1Database, username: string): Promise<GameRow[]> {
  const res = await db
    .prepare(
      `SELECT id, app_id, name, cover_url, year, status, created_at, updated_at
       FROM games
       WHERE username = ?
       ORDER BY created_at DESC`
    )
    .bind(username)
    .all<D1Row>();
  return (res.results ?? []).map(toRow);
}

export async function addGame(
  db: D1Database,
  username: string,
  game: GameInput,
  id: string,
  status: GameStatus = DEFAULT_STATUS
): Promise<GameRow | 'duplicate'> {
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO games
           (username, id, app_id, name, cover_url, year, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(username, id, game.appId, game.name, game.coverUrl, game.year, status, now, now)
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
  const res = await db
    .prepare('UPDATE games SET status = ?, updated_at = ? WHERE username = ? AND id = ?')
    .bind(status, now, username, id)
    .run();
  if ((res.meta?.changes ?? 0) === 0) return null;
  const row = await db
    .prepare(
      `SELECT id, app_id, name, cover_url, year, status, created_at, updated_at
       FROM games
       WHERE username = ? AND id = ?`
    )
    .bind(username, id)
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
