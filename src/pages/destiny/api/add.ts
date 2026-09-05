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

// Categoria canonica por slot (la misma que usa perks/match.ts).
// Normalizamos la categoria al slot para que perks cross-categoria
// (e.g. 'Agile Bowstring' = Trait en el manifest) queden guardadas
// con la categoria del slot donde el usuario las puso. Asi el
// dropdown las muestra correctamente en futuras aperturas.
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
    perks[slot as PerkSlot] = resolvePerk(sanitized, slot as PerkSlot);
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
      tier: weapon.tier,
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
