import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addAnime, isDuplicateTitle, isAnimeType } from '../../../lib/anime/store';
import {
  animeUsername,
  jsonError,
  jsonResponse,
  parseOptionalText,
  parseOptionalUrl,
  parseYear,
  readJsonObject,
} from '../../../lib/anime/api';

export const prerender = false;

function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 12);
}

export const POST: APIRoute = async ({ request }) => {
  const username = await animeUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  if (typeof body.title !== 'string') return jsonError('invalid_title', 400);
  const title = body.title.trim();
  if (title.length < 1 || title.length > 120) {
    return jsonError('invalid_title', 400);
  }

  const animeType = body.animeType;
  if (!isAnimeType(animeType)) {
    return jsonError('invalid_anime_type', 400);
  }

  const year = parseYear(body.year === undefined ? null : body.year);
  if (year === undefined) return jsonError('invalid_year', 400);

  const coverUrl = parseOptionalUrl(body.coverUrl === undefined ? null : body.coverUrl);
  if (coverUrl === undefined) return jsonError('invalid_cover_url', 400);

  const director = parseOptionalText(body.director === undefined ? null : body.director, 120);
  if (director === undefined) return jsonError('invalid_director', 400);
  const genre = parseOptionalText(body.genre === undefined ? null : body.genre, 40);
  if (genre === undefined) return jsonError('invalid_genre', 400);

  if (await isDuplicateTitle(env.AUTH_DB, username, title)) {
    return jsonError('duplicate', 409);
  }

  const id = randomId();
  const result = await addAnime(
    env.AUTH_DB,
    username,
    { externalId: null, animeType, title, coverUrl, year, director, genre },
    id
  );
  if (result === 'duplicate') return jsonError('duplicate', 409);
  return jsonResponse({ anime: result }, 201);
};
