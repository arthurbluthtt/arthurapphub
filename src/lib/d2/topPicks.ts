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
  if (!weapon || !Array.isArray(weapon.perkPoolHashes) || weapon.perkPoolHashes.length < 2) {
    return null;
  }
  const a = weapon.perkPoolHashes[0];
  const b = weapon.perkPoolHashes[1];
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
