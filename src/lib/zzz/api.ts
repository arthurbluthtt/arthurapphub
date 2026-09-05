import { lookupSession, readCookie } from '../auth';
import { isSpecialty, isStatKey, isStatValue, type StatKey, type StatValue } from './constants';
import { getDiscSetById, getDiscSetByName, getWEngineById, getWEngineByName } from './data';
import type { ZzzDisc } from './store';

export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonError(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

export async function zzzUsername(request: Request, db: D1Database): Promise<string | null> {
  const sessionToken = readCookie(request);
  if (!sessionToken) return null;
  const session = await lookupSession(db, sessionToken);
  return session?.username ?? null;
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseText(value: unknown, minLength: number, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text.length < minLength || text.length > maxLength) return undefined;
  return text;
}

export function parseOptionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text.length > maxLength) return undefined;
  return text || null;
}

export function parseOptionalUrl(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    if (text.length > 2048) return undefined;
    return text;
  } catch {
    return undefined;
  }
}

export function parseWEngine(value: unknown): { id: string; name: string } | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return null;
  const w = getWEngineById(text);
  return w ? { id: w.id, name: w.name } : undefined;
}

export function parseWEngineName(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return null;
  if (text.length > 80) return undefined;
  return getWEngineByName(text)?.name;
}

export function parseDiscSet(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return null;
  if (text.length > 120) return undefined;
  const discSet = getDiscSetById(text) ?? getDiscSetByName(text);
  return discSet?.name;
}

export function parseStatValues(value: unknown): StatValue[] | undefined {
  if (value === null) return [];
  if (!Array.isArray(value) || value.length > 8) return undefined;
  const result: StatValue[] = [];
  const seen = new Set<StatKey>();
  for (const entry of value) {
    if (!isStatValue(entry)) return undefined;
    const stat = entry.stat;
    if (seen.has(stat)) return undefined;
    if (entry.value !== null && (entry.value < 0 || entry.value > 100000)) return undefined;
    seen.add(stat);
    result.push({ stat, value: entry.value });
  }
  return result;
}

export function parseLegacyStats(value: unknown): StatValue[] | undefined {
  if (value === null) return [];
  if (!Array.isArray(value) || value.length > 8) return undefined;
  const result: StatValue[] = [];
  const seen = new Set<StatKey>();
  for (const entry of value) {
    if (!isStatKey(entry) || seen.has(entry)) return undefined;
    seen.add(entry);
    result.push({ stat: entry, value: null });
  }
  return result;
}

export function parseDiscs(value: unknown): ZzzDisc[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 6) return undefined;
  const slots = new Set<number>();
  const result: ZzzDisc[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.slot !== 'number' || !Number.isSafeInteger(raw.slot) || raw.slot < 1 || raw.slot > 6) return undefined;
    if (slots.has(raw.slot)) return undefined;
    slots.add(raw.slot);

    let mainStat: string | null = null;
    if (raw.mainStat !== undefined && raw.mainStat !== null) {
      if (typeof raw.mainStat !== 'string' || raw.mainStat.trim().length > 80) return undefined;
      mainStat = raw.mainStat.trim() || null;
    }
    let mainValue: number | null = null;
    if (raw.mainValue !== undefined && raw.mainValue !== null) {
      if (typeof raw.mainValue !== 'number' || !Number.isFinite(raw.mainValue)) return undefined;
      mainValue = raw.mainValue;
    }

    const subStats: { stat: string; value: number }[] = [];
    if (raw.subStats !== undefined) {
      if (!Array.isArray(raw.subStats)) return undefined;
      for (const sub of raw.subStats) {
        if (!sub || typeof sub !== 'object' || Array.isArray(sub)) return undefined;
        const rawSub = sub as Record<string, unknown>;
        if (typeof rawSub.stat !== 'string' || !rawSub.stat.trim() || rawSub.stat.trim().length > 80) return undefined;
        if (typeof rawSub.value !== 'number' || !Number.isFinite(rawSub.value)) return undefined;
        subStats.push({ stat: rawSub.stat.trim(), value: rawSub.value });
      }
    }
    result.push({ slot: raw.slot, mainStat, mainValue, subStats });
  }
  return result;
}

export function parseOrderedIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') return undefined;
    const id = entry.trim();
    if (!id || seen.has(id)) return undefined;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function isZzzType(value: string): value is 'wengine' | 'disc' | 'agent' {
  return value === 'wengine' || value === 'disc' || value === 'agent';
}

export function isZzzSpecialty(value: string): boolean {
  return isSpecialty(value);
}
