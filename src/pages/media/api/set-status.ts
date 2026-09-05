import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { setMediaStatus, isStatus } from '../../../lib/media/store';
import { jsonError, jsonResponse, mediaUsername, readJsonObject } from '../../../lib/media/api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const username = await mediaUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const status = body.status;
  if (!id) return jsonError('invalid_id', 400);
  if (!isStatus(status)) return jsonError('invalid_status', 400);

  const row = await setMediaStatus(env.AUTH_DB, username, id, status);
  if (!row) return jsonError('not_found', 404);
  return jsonResponse({ media: row });
};
