import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { addSub } from '../../../lib/subs/store';
import { parseSubInput } from '../../../lib/subs/validate';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const parsed = parseSubInput(body);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const sub = await addSub(env.AUTH_DB, sess.username, parsed.value, crypto.randomUUID());
  return new Response(JSON.stringify({ ok: true, sub }), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  });
};
