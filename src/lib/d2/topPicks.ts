import topPicksRaw from '../../../data/d2/top-picks.json';
import { getWeapon, getPerk } from './manifest';

export type PerksPair = [string, string];

export interface ResolvedWeapon {
  itemHash: string;
  name: string;
  iconPath: string;
  perk1: { hash: string; name: string; icon: string };
  perk2: { hash: string; name: string; icon: string };
}

const topPicks = topPicksRaw as Record<string, PerksPair>;

function fallbackPerks(itemHash: string): PerksPair | null {
  const weapon = getWeapon(itemHash);
  if (!weapon) return null;
  // Si mainPerkHashes está vacío, el build script no encontró perks confiables
  // (arma legacy sin data en el manifest). Devolvemos null para que el arma no
  // se pueda agregar hasta que se popule top-picks.json manualmente.
  if (Array.isArray(weapon.mainPerkHashes) && weapon.mainPerkHashes.length === 0) {
    return null;
  }
  // Preferimos mainPerkHashes (trait 3 y trait 4, calculados en build-time).
  // Fallback al pool genérico si el arma no tiene mainPerkHashes (length > 0 pero < 2).
  const isValidHash = (h: unknown): h is string =>
    typeof h === 'string' && h.length > 0 && h !== '0';
  const candidates = Array.isArray(weapon.mainPerkHashes) && weapon.mainPerkHashes.length >= 2
    ? weapon.mainPerkHashes
    : weapon.perkPoolHashes;
  if (!Array.isArray(candidates) || candidates.length < 2) return null;
  const a = candidates.find(isValidHash);
  const b = candidates.slice(1).find(isValidHash);
  if (!a || !b) return null;
  if (getPerk(a) && getPerk(b)) return [a, b];
  return null;
}

export function resolveWeapon(itemHash: string): ResolvedWeapon | null {
  const weapon = getWeapon(itemHash);
  if (!weapon) return null;

  const pair = topPicks[itemHash] ?? fallbackPerks(itemHash);
  if (!pair) return null;

  const perk1Def = getPerk(pair[0]);
  const perk2Def = getPerk(pair[1]);
  if (!perk1Def || !perk2Def) return null;

  return {
    itemHash: weapon.hash,
    name: weapon.name,
    iconPath: weapon.icon,
    perk1: { hash: pair[0], name: perk1Def.name, icon: perk1Def.icon },
    perk2: { hash: pair[1], name: perk2Def.name, icon: perk2Def.icon },
  };
}
