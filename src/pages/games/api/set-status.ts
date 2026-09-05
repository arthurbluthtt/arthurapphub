/**
 * POST /games/api/set-status {id, status} — cambia el estado de un juego.
 * status ∈ backlog | playing | finished. 404 si el juego no existe.
 */

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { setStatus, isStatus } from '../../../lib/games/store';

export const prerender = false;

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
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return new Response(JSON.stringify({ error: 'body must be an object' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const bodyRecord = body as Record<string, unknown>;
  const id = typeof bodyRecord.id === 'string' ? bodyRecord.id.trim() : '';
  if (!id) {
    return new Response(JSON.stringify({ error: 'id required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!isStatus(bodyRecord.status)) {
    return new Response(JSON.stringify({ error: 'invalid status' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const game = await setStatus(env.AUTH_DB, sess.username, id, bodyRecord.status);
  if (!game) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ ok: true, game }), {
    headers: { 'content-type': 'application/json' },
  });
};
