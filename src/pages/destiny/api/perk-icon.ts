import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import {
  deleteCustomPerkIcon,
  listCustomPerkIcons,
  normalizeCategory,
  saveCustomPerkIcon,
} from '../../../lib/d2/perkIcons';
import { internalError, jsonOk, readJsonBody } from '../../../lib/internal';

export const prerender = false;

interface SaveBody {
  perkName?: unknown;
  iconPath?: unknown;
  category?: unknown;
  delete?: unknown;
  setCategory?: unknown;
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
      category: i.category || '',
    })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const body = await readJsonBody<SaveBody>(request);

  // Update solo la categoria de un icono existente (sin pedir url).
  if (body?.setCategory === true) {
    const name = sanitizePerkName(body.perkName);
    if (!name) {
      return jsonOk({ error: 'missing_perk_name', message: 'Falta el nombre del perk.' }, 400);
    }
    const category = normalizeCategory(body.category);
    const lower = name.toLowerCase();
    const existing = await env.AUTH_DB
      .prepare(
        'SELECT perk_name_display, icon_path FROM d2_perk_icons WHERE username = ? AND perk_name_lower = ?'
      )
      .bind(sess.username, lower)
      .first<{ perk_name_display: string; icon_path: string }>();
    if (!existing) {
      return jsonOk({ error: 'not_found', message: 'Icono custom no encontrado.' }, 404);
    }
    try {
      const saved = await saveCustomPerkIcon(
        env.AUTH_DB,
        sess.username,
        existing.perk_name_display,
        existing.icon_path,
        category
      );
      return jsonOk({
        icon: {
          perkName: saved.perkNameDisplay,
          iconPath: saved.iconPath,
          category: saved.category,
        },
      });
    } catch (err) {
      return jsonOk(
        { error: 'save_failed', message: err instanceof Error ? err.message : 'Error al guardar.' },
        500
      );
    }
  }

  if (body?.delete === true) {
    const name = sanitizePerkName(body.perkName);
    if (!name) return internalError('missing perkName', 400);
    const ok = await deleteCustomPerkIcon(env.AUTH_DB, sess.username, name);
    return jsonOk({ ok });
  }

  const perkName = sanitizePerkName(body?.perkName);
  const iconPath = sanitizeIconPath(body?.iconPath);
  const category = normalizeCategory(body?.category);
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
    const saved = await saveCustomPerkIcon(env.AUTH_DB, sess.username, perkName, iconPath, category);
    return jsonOk({
      icon: {
        perkName: saved.perkNameDisplay,
        iconPath: saved.iconPath,
        category: saved.category,
      },
    });
  } catch (err) {
    return jsonOk(
      { error: 'save_failed', message: err instanceof Error ? err.message : 'Error al guardar.' },
      500
    );
  }
};
