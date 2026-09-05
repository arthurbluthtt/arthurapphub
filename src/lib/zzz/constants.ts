export const SPECIALTIES = ['attack', 'anomaly', 'stun', 'support', 'defense', 'rupture'] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  attack: 'Attack',
  anomaly: 'Anomaly',
  stun: 'Stun',
  support: 'Support',
  defense: 'Defense',
  rupture: 'Rupture',
};

export const STAT_KEYS = [
  'HP',
  'ATK',
  'DEF',
  'Impact',
  'Anomaly Mastery',
  'Anomaly Proficiency',
  'CRIT Rate',
  'CRIT DMG',
  'PEN Ratio',
  'Energy Regen',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const DISC_SLOTS = [1, 2, 3, 4, 5, 6] as const;
export type DiscSlot = (typeof DISC_SLOTS)[number];

export function isSpecialty(v: unknown): v is Specialty {
  return typeof v === 'string' && (SPECIALTIES as readonly string[]).includes(v);
}

export const STAT_UNITS: Record<string, string> = {
  'CRIT Rate': '%',
  'CRIT DMG': '%',
  'PEN Ratio': '%',
  'Energy Regen': '%',
};

export function isStatKey(v: unknown): v is StatKey {
  return typeof v === 'string' && (STAT_KEYS as readonly string[]).includes(v);
}

export interface StatValue {
  stat: StatKey;
  value: number | null;
}

export function isStatValue(v: unknown): v is StatValue {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return isStatKey(o.stat) && (o.value === null || (typeof o.value === 'number' && Number.isFinite(o.value)));
}

export function formatStatValue(sv: StatValue): string {
  if (sv.value === null || sv.value === undefined) return `${sv.stat} —`;
  const unit = STAT_UNITS[sv.stat] || '';
  const val = Number.isInteger(sv.value) ? sv.value.toLocaleString() : sv.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${sv.stat} ${val}${unit}` : `${sv.stat} ${val}`;
}
