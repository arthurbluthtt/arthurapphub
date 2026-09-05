-- Migración: tabla `media` para la sub-app MediaTracker.
-- Cada fila = un item audiovisual (película o serie) del usuario con su estado.
-- `media_type` distingue películas ('movie') de series ('tv').
-- `external_id` es el id de TMDB (INTEGER). `cover_url` apunta al poster de
-- TMDB (w342, CDN estable). `year` se extrae de release_date/first_air_date.
-- `status` es uno de: backlog (Por ver, default) | watching (Mirando) |
-- finished (Terminada).
-- La UNIQUE (username, external_id) es PARCIAL: solo aplica si external_id
-- IS NOT NULL. Los items manuales (external_id NULL) no colisionan entre sí,
-- y el duplicado por TMDB (mismo external_id) sigue dando 409.

CREATE TABLE IF NOT EXISTS media (
  username     TEXT NOT NULL,
  id           TEXT NOT NULL,
  external_id  INTEGER,
  media_type   TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_user_external
  ON media(username, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_user_status
  ON media(username, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_user_type
  ON media(username, media_type, created_at DESC);
