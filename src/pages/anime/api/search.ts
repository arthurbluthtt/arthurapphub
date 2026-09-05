import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { searchAnime } from '../../../lib/anime/kitsu';
import { animeUsername, jsonError, jsonResponse } from '../../../lib/anime/api';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!await animeUsername(request, env.AUTH_DB)) return jsonError('unauthorized', 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) return jsonResponse({ results: [] });

  try {
    const results = await searchAnime(q);
    return jsonResponse({ results });
  } catch (err) {
    console.error('Kitsu anime search error:', err);
    return jsonError('kitsu_failed', 502);
  }
};
