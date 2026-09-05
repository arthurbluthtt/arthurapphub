/**
 * GET /games/api/search?q= — busca juegos en Steam.
 *
 * Proxy a `store.steampowered.com/api/storesearch/` (sin API key). Filtra
 * `type === "app"` (excluye bundles/subs) y devuelve el top 8 con
 * `{appId, name, tinyImage}` (tiny_image = capsule 231x87 para el dropdown).
 */

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';

export const prerender = false;

const STEAM_SEARCH_URL = 'https://store.steampowered.com/api/storesearch/';
const MAX_RESULTS = 8;

interface SteamSearchItem {
  type?: unknown;
  name?: unknown;
  id?: unknown;
  tiny_image?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const GET: APIRoute = async ({ request, url }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return new Response('Unauthorized', { status: 401 });

  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${STEAM_SEARCH_URL}?term=${encodeURIComponent(q)}&cc=us&l=english`,
      { headers: { 'User-Agent': 'arthurapphub/1.0' } }
    );
  } catch {
    return new Response(JSON.stringify({ error: 'steam unreachable' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: `steam error ${upstream.status}` }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return new Response(JSON.stringify({ error: 'steam invalid json' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return new Response(JSON.stringify({ error: 'steam invalid response' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const results = (payload.items as unknown[])
    .filter((i): i is SteamSearchItem => isRecord(i))
    .filter(
      (i) =>
        i.type === 'app' &&
        typeof i.id === 'number' &&
        Number.isSafeInteger(i.id) &&
        i.id > 0 &&
        typeof i.name === 'string'
    )
    .slice(0, MAX_RESULTS)
    .map((i) => ({
      appId: i.id as number,
      name: i.name as string,
      tinyImage: typeof i.tiny_image === 'string' ? i.tiny_image : null,
    }));

  return new Response(JSON.stringify({ results }), {
    headers: { 'content-type': 'application/json' },
  });
};
