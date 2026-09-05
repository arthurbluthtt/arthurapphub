import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addMedia, isDuplicateTitle, isMediaType } from '../../../lib/media/store';
import { getMediaDetails } from '../../../lib/media/tmdb';
import { isSafePositiveInteger, jsonError, jsonResponse, mediaUsername, readJsonObject } from '../../../lib/media/api';

export const prerender = false;

function randomId(): string {
  // 12 chars base36
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 12);
}

export const POST: APIRoute = async ({ request }) => {
  const username = await mediaUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  const tmdbId = body.tmdbId;
  const mediaType = body.mediaType;
  if (!isSafePositiveInteger(tmdbId)) {
    return jsonError('invalid_tmdb_id', 400);
  }
  if (!isMediaType(mediaType)) {
    return jsonError('invalid_media_type', 400);
  }

  const apiKey = env.TMDB_API_KEY ?? '';
  if (!apiKey) {
    return jsonError('tmdb_not_configured', 503);
  }

  let details;
  try {
    details = await getMediaDetails(tmdbId, mediaType, apiKey);
  } catch (err) {
    console.error('TMDB details error:', err);
    return jsonError('tmdb_failed', 502);
  }
  if (!details) return jsonError('tmdb_not_found', 404);

  // Chequear duplicado por título (case-insensitive).
  if (await isDuplicateTitle(env.AUTH_DB, username, details.title)) {
    return jsonError('duplicate', 409);
  }

  const id = randomId();
  const result = await addMedia(
    env.AUTH_DB,
    username,
    {
      externalId: details.tmdbId,
      mediaType: details.mediaType,
      title: details.title,
      coverUrl: details.coverUrl,
      year: details.year,
      director: details.director,
      genre: details.genre,
    },
    id
  );
  if (result === 'duplicate') return jsonError('duplicate', 409);
  return jsonResponse({ media: result }, 201);
};
