import type { APIRoute } from 'astro';
import { searchCharacters } from '../../../lib/uma/data';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q') ?? '';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 10) || 10, 30);
  const results = searchCharacters(q, limit);
  return new Response(JSON.stringify({ results }), {
    headers: { 'content-type': 'application/json' },
  });
};