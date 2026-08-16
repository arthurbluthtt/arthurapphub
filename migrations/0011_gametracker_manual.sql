-- Migración: agrega soporte de juegos manuales (fuera de Steam) a `games`.
--
-- SQLite no permite quitar NOT NULL sin reconstruir la tabla, así que se
-- recrea `games` con `app_id` y `cover_url` NULL-ables:
--   - app_id NULL = juego agregado manualmente (no está en Steam).
--   - cover_url NULL = sin portada → la card muestra un placeholder.
--
-- El índice UNIQUE pasa a ser PARCIAL (WHERE app_id IS NOT NULL): los
-- juegos manuales (app_id NULL) no colisionan entre sí, y el duplicado
-- por Steam (mismo app_id) sigue dando 409.

CREATE TABLE games_new (
  username   TEXT NOT NULL,
  id         TEXT NOT NULL,
  app_id     INTEGER,
  name       TEXT NOT NULL,
  cover_url  TEXT,
  year       INTEGER,
  status     TEXT NOT NULL DEFAULT 'backlog',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (username, id)
);

INSERT INTO games_new (username, id, app_id, name, cover_url, year, status, created_at, updated_at)
  SELECT username, id, app_id, name, cover_url, year, status, created_at, updated_at FROM games;

DROP TABLE games;

ALTER TABLE games_new RENAME TO games;

CREATE UNIQUE INDEX IF NOT EXISTS idx_games_user_appid
  ON games(username, app_id)
  WHERE app_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_games_user_status
  ON games(username, status, created_at DESC);
