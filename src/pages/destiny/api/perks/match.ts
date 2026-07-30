import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../../lib/auth';
import { findCustomPerkIcon, listCustomPerkIcons } from '../../../../lib/d2/perkIcons';
import { jsonOk } from '../../../../lib/internal';

export const prerender = false;

interface PerkMatch {
  name: string;
  hash: string;
  icon: string;
  isCustom: boolean;
  category: string;
}

interface WishlistRow {
  perks_json: string;
}

const PERK_SLOTS = ['barrel', 'magazine', 'perk1', 'perk2'] as const;
type PerkSlot = (typeof PERK_SLOTS)[number];

interface StoredPerk {
  name: string;
  hash: string;
  icon: string;
  category: string;
}

function collectUserPerks(rows: WishlistRow[]): Map<string, StoredPerk> {
  const map = new Map<string, StoredPerk>();
  for (const row of rows) {
    if (!row?.perks_json) continue;
    let parsed: Partial<Record<PerkSlot, Partial<StoredPerk> | null>> | null = null;
    try {
      parsed = JSON.parse(row.perks_json);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== 'object') continue;
    for (const slot of PERK_SLOTS) {
      const perk = parsed[slot];
      if (!perk || typeof perk.name !== 'string' || !perk.name) continue;
      const key = perk.name.toLowerCase();
      if (map.has(key)) continue;
      map.set(key, {
        name: perk.name,
        hash: typeof perk.hash === 'string' ? perk.hash : '',
        icon: typeof perk.icon === 'string' ? perk.icon : '',
        category: typeof perk.category === 'string' ? perk.category : '',
      });
    }
  }
  return map;
}

export const GET: APIRoute = async ({ request, url }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const q = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? 8)));
  if (!q) return jsonOk({ results: [] });

  const qLower = q.toLowerCase();
  const seen = new Set<string>();
  const results: PerkMatch[] = [];

  // 1. Pool del usuario: perks ya tipeadas en armas previas (de perks_json).
  const ownRows = await env.AUTH_DB
    .prepare('SELECT perks_json FROM d2_wishlist WHERE username = ?')
    .bind(sess.username)
    .all<WishlistRow>();
  const userPool = collectUserPerks(ownRows.results ?? []);

  for (const [, perk] of userPool) {
    if (results.length >= limit) break;
    if (!perk.name.toLowerCase().includes(qLower)) continue;
    const key = perk.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let icon = '';
    let isCustom = false;
    if (perk.hash) {
      icon = `/destiny/api/icon?type=perk&hash=${encodeURIComponent(perk.hash)}`;
    } else {
      const custom = await findCustomPerkIcon(env.AUTH_DB, sess.username, perk.name);
      if (custom?.iconPath) {
        icon = custom.iconPath;
        isCustom = true;
      }
    }

    results.push({
      name: perk.name,
      hash: perk.hash,
      icon,
      isCustom,
      category: perk.category,
    });
  }

  // 2. Iconos custom del usuario que aún no se usaron en una arma.
  if (results.length < limit) {
    try {
      const customs = await listCustomPerkIcons(env.AUTH_DB, sess.username);
      for (const ic of customs) {
        if (results.length >= limit) break;
        if (!ic.perkNameLower.includes(qLower)) continue;
        if (seen.has(ic.perkNameLower)) continue;
        seen.add(ic.perkNameLower);
        results.push({
          name: ic.perkNameDisplay,
          hash: '',
          icon: ic.iconPath,
          isCustom: true,
          category: '',
        });
      }
    } catch {
      // d2_perk_icons puede no existir aún — caemos solo al pool del wishlist
    }
  }

  results.sort((a, b) => a.name.localeCompare(b.name));

  return jsonOk({ results });
};
