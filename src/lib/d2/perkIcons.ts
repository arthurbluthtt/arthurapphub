export interface CustomPerkIcon {
  username: string;
  perkNameLower: string;
  perkNameDisplay: string;
  iconPath: string;
  category: string;
  createdAt: number;
}

export const PERK_CATEGORY_OPTIONS = ['Barrel', 'Magazine', 'Trait'] as const;
export type PerkCategoryOption = (typeof PERK_CATEGORY_OPTIONS)[number];

const PERK_NAME_MAX = 80;

export function normalizeCategory(input: unknown): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  return (PERK_CATEGORY_OPTIONS as readonly string[]).includes(trimmed) ? trimmed : '';
}

export interface CustomPerkIconRow {
  username: string;
  perk_name_lower: string;
  perk_name_display: string;
  icon_path: string;
  category: string | null;
  created_at: number;
}

function toCustomPerkIcon(row: CustomPerkIconRow): CustomPerkIcon {
  return {
    username: row.username,
    perkNameLower: row.perk_name_lower,
    perkNameDisplay: row.perk_name_display,
    iconPath: row.icon_path,
    category: row.category ?? '',
    createdAt: row.created_at,
  };
}

export async function findCustomPerkIcon(
  db: D1Database,
  username: string,
  perkName: string
): Promise<CustomPerkIcon | null> {
  const lower = perkName.trim().toLowerCase();
  if (!lower) return null;
  const row = await db
    .prepare(
      'SELECT username, perk_name_lower, perk_name_display, icon_path, category, created_at FROM d2_perk_icons WHERE username = ? AND perk_name_lower = ?'
    )
    .bind(username, lower)
    .first<CustomPerkIconRow>();
  if (!row) return null;
  return toCustomPerkIcon(row);
}

export async function listCustomPerkIcons(
  db: D1Database,
  username: string
): Promise<CustomPerkIcon[]> {
  const res = await db
    .prepare(
      'SELECT username, perk_name_lower, perk_name_display, icon_path, category, created_at FROM d2_perk_icons WHERE username = ? ORDER BY perk_name_lower'
    )
    .bind(username)
    .all<CustomPerkIconRow>();
  return (res.results ?? []).map(toCustomPerkIcon);
}

export async function saveCustomPerkIcon(
  db: D1Database,
  username: string,
  perkNameDisplay: string,
  iconPath: string,
  category = ''
): Promise<CustomPerkIcon> {
  const display = perkNameDisplay.trim().slice(0, PERK_NAME_MAX);
  const path = iconPath.trim().slice(0, 500);
  const normalizedCategory = normalizeCategory(category);
  if (!display || !path) {
    throw new Error('perkName and iconPath are required');
  }
  const lower = display.toLowerCase();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO d2_perk_icons (username, perk_name_lower, perk_name_display, icon_path, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(username, perk_name_lower) DO UPDATE SET
         perk_name_display = excluded.perk_name_display,
         icon_path = excluded.icon_path,
         category = excluded.category,
         created_at = excluded.created_at`
    )
    .bind(username, lower, display, path, normalizedCategory || null, now)
    .run();
  return {
    username,
    perkNameLower: lower,
    perkNameDisplay: display,
    iconPath: path,
    category: normalizedCategory,
    createdAt: now,
  };
}

export async function deleteCustomPerkIcon(
  db: D1Database,
  username: string,
  perkName: string
): Promise<boolean> {
  const lower = perkName.trim().toLowerCase();
  if (!lower) return false;
  const res = await db
    .prepare(
      'DELETE FROM d2_perk_icons WHERE username = ? AND perk_name_lower = ?'
    )
    .bind(username, lower)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}
