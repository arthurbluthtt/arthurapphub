/**
 * CRUD para la sub-app BookTracker. Mismo patrón que `lib/manga/store.ts`:
 * cada fila = un libro del usuario en la misma D1 (`arthurapphub-auth-db`).
 *
 * `bookType` distingue 'book' | 'ebook' | 'audiobook'. `externalId` es OLID de Open Library (TEXT).
 * `status` es uno de STATUSES:
 *   backlog   → Por leer (default al agregar)
 *   reading   → Leyendo
 *   finished  → Terminado
 */

export const STATUSES = ['backlog', 'reading', 'finished'] as const;
export type BookStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<BookStatus, string> = {
  backlog: 'Por leer',
  reading: 'Leyendo',
  finished: 'Terminado',
};

export const DEFAULT_STATUS: BookStatus = 'backlog';

export const BOOK_TYPES = ['book', 'ebook', 'audiobook'] as const;
export type BookType = (typeof BOOK_TYPES)[number];

export const BOOK_TYPE_LABELS: Record<BookType, string> = {
  book: 'Libro',
  ebook: 'Ebook',
  audiobook: 'Audiolibro',
};

export const BOOK_TYPE_ICONS: Record<BookType, string> = {
  book: '📖',
  ebook: '📱',
  audiobook: '🎧',
};

export interface BookRow {
  id: string;
  externalId: string | null;
  bookType: BookType;
  title: string;
  coverUrl: string | null;
  status: BookStatus;
  createdAt: number;
  updatedAt: number;
}

export interface BookInput {
  externalId: string | null;
  bookType: BookType;
  title: string;
  coverUrl: string | null;
}

interface D1Row {
  id: string;
  external_id: string | null;
  book_type: string;
  title: string;
  cover_url: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export function isStatus(v: unknown): v is BookStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

export function isBookType(v: unknown): v is BookType {
  return typeof v === 'string' && (BOOK_TYPES as readonly string[]).includes(v);
}

function toRow(r: D1Row): BookRow {
  return {
    id: r.id,
    externalId: r.external_id,
    bookType: isBookType(r.book_type) ? r.book_type : 'book',
    title: r.title,
    coverUrl: r.cover_url,
    status: isStatus(r.status) ? r.status : DEFAULT_STATUS,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listBooks(db: D1Database, username: string): Promise<BookRow[]> {
  const res = await db
    .prepare(
      `SELECT id, external_id, book_type, title, cover_url,
              status, created_at, updated_at
       FROM books
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
      ? 'SELECT 1 AS x FROM books WHERE username = ? AND lower(title) = lower(?) LIMIT 1'
      : 'SELECT 1 AS x FROM books WHERE username = ? AND lower(title) = lower(?) AND id != ? LIMIT 1';
  const stmt = db.prepare(sql);
  const row =
    excludeId === null
      ? await stmt.bind(username, title).first()
      : await stmt.bind(username, title, excludeId).first();
  return row !== null;
}

export async function addBook(
  db: D1Database,
  username: string,
  book: BookInput,
  id: string,
  status: BookStatus = DEFAULT_STATUS
): Promise<BookRow | 'duplicate'> {
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO books
           (username, id, external_id, book_type, title, cover_url, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(username, id, book.externalId, book.bookType, book.title, book.coverUrl, status, now, now)
      .run();
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
      return 'duplicate';
    }
    throw err;
  }
  return {
    id,
    externalId: book.externalId,
    bookType: book.bookType,
    title: book.title,
    coverUrl: book.coverUrl,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

export async function setBookStatus(
  db: D1Database,
  username: string,
  id: string,
  status: BookStatus
): Promise<BookRow | null> {
  const now = Date.now();
  const row = await db
    .prepare(
      `UPDATE books
         SET status = ?, updated_at = ?
       WHERE username = ? AND id = ?
       RETURNING id, external_id, book_type, title, cover_url, status, created_at, updated_at`
    )
    .bind(status, now, username, id)
    .first<D1Row>();
  return row ? toRow(row) : null;
}

export async function removeBook(db: D1Database, username: string, id: string): Promise<boolean> {
  const res = await db.prepare('DELETE FROM books WHERE username = ? AND id = ?').bind(username, id).run();
  return (res.meta?.changes ?? 0) > 0;
}

export type EditField = 'title' | 'coverUrl' | 'status' | 'bookType';
export type EditPatch = Partial<
  Pick<BookInput, 'title' | 'coverUrl'> & {
    bookType: BookType;
    status: BookStatus;
  }
>;

export type EditResult =
  | { ok: true; book: BookRow }
  | { ok: false; reason: 'not-found' | 'duplicate' | 'no-fields' };

/**
 * Actualiza uno o más campos editables de un libro del usuario.
 * Ownership check via WHERE username = ?.
 */
export async function editBook(
  db: D1Database,
  username: string,
  id: string,
  patch: EditPatch
): Promise<EditResult> {
  const fieldMap: Record<EditField, string> = {
    title: 'title',
    coverUrl: 'cover_url',
    status: 'status',
    bookType: 'book_type',
  };
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const key of ['title', 'coverUrl', 'status', 'bookType'] as const) {
    if (key in patch) {
      fields.push(fieldMap[key as EditField]);
      values.push(patch[key as keyof EditPatch] as string | number | null);
    }
  }
  if (fields.length === 0) return { ok: false, reason: 'no-fields' };

  const now = Date.now();
  const setSql = fields.map((f) => `${f} = ?`).join(', ');
  const sql = `UPDATE books
                 SET ${setSql}, updated_at = ?
               WHERE username = ? AND id = ?
               RETURNING id, external_id, book_type, title, cover_url, status, created_at, updated_at`;
  try {
    const row = await db
      .prepare(sql)
      .bind(...values, now, username, id)
      .first<D1Row>();
    if (!row) return { ok: false, reason: 'not-found' };
    return { ok: true, book: toRow(row) };
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
      return { ok: false, reason: 'duplicate' };
    }
    throw err;
  }
}
