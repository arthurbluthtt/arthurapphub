import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { editBook, isDuplicateTitle, isBookType, isStatus } from '../../../lib/books/store';
import type { EditPatch } from '../../../lib/books/store';
import { bookUsername, jsonError, jsonResponse, parseOptionalUrl, readJsonObject } from '../../../lib/books/api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const username = await bookUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return jsonError('invalid_id', 400);

  const patch: EditPatch = {};

  if ('title' in body) {
    if (typeof body.title !== 'string') return jsonError('invalid_title', 400);
    const t = body.title.trim();
    if (t.length < 1 || t.length > 120) {
      return jsonError('invalid_title', 400);
    }
    patch.title = t;
  }
  if ('bookType' in body) {
    if (!isBookType(body.bookType)) return jsonError('invalid_book_type', 400);
    patch.bookType = body.bookType;
  }
  if ('coverUrl' in body) {
    const coverUrl = parseOptionalUrl(body.coverUrl);
    if (coverUrl === undefined) return jsonError('invalid_cover_url', 400);
    patch.coverUrl = coverUrl;
  }
  if ('status' in body) {
    if (!isStatus(body.status)) return jsonError('invalid_status', 400);
    patch.status = body.status;
  }

  if (patch.title !== undefined) {
    if (await isDuplicateTitle(env.AUTH_DB, username, patch.title, id)) {
      return jsonError('duplicate', 409);
    }
  }

  const result = await editBook(env.AUTH_DB, username, id, patch);
  if (result.ok) {
    return jsonResponse({ book: result.book });
  }
  if (result.reason === 'not-found') return jsonError('not_found', 404);
  if (result.reason === 'duplicate') return jsonError('duplicate', 409);
  return jsonError('no_fields', 400);
};
