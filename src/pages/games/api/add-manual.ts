/**
 * POST /games/api/add-manual {name, year?, coverUrl?} — agrega un juego que
 * no está en Steam (app_id NULL). name obligatorio (1-80 chars); year entero
 * 1900-2100 opcional; coverUrl http(s) opcional (sin URL → placeholder).
 * Duplicado por nombre (case-insensitive) → 409.
 */

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { addGame, isDuplicateName } from '../../../lib/games/store';

export const prerender = false;

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function parseYear(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < MIN_YEAR || n > MAX_YEAR) return NaN;
  return n;
}

function parseCoverUrl(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:' || u.protocol === 'http:' ? trimmed : null;
  } catch {
    return null;
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
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
  if (coverUrl === null && body.coverUrl !== undefined && body.coverUrl !== null && String(body.coverUrl).trim() !== '') {
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

  const game = await addGame(
    env.AUTH_DB,
    sess.username,
    { appId: null, name, coverUrl, year },
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
