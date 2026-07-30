import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isSsoApp } from '../../../lib/apps';
import {
  internalError,
  jsonOk,
  readJsonBody,
  verifyInternal,
} from '../../../lib/internal';

export const prerender = false;

interface LogoutBody {
  session_token: string;
  app: string;
}

// Stub: relies on the app's own cleanup logic. The hub has no per-app session
// store; revoking a single relying-party session is the app's responsibility.
// This endpoint exists for symmetry with exchange so apps can notify the hub
// about sign-outs. The check `isSsoApp` gates access to apps that opted in.
export const POST: APIRoute = async ({ request }) => {
  if (!verifyInternal(request, env.INTERNAL_API_SECRET)) {
    return internalError('unauthorized');
  }

  const body = await readJsonBody<LogoutBody>(request);
  if (!body || !body.session_token || !body.app) {
    return internalError('missing fields', 400);
  }
  if (!isSsoApp(body.app)) {
    return internalError('unknown app', 400);
  }

  return jsonOk({ ok: true });
};
