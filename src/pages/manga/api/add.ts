import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addManga, isDuplicateTitle, isMangaType } from '../../../lib/manga/store';
import { getMangaDetails } from '../../../lib/manga/kitsu';
import {
  isSafePositiveInteger,
  jsonError,
  jsonResponse,
  mangaUsername,
  readJsonObject,
} from '../../../lib/manga/api';

export const prerender = false;

function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 12);
}

export const POST: APIRoute = async ({ request }) => {
  const username = await mangaUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  const kitsuId = body.kitsuId;
  const mangaType = body.mangaType;
  if (!isSafePositiveInteger(kitsuId)) {
    return jsonError('invalid_kitsu_id', 400);
  }
  if (!isMangaType(mangaType)) {
    return jsonError('invalid_manga_type', 400);
  }

  let details;
  try {
    details = await getMangaDetails(kitsuId, mangaType);
  } catch (err) {
    console.error('Kitsu details error:', err);
    return jsonError('kitsu_failed', 502);
  }
  if (!details) return jsonError('kitsu_not_found', 404);

  if (await isDuplicateTitle(env.AUTH_DB, username, details.title)) {
    return jsonError('duplicate', 409);
  }

  const id = randomId();
  const result = await addManga(
    env.AUTH_DB,
    username,
    {
      externalId: details.kitsuId,
      mangaType: details.mangaType,
      title: details.title,
      coverUrl: details.coverUrl,
    },
    id
  );
  if (result === 'duplicate') return jsonError('duplicate', 409);
  return jsonResponse({ manga: result }, 201);
};
