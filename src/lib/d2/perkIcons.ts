export interface CustomPerkIcon {
  username: string;
  perkNameLower: string;
  perkNameDisplay: string;
  iconPath: string;
  createdAt: number;
}

const PERK_NAME_MAX = 80;

export async function findCustomPerkIcon(
  db: D1Database,
  username: string,
  perkName: string
): Promise<CustomPerkIcon | null> {
  const lower = perkName.trim().toLowerCase();
  if (!lower) return null;
  const row = await db
    .prepare(
      'SELECT username, perk_name_lower, perk_name_display, icon_path, created_at FROM d2_perk_icons WHERE username = ? AND perk_name_lower = ?'
    )
    .bind(username, lower)
    .first<{
      username: string;
      perk_name_lower: string;
      perk_name_display: string;
      icon_path: string;
      created_at: number;
    }>();
  if (!row) return null;
  return {
    username: row.username,
    perkNameLower: row.perk_name_lower,
    perkNameDisplay: row.perk_name_display,
    iconPath: row.icon_path,
    createdAt: row.created_at,
  };
}

export async function listCustomPerkIcons(
  db: D1Database,
  username: string
): Promise<CustomPerkIcon[]> {
  const res = await db
    .prepare(
      'SELECT username, perk_name_lower, perk_name_display, icon_path, created_at FROM d2_perk_icons WHERE username = ? ORDER BY perk_name_lower'
    )
    .bind(username)
    .all<{
      username: string;
      perk_name_lower: string;
      perk_name_display: string;
      icon_path: string;
      created_at: number;
    }>();
  return (res.results ?? []).map((row) => ({
    username: row.username,
    perkNameLower: row.perk_name_lower,
    perkNameDisplay: row.perk_name_display,
    iconPath: row.icon_path,
    createdAt: row.created_at,
  }));
}

export async function saveCustomPerkIcon(
  db: D1Database,
  username: string,
  perkNameDisplay: string,
  iconPath: string
): Promise<CustomPerkIcon> {
  const display = perkNameDisplay.trim().slice(0, PERK_NAME_MAX);
  const path = iconPath.trim().slice(0, 500);
  if (!display || !path) {
    throw new Error('perkName and iconPath are required');
  }
  const lower = display.toLowerCase();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO d2_perk_icons (username, perk_name_lower, perk_name_display, icon_path, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(username, perk_name_lower) DO UPDATE SET
         perk_name_display = excluded.perk_name_display,
         icon_path = excluded.icon_path,
         created_at = excluded.created_at`
    )
    .bind(username, lower, display, path, now)
    .run();
  return {
    username,
    perkNameLower: lower,
    perkNameDisplay: display,
    iconPath: path,
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
