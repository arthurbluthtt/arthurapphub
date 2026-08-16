/**
 * POST /games/api/add {appId} — agrega un juego a la lista.
 *
 * Busca el detalle en Steam (`appdetails?filters=basic,release_date`, sin API
 * key): valida `type === "game"`, y guarda name + header_image (cover) + año
 * (parseado de release_date, e.g. "20 Feb, 2024" → 2024). Status inicial:
 * "backlog" (Por jugar). 409 si el appid ya está en la lista del usuario.
 */

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { addGame } from '../../../lib/games/store';

export const prerender = false;

const STEAM_DETAILS_URL = 'https://store.steampowered.com/api/appdetails';

interface SteamDetails {
  [appid: string]: {
    success?: boolean;
    data?: {
      type?: string;
      name?: string;
      header_image?: string;
      release_date?: { date?: string };
    };
  };
}

// "20 Feb, 2024" → 2024. "Q4 2025" → 2025. Sin año → null.
function parseYear(date: string | undefined): number | null {
  if (!date) return null;
  const m = date.match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: { appId?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const appId = Number(body.appId);
  if (!Number.isInteger(appId) || appId <= 0) {
    return new Response(JSON.stringify({ error: 'appId required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${STEAM_DETAILS_URL}?appids=${appId}&l=english&filters=basic,release_date`,
      { headers: { 'User-Agent': 'arthurapphub/1.0' } }
    );
  } catch {
    return new Response(JSON.stringify({ error: 'steam unreachable' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: 'steam error' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  let details: SteamDetails;
  try {
    details = (await upstream.json()) as SteamDetails;
  } catch {
    return new Response(JSON.stringify({ error: 'steam invalid json' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
  const data = details[String(appId)]?.success ? details[String(appId)].data : undefined;
  if (!data?.name || !data.header_image) {
    return new Response(JSON.stringify({ error: 'not found on steam' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (data.type && data.type !== 'game') {
    return new Response(JSON.stringify({ error: `not a game (${data.type})` }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const result = await addGame(
    env.AUTH_DB,
    sess.username,
    {
      appId,
      name: data.name,
      coverUrl: data.header_image,
      year: parseYear(data.release_date?.date),
    },
    crypto.randomUUID()
  );
  if (result === 'duplicate') {
    return new Response(JSON.stringify({ error: 'duplicate' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ ok: true, game: result }), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  });
};
