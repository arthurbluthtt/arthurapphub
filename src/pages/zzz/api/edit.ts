import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { editZzz, isDuplicateCharacter } from '../../../lib/zzz/store';
import type { EditPatch } from '../../../lib/zzz/store';
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

export const POST: APIRoute = async ({ request }) => {
  const username = await zzzUsername(request, env.AUTH_DB);
  if (!username) return jsonError('unauthorized', 401);

  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);
  const id = parseText(body.id, 1, 100);
  if (id === undefined) return jsonError('invalid_id', 400);

  const patch: EditPatch = {};

  if ('characterName' in body) {
    const characterName = parseText(body.characterName, 1, 80);
    if (characterName === undefined) return jsonError('invalid_character_name', 400);
    if (await isDuplicateCharacter(env.AUTH_DB, username, characterName, id)) return jsonError('duplicate', 409);
    patch.characterName = characterName;
  }
  if ('coverUrl' in body) {
    const coverUrl = parseOptionalUrl(body.coverUrl);
    if (coverUrl === undefined) return jsonError('invalid_cover_url', 400);
    patch.coverUrl = coverUrl;
  }
  let parsedWEngineName: string | null | undefined;
  if ('wEngineName' in body) {
    parsedWEngineName = parseWEngineName(body.wEngineName);
    if (parsedWEngineName === undefined) return jsonError('invalid_w_engine_name', 400);
  }
  if ('wEngineId' in body) {
    const wEngine = parseWEngine(body.wEngineId);
    if (wEngine === undefined) return jsonError('invalid_w_engine_id', 400);
    if (wEngine && parsedWEngineName && wEngine.name !== parsedWEngineName) {
      return jsonError('invalid_w_engine_name', 400);
    }
    patch.wEngineId = wEngine?.id ?? null;
    patch.wEngineName = wEngine?.name ?? parsedWEngineName ?? null;
  } else if ('wEngineName' in body) {
    patch.wEngineName = parsedWEngineName ?? null;
  }
  if ('discSet4' in body) {
    const discSet4 = parseDiscSet(body.discSet4);
    if (discSet4 === undefined) return jsonError('invalid_disc_set_4', 400);
    patch.discSet4 = discSet4;
  }
  if ('discSet2' in body) {
    const discSet2 = parseDiscSet(body.discSet2);
    if (discSet2 === undefined) return jsonError('invalid_disc_set_2', 400);
    patch.discSet2 = discSet2;
  }
  if ('discs' in body) {
    const discs = parseDiscs(body.discs);
    if (discs === undefined) return jsonError('invalid_discs', 400);
    patch.discs = discs;
  }
  if ('statValues' in body) {
    const statValues = parseStatValues(body.statValues);
    if (statValues === undefined) return jsonError('invalid_stat_values', 400);
    patch.statValues = statValues;
  } else if ('displayStats' in body) {
    const statValues = parseLegacyStats(body.displayStats);
    if (statValues === undefined) return jsonError('invalid_display_stats', 400);
    patch.statValues = statValues;
  }

  const result = await editZzz(env.AUTH_DB, username, id, patch);
  if (result.ok) return jsonResponse({ build: result.build });
  if (result.reason === 'not-found') return jsonError('not_found', 404);
  if (result.reason === 'duplicate') return jsonError('duplicate', 409);
  return jsonError('no_fields', 400);
};
