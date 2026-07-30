import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../../lib/auth';
import { listCustomPerkIcons } from '../../../../lib/d2/perkIcons';
import { listPerksByCategory } from '../../../../lib/d2/manifest';
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
  source: 'wishlist' | 'custom' | 'manifest';
  useCount: number;
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

// Cuenta ocurrencias de cada perk en la wishlist del usuario, agrupadas
// por nombre normalizado (sin slot — la misma perk en perk1 y perk2 cuenta
// como dos usos).
function countPerkUses(rows: WishlistRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row?.perks_json) continue;
    let parsed: Partial<Record<PerkSlot, { name?: unknown }>> | null = null;
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
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

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
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 30)));
  if (!q && !slot) return jsonOk({ results: [] });

  const seen = new Set<string>();
  const results: (PerkMatch & { _score: number })[] = [];
  const slotCategory = slot ? SLOT_TO_CATEGORY[slot] : null;

  // Single source of truth: perks ya tipeadas por el usuario (su wishlist).
  // Para cada perk, resolvemos icono + categoria efectiva:
  //   - hash presente y NO hay icono custom -> usa icono del manifest.
  //   - hash presente y SI hay icono custom -> usa el icono custom
  //     (override del usuario).
  //   - hash vacio (custom puro) -> requiere icono custom en
  //     d2_perk_icons; si no tiene, se omite.
  // Esto elimina duplicados entre el wishlist y los iconos custom.
  const ownRows = await env.AUTH_DB
    .prepare('SELECT perks_json FROM d2_wishlist WHERE username = ?')
    .bind(sess.username)
    .all<WishlistRow>();
  const userPool = collectUserPerks(ownRows.results ?? []);
  const useCounts = countPerkUses(ownRows.results ?? []);

  // Para chequear overrides de iconos en perks del manifest, precargamos
  // el pool de iconos custom una sola vez.
  const customIconByName = new Map<string, { iconPath: string; category: string; display: string }>();
  try {
    const customs = await listCustomPerkIcons(env.AUTH_DB, sess.username);
    for (const ic of customs) {
      if (ic.iconPath) {
        customIconByName.set(ic.perkNameLower, {
          iconPath: ic.iconPath,
          category: ic.category,
          display: ic.perkNameDisplay,
        });
      }
    }
  } catch {
    // d2_perk_icons puede no existir; no hacer nada
  }

  for (const [, perk] of userPool) {
    if (results.length >= limit) break;
    const score = rankMatch(perk.name, q);
    if (score < 0) continue;

    let icon = '';
    let isCustom = false;
    let effectiveCategory = perk.category;
    const lowerName = perk.name.toLowerCase();

    if (perk.hash) {
      icon = `/destiny/api/icon?type=perk&hash=${encodeURIComponent(perk.hash)}`;
      const custom = customIconByName.get(lowerName);
      if (custom?.iconPath) {
        icon = custom.iconPath;
        isCustom = true;
        if (custom.category) effectiveCategory = custom.category;
      }
    } else {
      const custom = customIconByName.get(lowerName);
      if (!custom?.iconPath) continue;
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

    // Dedup por nombre (no por nombre+slot) para evitar duplicados
    // cuando la misma perk se guardo en perk1 y perk2.
    if (seen.has(lowerName)) continue;
    seen.add(lowerName);

    results.push({
      name: perk.name,
      hash: perk.hash,
      icon,
      isCustom,
      category: effectiveCategory,
      source: isCustom ? 'custom' : 'wishlist',
      useCount: useCounts.get(lowerName) ?? 0,
      _score: score,
    });
  }

  // Tambien agregamos los iconos custom del usuario que NO estan en
  // ninguna arma todavia. Asi el usuario puede elegir un icono que subio
  // sin haberlo usado antes.
  if (results.length < limit) {
    for (const [, ic] of customIconByName) {
      if (results.length >= limit) break;
      if (seen.has(ic.display.toLowerCase())) continue;
      if (!ic.iconPath || !ic.category) continue;
      if (slot && slotCategory && ic.category !== slotCategory) continue;
      const score = rankMatch(ic.display, q);
      if (score < 0) continue;
      seen.add(ic.display.toLowerCase());
      results.push({
        name: ic.display,
        hash: '',
        icon: ic.iconPath,
        isCustom: true,
        category: ic.category,
        source: 'custom',
        useCount: 0,
        _score: score,
      });
    }
  }

  // Fallback final: si el usuario nunca uso esta perk (no esta en su
  // wishlist ni tiene icono custom), consultar el manifest de Bungie
  // por la categoria del slot. Esto es lo que permite descubrir perks
  // nuevas (ej: 'Incandescent' si nunca la trackeaste).
  if (results.length < limit && slotCategory) {
    const manifestPerks = listPerksByCategory(slotCategory);
    for (const mp of manifestPerks) {
      if (results.length >= limit) break;
      const lowerName = mp.name.toLowerCase();
      if (seen.has(lowerName)) continue;
      const score = rankMatch(mp.name, q);
      if (score < 0) continue;
      const custom = customIconByName.get(lowerName);
      const icon = custom?.iconPath
        ? custom.iconPath
        : `/destiny/api/icon?type=perk&hash=${encodeURIComponent(mp.hash)}`;
      const isCustom = !!custom?.iconPath;
      const effectiveCategory = custom?.category || mp.category;
      seen.add(lowerName);
      results.push({
        name: mp.name,
        hash: mp.hash,
        icon,
        isCustom,
        category: effectiveCategory,
        source: 'manifest',
        useCount: useCounts.get(lowerName) ?? 0,
        _score: score,
      });
    }
  }

  // Orden: por score (mejor match primero), desempate por uso
  // descendente (las perks mas usadas primero), desempate final
  // alfabetico para estabilidad.
  results.sort((a, b) => {
    if (a._score !== b._score) return a._score - b._score;
    if (a.useCount !== b.useCount) return b.useCount - a.useCount;
    return a.name.localeCompare(b.name);
  });
  for (const r of results) delete r._score;

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
