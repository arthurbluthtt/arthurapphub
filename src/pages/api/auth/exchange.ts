import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  consumeAuthCode,
  deriveAppPinHash,
  getPinHash,
} from '../../../lib/auth';
import {
  internalError,
  jsonOk,
  readJsonBody,
  verifyInternal,
} from '../../../lib/internal';

export const prerender = false;

interface ExchangeBody {
  code: string;
  app: string;
}

const KNOWN_APPS = new Set(['notes-app']);

export const POST: APIRoute = async ({ request }) => {
  if (!verifyInternal(request, env.INTERNAL_API_SECRET)) {
    return internalError('unauthorized');
  }

  const body = await readJsonBody<ExchangeBody>(request);
  if (!body || !body.code || !body.app) return internalError('missing fields', 400);
  if (!KNOWN_APPS.has(body.app)) return internalError('unknown app', 400);

  const consumed = await consumeAuthCode(env.AUTH_DB, body.code, body.app);
  if (!consumed) return internalError('invalid code', 400);

  const pinHashHub = await getPinHash(env.AUTH_DB);
  if (!pinHashHub) return internalError('no user', 500);

  const sessionToken = generateAppSessionToken();
  const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
  const pinHash = await deriveAppPinHash(pinHashHub, body.app, env.AUTH_PEPPER);

  return jsonOk({ session_token: sessionToken, pin_hash: pinHash, expires_at: expiresAt });
};

function generateAppSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}