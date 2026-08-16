-- Migración: tabla `games` para la sub-app GameTracker.
-- Cada fila = un juego del usuario con su estado actual.
-- `app_id` es el appid de Steam (INTEGER). `cover_url` apunta al header_image de
-- Steam (460x215, CDN estable). `year` se extrae de release_date en el add.
-- `status` es uno de: backlog (Por jugar, default) | playing (Jugando) |
-- dropped (Dropeado) | finished (Terminado).
-- La UNIQUE (username, app_id) da 409 en duplicados.

CREATE TABLE IF NOT EXISTS games (
  username   TEXT NOT NULL,
  id         TEXT NOT NULL,
  app_id     INTEGER NOT NULL,
  name       TEXT NOT NULL,
  cover_url  TEXT NOT NULL,
  year       INTEGER,
  status     TEXT NOT NULL DEFAULT 'backlog',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (username, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_games_user_appid
  ON games(username, app_id);

CREATE INDEX IF NOT EXISTS idx_games_user_status
  ON games(username, status, created_at DESC);
