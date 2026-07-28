import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import { resolveWeapon } from '../../../lib/d2/topPicks';
import { addWishlist } from '../../../lib/d2/wishlist';
import { internalError, jsonOk, readJsonBody } from '../../../lib/internal';

export const prerender = false;

interface AddBody {
  itemHash: string;
}

export const POST: APIRoute = async ({ request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const body = await readJsonBody<AddBody>(request);
  if (!body?.itemHash) return internalError('missing itemHash', 400);

  const resolved = resolveWeapon(body.itemHash);
  if (!resolved) {
    return internalError('unknown weapon or no perks resolvable', 404);
  }

  const result = await addWishlist(env.AUTH_DB, sess.username, {
    itemHash: resolved.itemHash,
    weaponName: resolved.name,
    weaponIconPath: resolved.iconPath,
    topPerkHashes: [resolved.perk1.hash, resolved.perk2.hash],
  });

  if (result === 'duplicate') {
    return jsonOk({ error: 'duplicate' }, 409);
  }

  return jsonOk({
    weapon: {
      itemHash: resolved.itemHash,
      name: resolved.name,
      iconPath: resolved.iconPath,
      perk1: resolved.perk1,
      perk2: resolved.perk2,
      found: false,
      foundAt: null,
    },
  });
};
