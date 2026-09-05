import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { findApp } from '../../../lib/apps';
import { lookupSession, readCookie } from '../../../lib/auth';
import { setAppArchived } from '../../../lib/app-archives';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return json({ error: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'invalid_body' }, 400);
  }

  const record = body as Record<string, unknown>;
  const appId = typeof record.appId === 'string' ? record.appId.trim() : '';
  if (!appId) return json({ error: 'invalid_app_id' }, 400);
  if (!findApp(appId)) return json({ error: 'unknown_app' }, 404);
  if (typeof record.archived !== 'boolean') return json({ error: 'invalid_archived' }, 400);

  await setAppArchived(env.AUTH_DB, sess.username, appId, record.archived);
  return json({ appId, archived: record.archived });
};
