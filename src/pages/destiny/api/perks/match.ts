import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../../lib/auth';
import { searchPerksByPartialName } from '../../../../lib/d2/manifest';
import { listCustomPerkIcons } from '../../../../lib/d2/perkIcons';
import { jsonOk } from '../../../../lib/internal';

export const prerender = false;

interface PerkMatch {
  name: string;
  hash: string;
  icon: string;
  isCustom: boolean;
  category: string;
}

export const GET: APIRoute = async ({ request, url }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const q = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? 8)));
  if (!q) return jsonOk({ results: [] });

  const results: PerkMatch[] = [];
  const seenNames = new Set<string>();
  const qLower = q.toLowerCase();

  // 1. Pool de iconos custom del usuario (case-insensitive).
  try {
    const customs = await listCustomPerkIcons(env.AUTH_DB, sess.username);
    for (const ic of customs) {
      if (results.length >= limit) break;
      if (ic.perkNameLower.includes(qLower)) {
        if (seenNames.has(ic.perkNameLower)) continue;
        seenNames.add(ic.perkNameLower);
        results.push({
          name: ic.perkNameDisplay,
          hash: '',
          icon: ic.iconPath,
          isCustom: true,
          category: '',
        });
      }
    }
  } catch {
    // d2_perk_icons puede no existir aún; caemos solo a manifest
  }

  // 2. Manifest (linear scan; ~2000 perks → <5ms).
  const fromManifest = searchPerksByPartialName(q, Math.max(limit * 2, 16));
  for (const perk of fromManifest) {
    if (results.length >= limit) break;
    const lower = perk.name.toLowerCase();
    if (seenNames.has(lower)) continue;
    seenNames.add(lower);
    results.push({
      name: perk.name,
      hash: perk.hash,
      icon: `/destiny/api/icon?type=perk&hash=${encodeURIComponent(perk.hash)}`,
      isCustom: false,
      category: perk.category,
    });
  }

  return jsonOk({ results });
};
