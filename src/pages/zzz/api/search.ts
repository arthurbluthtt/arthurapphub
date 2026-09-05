import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { searchWEngines, searchDiscSets, searchAgents } from '../../../lib/zzz/data';
import { isZzzSpecialty, isZzzType, jsonError, jsonResponse, zzzUsername } from '../../../lib/zzz/api';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  if (!await zzzUsername(request, env.AUTH_DB)) return jsonError('unauthorized', 401);

  const q = (url.searchParams.get('q') ?? '').trim();
  const type = (url.searchParams.get('type') ?? 'wengine').trim(); // wengine | disc | agent
  if (!isZzzType(type)) return jsonError('invalid_type', 400);
  const specialtyValue = (url.searchParams.get('specialty') ?? '').trim();
  if (specialtyValue && (type !== 'wengine' || !isZzzSpecialty(specialtyValue))) {
    return jsonError('invalid_specialty', 400);
  }
  const specialty = specialtyValue || undefined;

  if (type === 'disc') {
    const results = searchDiscSets(q, 8);
    return jsonResponse({ results });
  }
  if (type === 'agent') {
    const results = searchAgents(q, 8);
    return jsonResponse({ results });
  }
  const results = searchWEngines(q, specialty, 8);
  return jsonResponse({ results });
};
