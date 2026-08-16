/**
 * POST /games/api/remove {id} — elimina un juego de la lista. 204.
 */

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { removeGame } from '../../../lib/games/store';

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

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const id = (body.id ?? '').trim();
  if (!id) {
    return new Response(JSON.stringify({ error: 'id required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  await removeGame(env.AUTH_DB, sess.username, id);
  return new Response(null, { status: 204 });
};
