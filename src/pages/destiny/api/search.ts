import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { searchWeapons } from '../../../lib/d2/manifest';
import { jsonOk } from '../../../lib/internal';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const q = url.searchParams.get('q') ?? '';
  const weapon = searchWeapons(q);
  return jsonOk({ result: weapon });
};
