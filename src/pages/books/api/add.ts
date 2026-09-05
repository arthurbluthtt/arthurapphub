import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addBook, isDuplicateTitle, isBookType } from '../../../lib/books/store';
import { getBookDetails } from '../../../lib/books/openlibrary';
import { bookUsername, jsonError, jsonResponse, readJsonObject } from '../../../lib/books/api';

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

  const olid = body.olid;
  const bookType = body.bookType;
  if (typeof olid !== 'string' || !olid.trim()) {
    return jsonError('invalid_olid', 400);
  }
  if (!isBookType(bookType)) {
    return jsonError('invalid_book_type', 400);
  }

  let details;
  try {
    details = await getBookDetails(olid.trim(), bookType);
  } catch (err) {
    console.error('Open Library details error:', err);
    return jsonError('openlibrary_failed', 502);
  }
  if (!details) return jsonError('openlibrary_not_found', 404);

  if (await isDuplicateTitle(env.AUTH_DB, username, details.title)) {
    return jsonError('duplicate', 409);
  }

  const id = randomId();
  const result = await addBook(
    env.AUTH_DB,
    username,
    {
      externalId: details.olid,
      bookType: details.bookType,
      title: details.title,
      coverUrl: details.coverUrl,
    },
    id
  );
  if (result === 'duplicate') return jsonError('duplicate', 409);
  return jsonResponse({ book: result }, 201);
};
