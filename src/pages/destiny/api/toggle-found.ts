import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { toggleFound } from '../../../lib/d2/wishlist';
import { internalError, jsonOk, readJsonBody } from '../../../lib/internal';

export const prerender = false;

interface Body {
  itemHash: string;
}

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const body = await readJsonBody<Body>(request);
  if (!body?.itemHash) return internalError('missing itemHash', 400);

  const result = await toggleFound(env.AUTH_DB, sess.username, body.itemHash);
  if (!result) return internalError('not found', 404);

  return jsonOk(result);
};
