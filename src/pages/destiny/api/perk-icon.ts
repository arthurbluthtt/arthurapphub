import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import {
  deleteCustomPerkIcon,
  listCustomPerkIcons,
  saveCustomPerkIcon,
} from '../../../lib/d2/perkIcons';
import { internalError, jsonOk, readJsonBody } from '../../../lib/internal';

export const prerender = false;

interface SaveBody {
  perkName?: unknown;
  iconPath?: unknown;
  delete?: unknown;
}

function sanitizePerkName(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, 80);
}

function sanitizeIconPath(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, 500);
}

export const GET: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);
  const icons = await listCustomPerkIcons(env.AUTH_DB, sess.username);
  return jsonOk({
    icons: icons.map((i) => ({
      perkName: i.perkNameDisplay,
      perkNameLower: i.perkNameLower,
      iconPath: i.iconPath,
    })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const body = await readJsonBody<SaveBody>(request);
  if (body?.delete === true) {
    const name = sanitizePerkName(body.perkName);
    if (!name) return internalError('missing perkName', 400);
    const ok = await deleteCustomPerkIcon(env.AUTH_DB, sess.username, name);
    return jsonOk({ ok });
  }

  const perkName = sanitizePerkName(body?.perkName);
  const iconPath = sanitizeIconPath(body?.iconPath);
  if (!perkName) {
    return jsonOk({ error: 'missing_perk_name', message: 'Falta el nombre del perk.' }, 400);
  }
  if (!iconPath) {
    return jsonOk({ error: 'missing_icon_path', message: 'Falta la URL del icono.' }, 400);
  }
  if (!/^https?:\/\//i.test(iconPath) && !iconPath.startsWith('/')) {
    return jsonOk(
      { error: 'invalid_icon_path', message: 'La URL debe empezar con http(s):// o /.' },
      400
    );
  }

  try {
    const saved = await saveCustomPerkIcon(env.AUTH_DB, sess.username, perkName, iconPath);
    return jsonOk({
      icon: {
        perkName: saved.perkNameDisplay,
        iconPath: saved.iconPath,
      },
    });
  } catch (err) {
    return jsonOk(
      { error: 'save_failed', message: err instanceof Error ? err.message : 'Error al guardar.' },
      500
    );
  }
};
