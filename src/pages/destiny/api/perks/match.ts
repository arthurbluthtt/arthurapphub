import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../../lib/auth';
import { findCustomPerkIcon, listCustomPerkIcons } from '../../../../lib/d2/perkIcons';
import { jsonOk } from '../../../../lib/internal';

export const prerender = false;

const PERK_SLOTS = ['barrel', 'magazine', 'perk1', 'perk2'] as const;
type PerkSlot = (typeof PERK_SLOTS)[number];

const SLOT_TO_CATEGORY: Record<PerkSlot, string> = {
  barrel: 'Barrel',
  magazine: 'Magazine',
  perk1: 'Trait',
  perk2: 'Trait',
};

interface PerkMatch {
  name: string;
  hash: string;
  icon: string;
  isCustom: boolean;
  category: string;
  source: 'wishlist' | 'custom';
  _score: number;
}

interface WishlistRow {
  perks_json: string;
}

interface StoredPerk {
  name: string;
  hash: string;
  icon: string;
  category: string;
  slot: PerkSlot;
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
      const key = perk.name.toLowerCase() + '|' + slot;
      if (map.has(key)) continue;
      map.set(key, {
        name: perk.name,
        hash: typeof perk.hash === 'string' ? perk.hash : '',
        icon: typeof perk.icon === 'string' ? perk.icon : '',
        category: typeof perk.category === 'string' ? perk.category : '',
        slot,
      });
    }
  }
  return map;
}

// Score: 0 = exact, 1 = prefix, 2 = word-prefix, -1 = no match.
// Substring en medio del nombre NO cuenta (asi "K" no matchea "Target Lock").
// Si q esta vacio, matchea todo (rank 1) — util para "abrir dropdown al focus".
function rankMatch(name: string, q: string): number {
  const nl = name.toLowerCase();
  const ql = q.toLowerCase();
  if (!ql) return 1;
  if (nl === ql) return 0;
  if (nl.startsWith(ql)) return 1;
  const words = nl.split(/[\s\-_/]+/).filter(Boolean);
  for (const w of words) {
    if (w.startsWith(ql)) return 2;
  }
  return -1;
}

export const GET: APIRoute = async ({ request, url }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) return jsonOk({ error: 'unauthenticated' }, 401);

  const q = (url.searchParams.get('q') ?? '').trim();
  const slotParam = url.searchParams.get('slot') ?? '';
  const slot = (PERK_SLOTS as readonly string[]).includes(slotParam)
    ? (slotParam as PerkSlot)
    : null;
  const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit') ?? 12)));
  // Si no hay query ni slot, devolvemos vacio (no listar todo sin contexto).
  if (!q && !slot) return jsonOk({ results: [] });

  const qLower = q.toLowerCase();
  const seen = new Set<string>();
  const results: PerkMatch[] = [];
  const slotCategory = slot ? SLOT_TO_CATEGORY[slot] : null;

  // 1. Pool de perks ya guardadas en armas (perks_json del wishlist del user).
  const ownRows = await env.AUTH_DB
    .prepare('SELECT perks_json FROM d2_wishlist WHERE username = ?')
    .bind(sess.username)
    .all<WishlistRow>();
  const userPool = collectUserPerks(ownRows.results ?? []);

  for (const [, perk] of userPool) {
    const score = rankMatch(perk.name, q);
    if (score < 0) continue;

    let icon = '';
    let isCustom = false;
    let effectiveCategory = perk.category;
    if (perk.hash) {
      icon = `/destiny/api/icon?type=perk&hash=${encodeURIComponent(perk.hash)}`;
    } else {
      // Custom perk (saved via add.ts cuando no estaba en el manifest).
      // Si tiene icono custom guardado en d2_perk_icons, usamos su categoria.
      // Si no, lo ocultamos del typeahead (se mantiene tipeable manualmente).
      const custom = await findCustomPerkIcon(env.AUTH_DB, sess.username, perk.name);
      if (!custom) continue;
      icon = custom.iconPath;
      isCustom = true;
      effectiveCategory = custom.category;
    }

    if (
      slot &&
      slotCategory &&
      effectiveCategory &&
      effectiveCategory !== slotCategory
    ) {
      continue;
    }
    const key = 'w:' + perk.name.toLowerCase() + '|' + (effectiveCategory || 'unknown');
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      name: perk.name,
      hash: perk.hash,
      icon,
      isCustom,
      category: effectiveCategory,
      source: 'wishlist',
      _score: score,
    });
    if (results.length >= limit) break;
  }

  // 2. Iconos custom (d2_perk_icons) del usuario.
  // Solo aparecen en el typeahead si tienen CATEGORIA asignada (Cañón /
  // Cargador / Rasgo). Sin categoria asignada = no aparece en el picker
  // (el usuario debe elegir tipo en 'Icono perk' para que aparezca).
  if (results.length < limit) {
    try {
      const customs = await listCustomPerkIcons(env.AUTH_DB, sess.username);
      for (const ic of customs) {
        if (results.length >= limit) break;
        if (!ic.category) continue;
        const score = rankMatch(ic.perkNameDisplay, q);
        if (score < 0) continue;
        if (slot && slotCategory && ic.category !== slotCategory) continue;
        const key = 'ic:' + ic.perkNameLower;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          name: ic.perkNameDisplay,
          hash: '',
          icon: ic.iconPath,
          isCustom: true,
          category: ic.category,
          source: 'custom',
        });
      }
    } catch {
      // d2_perk_icons puede no existir; no hacer nada
    }
  }

  results.sort((a, b) => {
    if (a._score !== b._score) return a._score - b._score;
    return a.name.localeCompare(b.name);
  });
  for (const r of results) delete r._score;

  // Agrupar para que el cliente renderice secciones (Cañón / Cargador / Rasgo / Custom).
  const groups: Record<string, { key: string; label: string; perks: PerkMatch[] }> = {
    barrel: { key: 'barrel', label: 'Cañón', perks: [] },
    magazine: { key: 'magazine', label: 'Cargador', perks: [] },
    trait: { key: 'trait', label: 'Rasgo', perks: [] },
    custom: { key: 'custom', label: 'Custom', perks: [] },
  };
  for (const p of results) {
    if (p.category === 'Barrel') groups.barrel.perks.push(p);
    else if (p.category === 'Magazine') groups.magazine.perks.push(p);
    else if (p.category === 'Trait') groups.trait.perks.push(p);
    else groups.custom.perks.push(p);
  }

  return jsonOk({ results, groups });
};
