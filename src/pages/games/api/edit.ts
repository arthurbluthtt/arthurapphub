/**
 * POST /games/api/edit {id, name?, year?, coverUrl?, saga?} — edita campos editables
 * de un juego del usuario. Solo se actualizan los campos provistos (partial
 * update). Mismas validaciones que add-manual:
 *   - name: 1-80 chars (si se provee)
 *   - year: 1900-2100 o null (si se provee)
 *   - coverUrl: http(s) o null (si se provee)
 * Ownership: el game debe pertenecer al username de la sesión.
 * Duplicado por nombre (case-insensitive, distinto id) → 409.
 */

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { editGame, isDuplicateName } from '../../../lib/games/store';

export const prerender = false;

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const INVALID_URL = Symbol('invalid-url');

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

function parseCoverUrl(v: unknown): string | null | typeof INVALID_URL {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') return INVALID_URL;
  const trimmed = v.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return INVALID_URL;
    return trimmed;
  } catch {
    return INVALID_URL;
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

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) {
    return new Response(JSON.stringify({ error: 'id required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const patch: { name?: string; year?: number | null; coverUrl?: string | null; saga?: string | null } = {};

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 80) {
      return new Response(JSON.stringify({ error: 'name must be 1-80 chars' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    patch.name = name;
  }
  if ('year' in body) {
    const year = parseYear(body.year);
    if (Number.isNaN(year)) {
      return new Response(JSON.stringify({ error: 'year must be 1900-2100' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    patch.year = year;
  }
  if ('coverUrl' in body) {
    const coverUrl = parseCoverUrl(body.coverUrl);
    if (coverUrl === INVALID_URL) {
      return new Response(JSON.stringify({ error: 'invalid coverUrl (must be http(s)://)' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    patch.coverUrl = coverUrl;
  }
  if ('saga' in body) {
    if (body.saga == null || body.saga === '') {
      patch.saga = null;
    } else {
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
      patch.saga = raw.length > 0 ? raw : null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return new Response(JSON.stringify({ error: 'no editable fields provided' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (patch.name && (await isDuplicateName(env.AUTH_DB, sess.username, patch.name, id))) {
    return new Response(JSON.stringify({ error: 'duplicate' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    });
  }

  const result = await editGame(env.AUTH_DB, sess.username, id, patch);
  if (!result.ok) {
    const status =
      result.reason === 'not-found' ? 404 :
      result.reason === 'duplicate' ? 409 : 400;
    return new Response(JSON.stringify({ error: result.reason }), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ ok: true, game: result.game }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
