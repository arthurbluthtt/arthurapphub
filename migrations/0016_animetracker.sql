-- AnimeTracker: tabla anime por usuario (copia rich de media)
CREATE TABLE IF NOT EXISTS anime (
  username     TEXT NOT NULL,
  id           TEXT NOT NULL,
  external_id  INTEGER,
  anime_type   TEXT NOT NULL CHECK (anime_type IN ('tv', 'movie')),
  title        TEXT NOT NULL,
  cover_url    TEXT,
  year         INTEGER,
  director     TEXT,
  genre        TEXT,
  status       TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'watching', 'finished')),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (username, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_anime_user_external
  ON anime(username, external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_anime_user_status
  ON anime(username, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_anime_user_type
  ON anime(username, anime_type, created_at DESC);
