/**
 * GET /games/api/search?q= — busca juegos en Steam.
 *
 * Proxy a `store.steampowered.com/api/storesearch/` (sin API key). Filtra
 * `type === "app"` (excluye bundles/subs) y devuelve el top 8 con
 * `{appId, name, tinyImage}` (tiny_image = capsule 231x87 para el dropdown).
 */

import type { APIRoute } from 'astro';

export const prerender = false;

const STEAM_SEARCH_URL = 'https://store.steampowered.com/api/storesearch/';
const MAX_RESULTS = 8;

interface SteamSearchItem {
  type?: string;
  name?: string;
  id?: number;
  tiny_image?: string;
}

export const GET: APIRoute = async ({ url }) => {
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

  let data: { items?: SteamSearchItem[] };
  try {
    data = (await upstream.json()) as { items?: SteamSearchItem[] };
  } catch {
    return new Response(JSON.stringify({ error: 'steam invalid json' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const results = (data.items ?? [])
    .filter(
      (i) => i.type === 'app' && typeof i.id === 'number' && typeof i.name === 'string'
    )
    .slice(0, MAX_RESULTS)
    .map((i) => ({
      appId: i.id as number,
      name: i.name as string,
      tinyImage: i.tiny_image ?? null,
    }));

  return new Response(JSON.stringify({ results }), {
    headers: { 'content-type': 'application/json' },
  });
};
