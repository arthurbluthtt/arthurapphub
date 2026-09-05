import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { searchMedia } from '../../../lib/media/tmdb';
import { jsonError, jsonResponse, mediaUsername } from '../../../lib/media/api';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const username = await mediaUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) return jsonResponse({ results: [] });

  const apiKey = env.TMDB_API_KEY ?? '';
  if (!apiKey) {
    return jsonError('tmdb_not_configured', 503);
  }

  try {
    const results = await searchMedia(q, apiKey);
    return jsonResponse({ results });
  } catch (err) {
    console.error('TMDB search error:', err);
    return jsonError('tmdb_failed', 502);
  }
};
