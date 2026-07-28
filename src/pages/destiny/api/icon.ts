import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { bungieCdnUrl, getPerk, getWeapon } from '../../../lib/d2/manifest';

export const prerender = false;

const ONE_PIXEL_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

function placeholder(): Response {
  return new Response(ONE_PIXEL_PNG, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return new Response('unauthenticated', { status: 401 });

  const type = url.searchParams.get('type');
  const hash = url.searchParams.get('hash');
  if (!type || !hash) return new Response('missing params', { status: 400 });
  if (type !== 'weapon' && type !== 'perk') {
    return new Response('invalid type', { status: 400 });
  }

  const key = `${type === 'weapon' ? 'weapons' : 'perks'}/${hash}.png`;
  const cached = await env.D2_ASSETS.get(key);
  if (cached) {
    return new Response(cached.body, {
      headers: {
        'Content-Type': cached.httpMetadata?.contentType ?? 'image/png',
        'Cache-Control': 'public, max-age=2592000, immutable',
      },
    });
  }

  const def = type === 'weapon' ? getWeapon(hash) : getPerk(hash);
  const cdnUrl = bungieCdnUrl(def?.icon);
  if (!cdnUrl) return placeholder();

  try {
    const upstream = await fetch(cdnUrl, {
      headers: { 'X-API-Key': env.BUNGIE_API_KEY },
      cf: { cacheTtl: 86400, cacheEverything: true },
    } as RequestInit);
    if (!upstream.ok) return placeholder();

    const buf = await upstream.arrayBuffer();
    await env.D2_ASSETS.put(key, buf, {
      httpMetadata: { contentType: 'image/png' },
    });
    return new Response(buf, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=2592000, immutable',
      },
    });
  } catch {
    return placeholder();
  }
};
