-- ZZZ: stat_values con número (stat + value), mantiene display_stats legacy
ALTER TABLE zzz_builds ADD COLUMN stat_values TEXT;
-- Migra display_stats ["ATK"] → stat_values [{"stat":"ATK","value":null}] si stat_values es NULL
UPDATE zzz_builds SET stat_values = display_stats WHERE stat_values IS NULL AND display_stats IS NOT NULL;
