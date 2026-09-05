import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addBook, isDuplicateTitle, isBookType } from '../../../lib/books/store';
import { bookUsername, jsonError, jsonResponse, parseOptionalUrl, readJsonObject } from '../../../lib/books/api';

export const prerender = false;

function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 12);
}

export const POST: APIRoute = async ({ request }) => {
  const username = await bookUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  if (typeof body.title !== 'string') return jsonError('invalid_title', 400);
  const title = body.title.trim();
  if (title.length < 1 || title.length > 120) {
    return jsonError('invalid_title', 400);
  }

  const bookType = body.bookType;
  if (!isBookType(bookType)) {
    return jsonError('invalid_book_type', 400);
  }

  const coverUrl = body.coverUrl === undefined ? null : parseOptionalUrl(body.coverUrl);
  if (coverUrl === undefined) {
    return jsonError('invalid_cover_url', 400);
  }

  if (await isDuplicateTitle(env.AUTH_DB, username, title)) {
    return jsonError('duplicate', 409);
  }

  const id = randomId();
  const result = await addBook(
    env.AUTH_DB,
    username,
    { externalId: null, bookType, title, coverUrl },
    id
  );
  if (result === 'duplicate') return jsonError('duplicate', 409);
  return jsonResponse({ book: result }, 201);
};
