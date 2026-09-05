/**
 * CRUD para ZZZ Builds — una build por personaje por usuario.
 * Foto manual (cover_url nullable), W-Engine + Disc Sets scrapeados.
 * discs_json/display_stats como JSON (como d2 perks_json).
 */
import { isStatKey, isStatValue, type StatKey, type StatValue } from './constants';

export interface ZzzDisc {
  slot: number; // 1..6
  mainStat: string | null;
  mainValue: number | null;
  subStats: { stat: string; value: number }[];
}

export interface ZzzRow {
  id: string;
  characterName: string;
  coverUrl: string | null;
  wEngineId: string | null;
  wEngineName: string | null;
  discSet4: string | null;
  discSet2: string | null;
  discs: ZzzDisc[] | null;
  statValues: StatValue[];
  /** compat alias */
  displayStats: StatKey[];
  position: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ZzzInput {
  characterName: string;
  coverUrl: string | null;
  wEngineId: string | null;
  wEngineName: string | null;
  discSet4: string | null;
  discSet2: string | null;
  discs: ZzzDisc[] | null;
  statValues: StatValue[];
}

interface D1Row {
  id: string;
  character_name: string;
  cover_url: string | null;
  w_engine_id: string | null;
  w_engine_name: string | null;
  disc_set_4: string | null;
  disc_set_2: string | null;
  discs_json: string | null;
  display_stats: string | null;
  stat_values?: string | null;
  position?: number | null;
  created_at: number;
  updated_at: number;
}

function parseDiscs(raw: string | null): ZzzDisc[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    return v.filter(
      (d) => typeof d === 'object' && d !== null && typeof d.slot === 'number'
    ) as ZzzDisc[];
  } catch {
    return null;
  }
}

function parseStatValues(raw: string | null | undefined, legacyRaw: string | null): StatValue[] {
  // `stat_values` es canónico cuando existe, incluso si contiene [] para
  // representar una limpieza explícita. Solo las instalaciones anteriores a
  // 0018 leen `display_stats`.
  const src = raw !== undefined && raw !== null ? raw : legacyRaw;
  if (!src) return [];
  try {
    const v = JSON.parse(src);
    if (!Array.isArray(v)) return [];
    // legacy ["ATK"] → [{stat:"ATK",value:null}]
    if (v.length && typeof v[0] === 'string') {
      return (v as unknown[]).filter(isStatKey).map((s) => ({ stat: s as StatKey, value: null }));
    }
    return (v as unknown[]).filter(isStatValue) as StatValue[];
  } catch {
    return [];
  }
}

