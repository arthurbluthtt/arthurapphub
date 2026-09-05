export async function listArchivedAppIds(
  db: D1Database,
  username: string
): Promise<Set<string>> {
  const rows = await db
    .prepare('SELECT app_id FROM app_archives WHERE username = ? ORDER BY archived_at ASC')
    .bind(username)
    .all<{ app_id: string }>();

  return new Set(rows.results.map((row) => row.app_id));
}

export async function setAppArchived(
  db: D1Database,
  username: string,
  appId: string,
  archived: boolean
): Promise<void> {
  if (archived) {
    await db
      .prepare(
        `INSERT INTO app_archives (username, app_id, archived_at)
         VALUES (?, ?, ?)
         ON CONFLICT(username, app_id) DO UPDATE SET archived_at = excluded.archived_at`
      )
      .bind(username, appId, Date.now())
      .run();
    return;
  }

  await db
    .prepare('DELETE FROM app_archives WHERE username = ? AND app_id = ?')
    .bind(username, appId)
    .run();
}
