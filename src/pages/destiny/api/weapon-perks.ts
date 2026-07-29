import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../lib/auth';
import {
  getWeapon,
  listEligiblePerksForWeapon,
  PERK_CATEGORIES,
} from '../../../lib/d2/manifest';
import { jsonOk } from '../../../lib/internal';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const hash = url.searchParams.get('hash');
  if (!hash) return jsonOk({ error: 'missing_hash' }, 400);

  const weapon = getWeapon(hash);
  if (!weapon) return jsonOk({ error: 'weapon_not_found' }, 404);

  const perks = listEligiblePerksForWeapon(weapon).map((p) => ({
    hash: p.hash,
    name: p.name,
    icon: p.icon,
    description: p.description,
    category: p.categoryKey,
    categoryLabel: PERK_CATEGORIES[p.categoryKey],
  }));

  return jsonOk({
    weapon: {
      hash: weapon.hash,
      name: weapon.name,
      icon: weapon.icon,
      tier: weapon.tier,
      damage: weapon.damage,
    },
    perks,
  });
};
