import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import {
  getWeapon,
  searchPerkByName,
} from '../../../lib/d2/manifest';
import {
  addWishlist,
  PERK_SLOT_LABELS,
  PERK_SLOTS,
  type WishlistPerk,
  type WishlistPerks,
  type PerkSlot,
} from '../../../lib/d2/wishlist';
import { internalError, jsonOk, readJsonBody } from '../../../lib/internal';

export const prerender = false;

interface PerkInput {
  name?: unknown;
}

interface AddBody {
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

  const body = await readJsonBody<AddBody>(request);
  if (!body?.itemHash || typeof body.itemHash !== 'string') {
    return internalError('missing itemHash', 400);
  }

  const weapon = getWeapon(body.itemHash);
  if (!weapon) return jsonOk({ error: 'weapon_not_found' }, 404);

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

  const result = await addWishlist(env.AUTH_DB, sess.username, {
    itemHash: weapon.hash,
    weaponName: weapon.name,
    weaponIconPath: weapon.icon,
    perks,
  });

  if (result === 'duplicate') {
    return jsonOk({ error: 'duplicate' }, 409);
  }

  return jsonOk({
    weapon: {
      itemHash: weapon.hash,
      name: weapon.name,
      iconPath: weapon.icon,
      perks: {
        barrel: perks.barrel,
        magazine: perks.magazine,
        perk1: perks.perk1,
        perk2: perks.perk2,
      },
      found: false,
      foundAt: null,
    },
  });
};
