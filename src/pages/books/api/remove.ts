import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { removeBook } from '../../../lib/books/store';
import { bookUsername, jsonError, readJsonObject } from '../../../lib/books/api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const username = await bookUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return jsonError('invalid_id', 400);

  const ok = await removeBook(env.AUTH_DB, username, id);
  if (!ok) return jsonError('not_found', 404);
  return new Response(null, { status: 204 });
};
