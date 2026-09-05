import type { APIRoute } from 'astro';
import { searchCharacters } from '../../../lib/uma/data';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q') ?? '';
  const rawLimit = url.searchParams.get('limit');
  const parsedLimit = rawLimit === null ? Number.NaN : Number(rawLimit);
  const limit = Number.isInteger(parsedLimit)
    ? Math.min(30, Math.max(1, parsedLimit))
    : 10;
  const results = searchCharacters(q, limit);
  return new Response(JSON.stringify({ results }), {
    headers: { 'content-type': 'application/json' },
  });
};
