const COOKIE_NAME = 'hub_sess';
const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const AUTH_CODE_TTL_MS = 60 * 1000;
const SALT_BYTES = new TextEncoder().encode('arthurapphub-auth-v1');
const DEFAULT_USER_ID = 'default';

function base64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function hashPin(pin: string, pepper: string): Promise<string> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin + pepper),
    { name: 'PBKDF2', hash: 'SHA-256' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: SALT_BYTES, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    256
  );
  return base64Url(new Uint8Array(bits));
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function getPinHash(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare('SELECT pin_hash FROM pin_credentials WHERE user_id = ?')
    .bind(DEFAULT_USER_ID)
    .first<{ pin_hash: string }>();
  return row?.pin_hash ?? null;
}

export async function setPinHash(db: D1Database, pinHash: string): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO pin_credentials (user_id, pin_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET pin_hash = excluded.pin_hash, updated_at = excluded.updated_at`
    )
    .bind(DEFAULT_USER_ID, pinHash, now, now)
    .run();
}

export async function createSession(
  db: D1Database
): Promise<{ sessionId: string; expiresAt: number }> {
  const sessionId = generateToken();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await db
    .prepare(
      'INSERT INTO sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    )
    .bind(sessionId, DEFAULT_USER_ID, now, expiresAt)
    .run();
  return { sessionId, expiresAt };
}

export async function lookupSession(
  db: D1Database,
  sessionId: string
): Promise<{ userId: string; expiresAt: number } | null> {
  const row = await db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE session_id = ?')
    .bind(sessionId)
    .first<{ user_id: string; expires_at: number }>();
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE session_id = ?').bind(sessionId).run();
    return null;
  }
  return { userId: row.user_id, expiresAt: row.expires_at };
}

export async function destroySession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE session_id = ?').bind(sessionId).run();
}

export async function revokeAllSessions(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(DEFAULT_USER_ID).run();
}

export async function createAuthCode(
  db: D1Database,
  app: string
): Promise<{ code: string; expiresAt: number }> {
  const code = generateToken();
  const now = Date.now();
  const expiresAt = now + AUTH_CODE_TTL_MS;
  await db
    .prepare(
      'INSERT INTO auth_codes (code, user_id, app, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)'
    )
    .bind(code, DEFAULT_USER_ID, app, now, expiresAt)
    .run();
  return { code, expiresAt };
}

export async function consumeAuthCode(
  db: D1Database,
  code: string,
  app: string
): Promise<{ userId: string } | null> {
  const now = Date.now();
  const row = await db
    .prepare(
      'SELECT user_id, app, expires_at, used_at FROM auth_codes WHERE code = ?'
    )
    .bind(code)
    .first<{ user_id: string; app: string; expires_at: number; used_at: number | null }>();
  if (!row) return null;
  if (row.used_at !== null) return null;
  if (row.expires_at < now) return null;
  if (row.app !== app) return null;
  const result = await db
    .prepare('UPDATE auth_codes SET used_at = ? WHERE code = ? AND used_at IS NULL')
    .bind(now, code)
    .run();
  if ((result.meta?.changes ?? 0) === 0) return null;
  return { userId: row.user_id };
}

export async function deriveAppPinHash(
  pinHashHub: string,
  appId: string,
  pepper: string
): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${pinHashHub}:${appId}:${pepper}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return base64Url(new Uint8Array(buf));
}

export function readCookie(request: Request): string | null {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${COOKIE_NAME}=`)) {
      return trimmed.substring(COOKIE_NAME.length + 1);
    }
  }
  return null;
}

export function buildSessionCookie(sessionId: string, expiresAt: number): string {
  const expires = new Date(expiresAt).toUTCString();
  return `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`;
}

export function buildClearedSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export const COOKIE_NAME_CONST = COOKIE_NAME;
export const SESSION_TTL_MS_CONST = SESSION_TTL_MS;