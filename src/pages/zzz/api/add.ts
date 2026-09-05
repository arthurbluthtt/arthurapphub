import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addZzz, isDuplicateCharacter } from '../../../lib/zzz/store';
import {
  jsonError,
  jsonResponse,
  parseDiscSet,
  parseDiscs,
  parseLegacyStats,
  parseOptionalUrl,
  parseStatValues,
  parseText,
  parseWEngine,
  parseWEngineName,
  readJsonObject,
  zzzUsername,
} from '../../../lib/zzz/api';

export const prerender = false;

function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 12);
}

export const POST: APIRoute = async ({ request }) => {
  const username = await zzzUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  const characterName = parseText(body.characterName, 1, 80);
  if (characterName === undefined) return jsonError('invalid_character_name', 400);

  const coverUrl = parseOptionalUrl(body.coverUrl);
  if (coverUrl === undefined) return jsonError('invalid_cover_url', 400);

  const wEngine = parseWEngine(body.wEngineId);
  if (wEngine === undefined) return jsonError('invalid_w_engine_id', 400);
  const wEngineId = wEngine?.id ?? null;
  let wEngineName = wEngine?.name ?? null;
  if ('wEngineName' in body) {
    const parsedName = parseWEngineName(body.wEngineName);
    if (parsedName === undefined) return jsonError('invalid_w_engine_name', 400);
    if (wEngine && parsedName !== wEngine.name) return jsonError('invalid_w_engine_name', 400);
    if (!wEngine) wEngineName = parsedName;
  }

  const discSet4 = parseDiscSet(body.discSet4);
  if (discSet4 === undefined) return jsonError('invalid_disc_set_4', 400);
  const discSet2 = parseDiscSet(body.discSet2);
  if (discSet2 === undefined) return jsonError('invalid_disc_set_2', 400);

  const discs = 'discs' in body ? parseDiscs(body.discs) : null;
  if (discs === undefined) return jsonError('invalid_discs', 400);

  const statValues = 'statValues' in body
    ? parseStatValues(body.statValues)
    : 'displayStats' in body
      ? parseLegacyStats(body.displayStats)
      : [];
  if (statValues === undefined) return jsonError('invalid_stat_values', 400);

  if (await isDuplicateCharacter(env.AUTH_DB, username, characterName)) {
    return jsonError('duplicate', 409);
  }

  const id = randomId();
  const result = await addZzz(env.AUTH_DB, username, {
    characterName,
    coverUrl,
    wEngineId,
    wEngineName,
    discSet4,
    discSet2,
    discs,
    statValues,
  }, id);

  if (result === 'duplicate') return jsonError('duplicate', 409);
  return jsonResponse({ build: result }, 201);
};
