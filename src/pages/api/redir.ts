import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createAuthCode, lookupSession, readCookie } from '../../lib/auth';
import { findApp, isSsoApp } from '../../lib/apps';

export const prerender = false;

function safeAppUrl(url: string): URL | null {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u;
  } catch {}
  return null;
}

export const GET: APIRoute = async ({ request, url, redirect }) => {
  const appId = url.searchParams.get('app');
  if (!appId) return new Response('missing app', { status: 400 });

  const app = findApp(appId);
  if (!app) return new Response('unknown app', { status: 404 });
  if (!isSsoApp(appId)) {
    return new Response('app is not SSO-enabled', { status: 400 });
  }

  const baseUrl = safeAppUrl(app.url);
  if (!baseUrl) return new Response('invalid app url', { status: 500 });

  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;

  if (!sess) {
    const next = `/api/redir?app=${encodeURIComponent(appId)}`;
    return redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const { code } = await createAuthCode(env.AUTH_DB, sess.username, appId);
  const dest = new URL('/api/auth/exchange', baseUrl);
  dest.searchParams.set('code', code);
  return redirect(dest.toString(), 302);
};
