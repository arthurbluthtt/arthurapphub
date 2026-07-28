import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import data from '../../data/apps.json';
import { createAuthCode, lookupSession, readCookie } from '../../lib/auth';

export const prerender = false;

interface AppEntry {
  id: string;
  url: string;
}

const apps = ((data as { apps: AppEntry[] }).apps) ?? [];

function findApp(id: string): AppEntry | undefined {
  return apps.find((a) => a.id === id);
}

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

  const baseUrl = safeAppUrl(app.url);
  if (!baseUrl) return new Response('invalid app url', { status: 500 });

  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;

  if (!sess) {
    const next = `/api/redir?app=${encodeURIComponent(appId)}`;
    return redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const { code } = await createAuthCode(env.AUTH_DB, appId);
  const dest = new URL('/api/auth/exchange', baseUrl);
  dest.searchParams.set('code', code);
  return redirect(dest.toString(), 302);
};