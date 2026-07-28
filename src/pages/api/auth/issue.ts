import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createAuthCode, lookupSession, readCookie } from '../../../lib/auth';
import { internalError, jsonOk, readJsonBody } from '../../../lib/internal';

export const prerender = false;

interface IssueBody {
  app: string;
}

const ALLOWED_APPS = new Set(['notes-app']);

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  if (!sessionId) return jsonOk({ error: 'unauthenticated' }, 401);
  const sess = await lookupSession(env.AUTH_DB, sessionId);
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const body = await readJsonBody<IssueBody>(request);
  if (!body || !body.app) return internalError('missing app', 400);
  if (!ALLOWED_APPS.has(body.app)) return internalError('unknown app', 400);

  const { code, expiresAt } = await createAuthCode(env.AUTH_DB, body.app);
  return jsonOk({ code, expires_at: expiresAt });
};