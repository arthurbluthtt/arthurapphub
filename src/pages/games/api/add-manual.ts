/**
 * POST /games/api/add-manual {name, year?, coverUrl?, saga?} — agrega un juego que
 * no está en Steam (app_id NULL). name obligatorio (1-80 chars); year entero
 * 1900-2100 opcional; coverUrl http(s) opcional (sin URL → placeholder);
 * saga texto libre de hasta 60 caracteres.
 * Duplicado por nombre (case-insensitive) → 409.
 */

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { addGame, isDuplicateName } from '../../../lib/games/store';

export const prerender = false;

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const INVALID_COVER_URL = Symbol('invalid-cover-url');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseYear(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < MIN_YEAR || v > MAX_YEAR) {
    return NaN;
  }
  return v;
}

function parseCoverUrl(v: unknown): string | null | typeof INVALID_COVER_URL {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return INVALID_COVER_URL;
  const trimmed = v.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:' || u.protocol === 'http:' ? trimmed : INVALID_COVER_URL;
  } catch {
    return INVALID_COVER_URL;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!isRecord(body)) {
    return new Response(JSON.stringify({ error: 'body must be an object' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) {
    return new Response(JSON.stringify({ error: 'name required (1-80 chars)' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const year = parseYear(body.year);
  if (Number.isNaN(year)) {
    return new Response(JSON.stringify({ error: 'year must be 1900-2100' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const coverUrl = parseCoverUrl(body.coverUrl);
  if (coverUrl === INVALID_COVER_URL) {
    return new Response(JSON.stringify({ error: 'invalid coverUrl' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (await isDuplicateName(env.AUTH_DB, sess.username, name)) {
    return new Response(JSON.stringify({ error: 'duplicate' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    });
  }

  // `saga` opcional. Trim, max 60 chars. Si no se manda o queda vacío → null.
  let saga: string | null = null;
  if (body.saga !== undefined && body.saga !== null && body.saga !== '') {
    if (typeof body.saga !== 'string') {
      return new Response(JSON.stringify({ error: 'saga must be a string' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    const raw = body.saga.trim();
    if (raw.length > 60) {
      return new Response(JSON.stringify({ error: 'saga must be 0-60 chars' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (raw.length > 0) saga = raw;
  }

  const game = await addGame(
    env.AUTH_DB,
    sess.username,
    { appId: null, name, coverUrl, year, saga },
    crypto.randomUUID()
  );
  if (game === 'duplicate') {
    return new Response(JSON.stringify({ error: 'duplicate' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ ok: true, game }), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  });
};
