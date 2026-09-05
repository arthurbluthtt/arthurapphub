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

// Misma categoria canonica por slot que add.ts: normalizamos para que
// perks cross-categoria (e.g. 'Agile Bowstring' = Trait en el manifest)
// queden guardadas con la categoria del slot donde el usuario las puso.
const SLOT_CATEGORY: Record<PerkSlot, string> = {
  barrel: 'Barrel',
  magazine: 'Magazine',
  perk1: 'Trait',
  perk2: 'Trait',
};

function resolvePerk(name: string, slot: PerkSlot): WishlistPerk {
  const fromManifest = searchPerkByName(name);
  if (fromManifest) {
    return {
      name: fromManifest.name,
      hash: fromManifest.hash,
      icon: fromManifest.icon,
      category: SLOT_CATEGORY[slot],
    };
  }
  return {
    name,
    hash: '',
    icon: '',
    category: SLOT_CATEGORY[slot],
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
    perks[slot as PerkSlot] = resolvePerk(sanitized, slot as PerkSlot);
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
      tier: weapon.tier,
      perks,
      found: existing.found,
      foundAt: existing.foundAt,
    },
  });
};
