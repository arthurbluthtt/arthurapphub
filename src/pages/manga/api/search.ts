import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { searchManga } from '../../../lib/manga/kitsu';
import { jsonError, jsonResponse, mangaUsername } from '../../../lib/manga/api';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const username = await mangaUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) return jsonResponse({ results: [] });

  try {
    const results = await searchManga(q);
    return jsonResponse({ results });
  } catch (err) {
    console.error('Kitsu search error:', err);
    return jsonError('kitsu_failed', 502);
  }
};
