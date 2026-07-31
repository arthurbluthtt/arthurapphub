/**
 * Proxy de iconos para Umamusume.
 * Sirve desde R2 (binding D2_ASSETS) si está cacheado, sino descarga de game8 CDN
 * y guarda en R2 con cache-control 30 días.
 *
 * Query params:
 *   type=character|card
 *   id=<character_id o card game8Id>
 */

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { characters, cards } from '../../../lib/uma/data';

export const prerender = false;

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días
const R2_PREFIX = 'uma';

// Placeholder SVG inline.
// IMPORTANTE: NO usar fill="%23e4e4e7" (URL-encoded #). El body del response NO se
// URL-decodea, así que el parser SVG ve "%23e4e4e7" como color inválido → rect negro.
// Usar fill="#e4e4e7" directamente.
//
// Cacheamos el placeholder por 5 minutos (en vez de 30 días) para que un fix
// de formato se propague rápido sin esperar expiración de edge cache.
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#e4e4e7"/><text x="50%" y="58%" font-size="20" text-anchor="middle" fill="#71717a" font-family="sans-serif">?</text></svg>';
const PLACEHOLDER_HEADERS = {
  'content-type': 'image/svg+xml',
  'cache-control': 'public, max-age=300',
};

function placeholder(): Response {
  return new Response(PLACEHOLDER_SVG, { headers: PLACEHOLDER_HEADERS });
}

function lookupIcon(type: string, id: string): string | null {
  if (type === 'character') {
    return characters.find((c) => c.id === id)?.icon ?? null;
  }
  if (type === 'card') {
    return cards.find((c) => c.game8Id === id)?.icon ?? null;
  }
  return null;
}

function r2Key(type: string, id: string): string {
  return `${R2_PREFIX}/${type}s/${id}.png`;
}

export const GET: APIRoute = async ({ url }) => {
  const type = url.searchParams.get('type') ?? '';
  const id = url.searchParams.get('id') ?? '';
  if (!type || !id) {
    return new Response('missing type or id', { status: 400 });
  }
  if (type !== 'character' && type !== 'card') {
    return new Response('invalid type', { status: 400 });
  }

  const bucket = env.D2_ASSETS as R2Bucket | undefined;
  const key = r2Key(type, id);

  if (bucket) {
    const obj = await bucket.get(key);
    if (obj) {
      const headers = new Headers();
      headers.set('content-type', obj.httpMetadata?.contentType ?? 'image/png');
      headers.set('cache-control', `public, max-age=${CACHE_TTL_SECONDS}`);
      return new Response(obj.body, { headers });
    }
  }

  // No está en R2 → descargar de game8 CDN.
  const sourceUrl = lookupIcon(type, id);
  if (!sourceUrl) {
    // Carta o personaje sin URL de icono en el dataset → placeholder.
    return placeholder();
  }

  let upstream: Response;
  try {
    upstream = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'arthurapphub/1.0' },
    });
  } catch {
    return placeholder();
  }
  if (!upstream.ok) {
    return placeholder();
  }
  const buf = await upstream.arrayBuffer();

  // Guardar en R2 para la próxima request (fire-and-forget; no bloqueamos la respuesta).
  if (bucket) {
    bucket
      .put(key, buf, {
        httpMetadata: { contentType: 'image/png' },
      })
      .catch((err) => console.error('r2 put failed', key, err));
  }

  const headers = new Headers();
  headers.set('content-type', upstream.headers.get('content-type') ?? 'image/png');
  headers.set('cache-control', `public, max-age=${CACHE_TTL_SECONDS}`);
  return new Response(buf, { headers });
};