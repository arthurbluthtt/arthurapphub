import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import {
  getWeapon,
  getEligiblePerk,
  listEligiblePerksForWeapon,
} from '../../../lib/d2/manifest';
import { addWishlist } from '../../../lib/d2/wishlist';
import { internalError, jsonOk, readJsonBody } from '../../../lib/internal';

export const prerender = false;

interface AddBody {
  itemHash: string;
  perkHashes?: [string, string];
}

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const body = await readJsonBody<AddBody>(request);
  if (!body?.itemHash) return internalError('missing itemHash', 400);

  const weapon = getWeapon(body.itemHash);
  if (!weapon) return jsonOk({ error: 'weapon_not_found' }, 404);

  if (!body.perkHashes || !Array.isArray(body.perkHashes) || body.perkHashes.length !== 2) {
    return jsonOk({ error: 'missing_perks' }, 400);
  }
  const [perkHash1, perkHash2] = body.perkHashes;
  if (!perkHash1 || !perkHash2 || perkHash1 === perkHash2) {
    return jsonOk({ error: 'invalid_perks' }, 400);
  }

  const eligibility = new Set(listEligiblePerksForWeapon(weapon).map((p) => p.hash));
  const p1 = getEligiblePerk(perkHash1);
  const p2 = getEligiblePerk(perkHash2);
  if (!p1 || !p2 || !eligibility.has(perkHash1) || !eligibility.has(perkHash2)) {
    return jsonOk(
      { error: 'perks_not_in_pool', message: 'Las perks elegidas no corresponden al pool del arma.' },
      400
    );
  }

  const result = await addWishlist(env.AUTH_DB, sess.username, {
    itemHash: weapon.hash,
    weaponName: weapon.name,
    weaponIconPath: weapon.icon,
    topPerkHashes: [p1.hash, p2.hash],
  });

  if (result === 'duplicate') {
    return jsonOk({ error: 'duplicate' }, 409);
  }

  return jsonOk({
    weapon: {
      itemHash: weapon.hash,
      name: weapon.name,
      iconPath: weapon.icon,
      perk1: { hash: p1.hash, name: p1.name, icon: p1.icon },
      perk2: { hash: p2.hash, name: p2.name, icon: p2.icon },
      found: false,
      foundAt: null,
    },
  });
};
