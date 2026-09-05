-- ZZZ: orden manual por importancia (position)
ALTER TABLE zzz_builds ADD COLUMN position INTEGER;
UPDATE zzz_builds SET position = (
  SELECT COUNT(*) FROM zzz_builds b2
  WHERE b2.username = zzz_builds.username AND b2.created_at < zzz_builds.created_at
);
CREATE INDEX IF NOT EXISTS idx_zzz_user_position ON zzz_builds(username, position);
