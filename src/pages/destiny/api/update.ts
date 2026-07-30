import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { getWeapon, searchPerkByName } from '../../../lib/d2/manifest';
import {
  getWishlistRow,
  PERK_SLOT_LABELS,
  PERK_SLOTS,
  updateWishlist,
  type PerkSlot,
  type WishlistPerk,
  type WishlistPerks,
} from '../../../lib/d2/wishlist';
import { internalError, jsonOk, readJsonBody } from '../../../lib/internal';

export const prerender = false;

interface PerkInput {
  name?: unknown;
}

interface UpdateBody {
  itemHash?: unknown;
  barrel?: PerkInput;
  magazine?: PerkInput;
  perk1?: PerkInput;
  perk2?: PerkInput;
}

function sanitizeName(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, 80);
}

function resolvePerk(name: string): WishlistPerk {
  const fromManifest = searchPerkByName(name);
  if (fromManifest) {
    return {
      name: fromManifest.name,
      hash: fromManifest.hash,
      icon: fromManifest.icon,
      category: fromManifest.category,
    };
  }
  return {
    name,
    hash: '',
    icon: '',
    category: '',
  };
}

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const body = await readJsonBody<UpdateBody>(request);
  if (!body?.itemHash || typeof body.itemHash !== 'string') {
    return internalError('missing itemHash', 400);
  }

  const weapon = getWeapon(body.itemHash);
  if (!weapon) return jsonOk({ error: 'weapon_not_found' }, 404);

  const existing = await getWishlistRow(env.AUTH_DB, sess.username, body.itemHash);
  if (!existing) return jsonOk({ error: 'not_found' }, 404);

  const perks: WishlistPerks = {
    barrel: null,
    magazine: null,
    perk1: null,
    perk2: null,
  };

  for (const slot of PERK_SLOTS) {
    const raw = body[slot]?.name;
    const sanitized = sanitizeName(raw);
    if (!sanitized) {
      return jsonOk(
        {
          error: 'missing_perk',
          message: `Falta completar ${PERK_SLOT_LABELS[slot as PerkSlot]}.`,
        },
        400
      );
    }
    perks[slot as PerkSlot] = resolvePerk(sanitized);
  }

  const updated = await updateWishlist(env.AUTH_DB, sess.username, body.itemHash, {
    perks,
  });

  if (!updated) return jsonOk({ error: 'update_failed' }, 500);

  return jsonOk({
    weapon: {
      itemHash: weapon.hash,
      name: weapon.name,
      iconPath: weapon.icon,
      perks,
      found: existing.found,
      foundAt: existing.foundAt,
    },
  });
};
