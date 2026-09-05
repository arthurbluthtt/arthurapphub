-- ZZZ Builds: una build por personaje por usuario (manual foto + scraper W-Engines/Disc Sets)
CREATE TABLE IF NOT EXISTS zzz_builds (
  username      TEXT NOT NULL,
  id            TEXT NOT NULL,
  character_name TEXT NOT NULL,
  cover_url     TEXT,
  w_engine_id   TEXT,
  w_engine_name TEXT,
  disc_set_4    TEXT,
  disc_set_2    TEXT,
  discs_json    TEXT,
  display_stats TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (username, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zzz_user_character
  ON zzz_builds(username, lower(character_name));

CREATE INDEX IF NOT EXISTS idx_zzz_user_created
  ON zzz_builds(username, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_zzz_user_wengine
  ON zzz_builds(username, w_engine_id, created_at DESC) WHERE w_engine_id IS NOT NULL;
