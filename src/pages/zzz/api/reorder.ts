import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { reorderZzz } from '../../../lib/zzz/store';
import { jsonError, jsonResponse, parseOrderedIds, readJsonObject, zzzUsername } from '../../../lib/zzz/api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const username = await zzzUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);
  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);
  const orderedIds = parseOrderedIds(body.orderedIds);
  if (orderedIds === undefined) return jsonError('invalid_ordered_ids', 400);
  const ok = await reorderZzz(env.AUTH_DB, username, orderedIds);
  if (!ok) return jsonError('ordered_ids_mismatch', 400);
  return jsonResponse({ ok: true });
};
