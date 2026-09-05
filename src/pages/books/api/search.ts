import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { searchBooks } from '../../../lib/books/openlibrary';
import { bookUsername, jsonError, jsonResponse } from '../../../lib/books/api';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const username = await bookUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) return jsonResponse({ results: [] });

  try {
    const results = await searchBooks(q);
    return jsonResponse({ results });
  } catch (err) {
    console.error('Open Library search error:', err);
    return jsonError('openlibrary_failed', 502);
  }
};