function toRow(r: D1Row): ZzzRow {
  const statValues = parseStatValues(r.stat_values, r.display_stats);
  return {
    id: r.id,
    characterName: r.character_name,
    coverUrl: r.cover_url,
    wEngineId: r.w_engine_id,
    wEngineName: r.w_engine_name,
    discSet4: r.disc_set_4,
    discSet2: r.disc_set_2,
    discs: parseDiscs(r.discs_json),
    statValues,
    displayStats: statValues.map((s) => s.stat),
    position: r.position ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listZzz(db: D1Database, username: string): Promise<ZzzRow[]> {
  // stat_values may not exist before 0018, position before 0019 — fallbacks
  const tryOrders = [
    `SELECT id, character_name, cover_url, w_engine_id, w_engine_name,
                disc_set_4, disc_set_2, discs_json, display_stats, stat_values, position,
                created_at, updated_at
         FROM zzz_builds WHERE username=? ORDER BY COALESCE(position, 999999), created_at ASC, id ASC`,
    `SELECT id, character_name, cover_url, w_engine_id, w_engine_name,
                disc_set_4, disc_set_2, discs_json, display_stats, stat_values,
                created_at, updated_at
         FROM zzz_builds WHERE username=? ORDER BY created_at DESC, id ASC`,
    `SELECT id, character_name, cover_url, w_engine_id, w_engine_name,
                disc_set_4, disc_set_2, discs_json, display_stats,
                created_at, updated_at
         FROM zzz_builds WHERE username=? ORDER BY created_at DESC, id ASC`,
  ];
  for (const sql of tryOrders) {
    try {
      const res = await db.prepare(sql).bind(username).all<D1Row>();
      const rows = (res.results ?? []) as unknown as D1Row[];
      return rows
        .map((r) => ({
          ...r,
          position: r.position ?? null,
          stat_values: r.stat_values ?? null,
        }))
        .map(toRow);
    } catch (e) {
      if (e instanceof Error && /no such column/i.test(e.message)) continue;
      throw e;
    }
  }
  return [];
}

export async function isDuplicateCharacter(
  db: D1Database,
  username: string,
  characterName: string,
  excludeId: string | null = null
): Promise<boolean> {
  const sql =
    excludeId === null
      ? 'SELECT 1 AS x FROM zzz_builds WHERE username=? AND lower(character_name)=lower(?) LIMIT 1'
      : 'SELECT 1 AS x FROM zzz_builds WHERE username=? AND lower(character_name)=lower(?) AND id != ? LIMIT 1';
  const stmt = db.prepare(sql);
  const row =
    excludeId === null
      ? await stmt.bind(username, characterName).first()
      : await stmt.bind(username, characterName, excludeId).first();
  return row !== null;
}

export async function addZzz(
  db: D1Database,
  username: string,
  input: ZzzInput,
  id: string
): Promise<ZzzRow | 'duplicate'> {
  const now = Date.now();
  const discsJson = input.discs ? JSON.stringify(input.discs) : null;
  const statValuesJson = input.statValues.length ? JSON.stringify(input.statValues) : null;
  const legacyJson = input.statValues.length ? JSON.stringify(input.statValues.map((s) => s.stat)) : null;
  // compute next position (append al final)
  let nextPos = 0;
  let storedPosition: number | null = null;
  try {
    const r = await db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS nextPos FROM zzz_builds WHERE username=?').bind(username).first<{ nextPos: number }>();
    nextPos = r?.nextPos ?? 0;
    storedPosition = nextPos;
  } catch {}
  // try stat_values+position, fallback step by step
  const tryInsert = async (variant: 'full' | 'noPosition' | 'legacy') => {
    let cols: string, placeholders: string, vals: unknown[];
    if (variant === 'full') {
      cols = '(username,id,character_name,cover_url,w_engine_id,w_engine_name,disc_set_4,disc_set_2,discs_json,display_stats,stat_values,position,created_at,updated_at)';
      placeholders = '?,?,?,?,?,?,?,?,?,?,?,?,?,?';
      vals = [username, id, input.characterName, input.coverUrl, input.wEngineId, input.wEngineName, input.discSet4, input.discSet2, discsJson, legacyJson, statValuesJson, nextPos, now, now];
    } else if (variant === 'noPosition') {
      cols = '(username,id,character_name,cover_url,w_engine_id,w_engine_name,disc_set_4,disc_set_2,discs_json,display_stats,stat_values,created_at,updated_at)';
      placeholders = '?,?,?,?,?,?,?,?,?,?,?,?,?';
      vals = [username, id, input.characterName, input.coverUrl, input.wEngineId, input.wEngineName, input.discSet4, input.discSet2, discsJson, legacyJson, statValuesJson, now, now];
    } else {
      cols = '(username,id,character_name,cover_url,w_engine_id,w_engine_name,disc_set_4,disc_set_2,discs_json,display_stats,created_at,updated_at)';
      placeholders = '?,?,?,?,?,?,?,?,?,?,?,?';
      vals = [username, id, input.characterName, input.coverUrl, input.wEngineId, input.wEngineName, input.discSet4, input.discSet2, discsJson, legacyJson, now, now];
    }
    await db.prepare(`INSERT INTO zzz_builds ${cols} VALUES (${placeholders})`).bind(...vals).run();
  };
  try {
    try {
      await tryInsert('full');
    } catch (e) {
      if (e instanceof Error && /no such column/i.test(e.message)) {
        storedPosition = null;
        try { await tryInsert('noPosition'); } catch (e2) {
          if (e2 instanceof Error && /no such column/i.test(e2.message)) await tryInsert('legacy');
          else throw e2;
        }
      } else throw e;
    }
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) return 'duplicate';
    throw err;
  }
  return {
    id,
    characterName: input.characterName,
    coverUrl: input.coverUrl,
    wEngineId: input.wEngineId,
    wEngineName: input.wEngineName,
    discSet4: input.discSet4,
    discSet2: input.discSet2,
    discs: input.discs,
    statValues: input.statValues,
    displayStats: input.statValues.map((s) => s.stat),
    position: storedPosition,
    createdAt: now,
    updatedAt: now,
  };
}

export async function removeZzz(db: D1Database, username: string, id: string): Promise<boolean> {
  const res = await db.prepare('DELETE FROM zzz_builds WHERE username=? AND id=?').bind(username, id).run();
  return (res.meta?.changes ?? 0) > 0;
}

export type EditField = 'characterName' | 'coverUrl' | 'wEngineId' | 'wEngineName' | 'discSet4' | 'discSet2' | 'discs' | 'statValues' | 'displayStats';
export type EditPatch = Partial<{
  characterName: string;
  coverUrl: string | null;
  wEngineId: string | null;
  wEngineName: string | null;
  discSet4: string | null;
  discSet2: string | null;
  discs: ZzzDisc[] | null;
  statValues: StatValue[];
  displayStats: StatKey[];
}>;
export type EditResult = { ok: true; build: ZzzRow } | { ok: false; reason: 'not-found' | 'duplicate' | 'no-fields' };

export async function reorderZzz(db: D1Database, username: string, orderedIds: string[]): Promise<boolean> {
  if (!orderedIds.length) return false;
  // validar permutación exacta
  const rows = await db.prepare('SELECT id FROM zzz_builds WHERE username=?').bind(username).all<{ id: string }>();
  const existing = new Set((rows.results ?? []).map((r) => r.id));
  if (existing.size !== orderedIds.length) return false;
  if (new Set(orderedIds).size !== orderedIds.length) return false;
  for (const id of orderedIds) if (!existing.has(id)) return false;
  const now = Date.now();
  const stmt = db.prepare('UPDATE zzz_builds SET position=?, updated_at=? WHERE username=? AND id=?');
  const batch = orderedIds.map((id, idx) => stmt.bind(idx, now, username, id));
  try {
    await db.batch(batch as unknown as D1PreparedStatement[]);
  } catch (err) {
    // Una instalación anterior a 0019 puede seguir leyendo builds, pero no
    // puede persistir un orden manual hasta aplicar esa migración.
    if (err instanceof Error && /no such column: position/i.test(err.message)) return false;
    throw err;
  }
  return true;
}

export async function editZzz(
  db: D1Database,
  username: string,
  id: string,
  patch: EditPatch
): Promise<EditResult> {
  // normalize displayStats legacy → statValues
  if ('displayStats' in patch && !('statValues' in patch)) {
    const legacy = patch.displayStats as StatKey[] | undefined;
    if (legacy) patch.statValues = legacy.map((s) => ({ stat: s, value: null }));
  }
  const fieldMap: Record<EditField, string> = {
    characterName: 'character_name',
    coverUrl: 'cover_url',
    wEngineId: 'w_engine_id',
    wEngineName: 'w_engine_name',
    discSet4: 'disc_set_4',
    discSet2: 'disc_set_2',
    discs: 'discs_json',
    statValues: 'stat_values',
    displayStats: 'display_stats',
  };
  const keys = ['characterName', 'coverUrl', 'wEngineId', 'wEngineName', 'discSet4', 'discSet2', 'discs', 'statValues'] as const;
  const fields: string[] = [];
  const values: (string | null)[] = [];
  for (const k of keys) {
    if (k in patch) {
      const v = patch[k as keyof EditPatch];
      if (k === 'statValues') {
        const sv = v as StatValue[] | null;
        fields.push('stat_values');
        values.push(sv && sv.length ? JSON.stringify(sv) : null);
        // also keep legacy display_stats for compat
        fields.push('display_stats');
        values.push(sv && sv.length ? JSON.stringify(sv.map((x) => x.stat)) : null);
      } else if (k === 'discs') {
        fields.push(fieldMap[k as EditField]);
        values.push(v != null ? JSON.stringify(v as ZzzDisc[]) : null);
      } else {
        fields.push(fieldMap[k as EditField]);
        values.push((v as string | null) ?? null);
      }
    }
  }
  // handle displayStats legacy alone if somehow only that present
  if ('displayStats' in patch && !('statValues' in patch)) {
    const legacy = patch.displayStats as StatKey[] | null;
    fields.push('display_stats');
    values.push(legacy && legacy.length ? JSON.stringify(legacy) : null);
    fields.push('stat_values');
    values.push(legacy && legacy.length ? JSON.stringify(legacy.map((s) => ({ stat: s, value: null }))) : null);
  }
  if (fields.length === 0) return { ok: false, reason: 'no-fields' };
  const now = Date.now();
  // La instalación final soporta ambas columnas nuevas. Los caminos
  // anteriores permiten leer/escribir una base que aún no recibió 0018/0019.
  const tryUpdate = async (withStatValues: boolean, withPosition: boolean) => {
    const entries = fields
      .map((field, index) => ({ field, value: values[index] }))
      .filter(({ field }) => withStatValues || field !== 'stat_values');
    const setFields = entries.map(({ field }) => `${field}=?`);
    const setValues = entries.map(({ value }) => value);
    const returningOptional = withStatValues ? ', stat_values' : '';
    const returningPosition = withPosition ? ', position' : '';
    const sql = `UPDATE zzz_builds SET ${setFields.join(', ')}, updated_at=?
                 WHERE username=? AND id=?
                 RETURNING id, character_name, cover_url, w_engine_id, w_engine_name,
                           disc_set_4, disc_set_2, discs_json, display_stats${returningOptional}${returningPosition},
                           created_at, updated_at`;
    return db.prepare(sql).bind(...setValues, now, username, id).first<D1Row>();
  };
  try {
    let row: D1Row | null;
    try {
      row = await tryUpdate(true, true);
    } catch (e) {
      if (!(e instanceof Error) || !/no such column/i.test(e.message)) throw e;
      try {
        row = await tryUpdate(true, false);
      } catch (e2) {
        if (!(e2 instanceof Error) || !/no such column/i.test(e2.message)) throw e2;
        row = await tryUpdate(false, false);
      }
    }
    if (!row) return { ok: false, reason: 'not-found' };
    return {
      ok: true,
      build: toRow({ ...row, stat_values: row.stat_values ?? null, position: row.position ?? null }),
    };
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) return { ok: false, reason: 'duplicate' };
    throw err;
  }
}
