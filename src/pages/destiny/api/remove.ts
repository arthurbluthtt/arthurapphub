import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { removeWishlist } from '../../../lib/d2/wishlist';
import { internalError, jsonOk, readJsonBody } from '../../../lib/internal';

export const prerender = false;

interface RemoveBody {
  itemHash: string;
}

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const body = await readJsonBody<RemoveBody>(request);
  if (!body?.itemHash) return internalError('missing itemHash', 400);

  const removed = await removeWishlist(env.AUTH_DB, sess.username, body.itemHash);
  if (!removed) return internalError('not found', 404);

  return new Response(null, { status: 204 });
};
