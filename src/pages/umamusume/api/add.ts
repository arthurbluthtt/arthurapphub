import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { addWishlist } from '../../../lib/uma/wishlist';
import { getCharacter } from '../../../lib/uma/data';

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

  let body: { characterId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const characterId = (body.characterId ?? '').trim();
  if (!characterId) {
    return new Response(JSON.stringify({ error: 'characterId required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const char = getCharacter(characterId);
  if (!char) {
    return new Response(JSON.stringify({ error: 'unknown character' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  const result = await addWishlist(env.AUTH_DB, sess.username, characterId);
  if (result === 'duplicate') {
    return new Response(JSON.stringify({ error: 'duplicate' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ ok: true, character: char }), {
    headers: { 'content-type': 'application/json' },
  });
};