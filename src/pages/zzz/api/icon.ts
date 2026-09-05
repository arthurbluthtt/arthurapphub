import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isZzzType, jsonError } from '../../../lib/zzz/api';
import { getAgentById, getAgentByName, getDiscSetById, getDiscSetByName, getWEngineById } from '../../../lib/zzz/data';

export const prerender = false;

const R2_PREFIX = 'zzz';
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#e4e4e7"/></svg>`;
const PLACEHOLDER_HEADERS = { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' };

export const GET: APIRoute = async ({ url }) => {
  const type = url.searchParams.get('type'); // agent | wengine | disc
  const id = url.searchParams.get('id');
  if (!id || !type) return jsonError('invalid_icon_request', 400);
  if (!isZzzType(type)) return jsonError('invalid_type', 400);
  const requestedId = id.trim();
  if (!requestedId) return jsonError('invalid_id', 400);

  let iconUrl: string | null = null;
  let assetId = requestedId;
  if (type === 'wengine') {
    const w = getWEngineById(requestedId);
    iconUrl = w?.icon ?? null;
    assetId = w?.id ?? assetId;
  } else if (type === 'agent') {
    const a = getAgentById(requestedId) ?? getAgentByName(requestedId) ?? null;
    iconUrl = a?.icon ?? null;
    assetId = a?.id ?? assetId;
  } else if (type === 'disc') {
    const ds = getDiscSetById(requestedId) ?? getDiscSetByName(requestedId);
    iconUrl = ds?.icon ?? null;
    assetId = ds?.id ?? assetId;
  }
  if (!iconUrl) {
    return new Response(PLACEHOLDER_SVG, { headers: PLACEHOLDER_HEADERS });
  }

  const key = `${R2_PREFIX}/${type}/${assetId}.png`;
  const bucket = env.D2_ASSETS;
  if (bucket) {
    const cached = await bucket.get(key);
    if (cached) {
      return new Response(cached.body, {
        headers: {
          'Content-Type': cached.httpMetadata?.contentType ?? 'image/png',
          'Cache-Control': 'public, max-age=2592000, immutable',
        },
      });
    }
  }
  try {
    const res = await fetch(iconUrl, { headers: { 'User-Agent': 'arthurapphub/1.0' } });
    if (!res.ok) return new Response(PLACEHOLDER_SVG, { headers: PLACEHOLDER_HEADERS });
    const buf = await res.arrayBuffer();
    if (bucket) {
      bucket.put(key, buf, { httpMetadata: { contentType: res.headers.get('content-type') ?? 'image/png' } }).catch(() => {});
    }
    return new Response(buf, {
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'public, max-age=2592000, immutable',
      },
    });
  } catch {
    return new Response(PLACEHOLDER_SVG, { headers: PLACEHOLDER_HEADERS });
  }
};
