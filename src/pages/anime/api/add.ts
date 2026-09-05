import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addAnime, isDuplicateTitle, isAnimeType } from '../../../lib/anime/store';
import { getAnimeDetails } from '../../../lib/anime/kitsu';
import {
  animeUsername,
  isSafePositiveInteger,
  jsonError,
  jsonResponse,
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

  const kitsuId = body.kitsuId;
  const animeType = body.animeType;
  if (!isSafePositiveInteger(kitsuId)) return jsonError('invalid_kitsu_id', 400);
  if (!isAnimeType(animeType)) {
    return jsonError('invalid_anime_type', 400);
  }

  let details;
  try {
    details = await getAnimeDetails(kitsuId, animeType);
  } catch (err) {
    console.error('Kitsu anime details error:', err);
    return jsonError('kitsu_failed', 502);
  }
  if (!details) return jsonError('kitsu_not_found', 404);

  if (await isDuplicateTitle(env.AUTH_DB, username, details.title)) {
    return jsonError('duplicate', 409);
  }

  const id = randomId();
  const result = await addAnime(
    env.AUTH_DB,
    username,
    {
      externalId: details.kitsuId,
      animeType: details.animeType,
      title: details.title,
      coverUrl: details.coverUrl,
      year: details.year,
      director: details.director,
      genre: details.genre,
    },
    id
  );
  if (result === 'duplicate') return jsonError('duplicate', 409);
  return jsonResponse({ anime: result }, 201);
};
