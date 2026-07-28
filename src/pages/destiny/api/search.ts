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
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? 10)));
  const results = searchWeapons(q, limit).map((w) => ({
    hash: w.hash,
    name: w.name,
    icon: w.icon,
    damage: w.damage,
    tier: w.tier,
  }));
  return jsonOk({ results });
};
