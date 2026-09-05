import { lookupSession, readCookie } from '../auth';

export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonError(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

export async function mangaUsername(
  request: Request,
  db: D1Database
): Promise<string | null> {
  const sessionToken = readCookie(request);
  if (!sessionToken) return null;
  const session = await lookupSession(db, sessionToken);
  return session?.username ?? null;
}

export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function parseOptionalUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return text;
  } catch {
    return undefined;
  }
}
