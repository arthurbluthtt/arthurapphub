import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  buildClearedSessionCookie,
  destroySession,
  readCookie,
} from '../../../lib/auth';

export const prerender = false;

async function handle(request: Request): Promise<Response> {
  const sessionId = readCookie(request);
  if (sessionId) {
    await destroySession(env.AUTH_DB, sessionId);
  }

  const headers = new Headers();
  headers.append('Set-Cookie', buildClearedSessionCookie());
  headers.append('Set-Cookie', 'hub_user=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  headers.set('Location', '/');
  return new Response(null, { status: 303, headers });
}

export const POST: APIRoute = async ({ request }) => {
  return handle(request);
};

export const GET: APIRoute = async ({ request }) => {
  return handle(request);
};