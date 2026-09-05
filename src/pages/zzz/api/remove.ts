import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { removeZzz } from '../../../lib/zzz/store';
import { jsonError, parseText, readJsonObject, zzzUsername } from '../../../lib/zzz/api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const username = await zzzUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);
  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);
  const id = parseText(body.id, 1, 100);
  if (id === undefined) return jsonError('invalid_id', 400);
  const ok = await removeZzz(env.AUTH_DB, username, id);
  if (!ok) return jsonError('not_found', 404);
  return new Response(null, { status: 204 });
};
