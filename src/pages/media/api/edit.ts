import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { editMedia, isDuplicateTitle, isMediaType, isStatus } from '../../../lib/media/store';
import type { EditPatch } from '../../../lib/media/store';
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

export const POST: APIRoute = async ({ request }) => {
  const username = await mediaUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return jsonError('invalid_id', 400);

  const patch: EditPatch = {};

  if ('mediaType' in body) {
    if (!isMediaType(body.mediaType)) return jsonError('invalid_media_type', 400);
    patch.mediaType = body.mediaType;
  }
  if ('title' in body) {
    if (typeof body.title !== 'string') return jsonError('invalid_title', 400);
    const t = body.title.trim();
    if (t.length < 1 || t.length > 120) {
      return jsonError('invalid_title', 400);
    }
    patch.title = t;
  }
  if ('year' in body) {
    const year = parseYear(body.year);
    if (year === undefined) return jsonError('invalid_year', 400);
    patch.year = year;
  }
  if ('coverUrl' in body) {
    const coverUrl = parseOptionalUrl(body.coverUrl);
    if (coverUrl === undefined) return jsonError('invalid_cover_url', 400);
    patch.coverUrl = coverUrl;
  }
  if ('director' in body) {
    const director = parseOptionalText(body.director, 120);
    if (director === undefined) return jsonError('invalid_director', 400);
    patch.director = director;
  }
  if ('genre' in body) {
    const genre = parseOptionalText(body.genre, 40);
    if (genre === undefined) return jsonError('invalid_genre', 400);
    patch.genre = genre;
  }
  if ('status' in body) {
    if (!isStatus(body.status)) return jsonError('invalid_status', 400);
    patch.status = body.status;
  }

  // Si se cambia el título, validar duplicado.
  if (patch.title != null) {
    if (await isDuplicateTitle(env.AUTH_DB, username, patch.title, id)) {
      return jsonError('duplicate', 409);
    }
  }

  const result = await editMedia(env.AUTH_DB, username, id, patch);
  if (result.ok) {
    return jsonResponse({ media: result.media });
  }
  if (result.reason === 'not-found') return jsonError('not_found', 404);
  if (result.reason === 'duplicate') return jsonError('duplicate', 409);
  return jsonError('no_fields', 400);
};
