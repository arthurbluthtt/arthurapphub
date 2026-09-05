import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addMedia, isDuplicateTitle, isMediaType } from '../../../lib/media/store';
import {
  jsonError,
  jsonResponse,
  mediaUsername,
  parseOptionalText,
  parseOptionalUrl,
  parseYear,
  readJsonObject,
} from '../../../lib/media/api';

export const prerender = false;

function randomId(): string {
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

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length < 1 || title.length > 120) {
    return jsonError('invalid_title', 400);
  }

  const mediaType = body.mediaType;
  if (!isMediaType(mediaType)) {
    return jsonError('invalid_media_type', 400);
  }

  const year = body.year === undefined ? null : parseYear(body.year);
  if (year === undefined) {
    return jsonError('invalid_year', 400);
  }

  const coverUrl = body.coverUrl === undefined ? null : parseOptionalUrl(body.coverUrl);
  if (coverUrl === undefined) {
    return jsonError('invalid_cover_url', 400);
  }

  const director = body.director === undefined ? null : parseOptionalText(body.director, 120);
  if (director === undefined) return jsonError('invalid_director', 400);
  const genre = body.genre === undefined ? null : parseOptionalText(body.genre, 40);
  if (genre === undefined) return jsonError('invalid_genre', 400);

  if (await isDuplicateTitle(env.AUTH_DB, username, title)) {
    return jsonError('duplicate', 409);
  }

  const id = randomId();
  const result = await addMedia(
    env.AUTH_DB,
    username,
    { externalId: null, mediaType, title, coverUrl, year, director, genre },
    id
  );
  if (result === 'duplicate') return jsonError('duplicate', 409);
  return jsonResponse({ media: result }, 201);
};
