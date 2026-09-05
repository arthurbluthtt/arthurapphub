-- Migración: tabla `manga` para la sub-app MangaTracker.
-- Cada fila = un manga/manhwa/manhua del usuario con su estado.
-- `manga_type` distingue manga ('manga') de manhwa ('manhwa') y manhua ('manhua').
-- `external_id` es el id de Kitsu (INTEGER). `cover_url` apunta al cover
-- de Kitsu (posterImage.large, CDN estable).
-- `status` es uno de: backlog (Por leer, default) | reading (Leyendo) |
-- finished (Terminado).
-- La UNIQUE (username, external_id) es PARCIAL: solo aplica si external_id
-- IS NOT NULL. Los items manuales (external_id NULL) no colisionan entre sí,
-- y el duplicado por Kitsu (mismo external_id) sigue dando 409.

CREATE TABLE IF NOT EXISTS manga (
  username     TEXT NOT NULL,
  id           TEXT NOT NULL,
  external_id  INTEGER,
  manga_type   TEXT NOT NULL CHECK (manga_type IN ('manga', 'manhwa', 'manhua')),
  title        TEXT NOT NULL,
  cover_url    TEXT,
  status       TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'reading', 'finished')),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (username, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manga_user_external
  ON manga(username, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_manga_user_status
  ON manga(username, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manga_user_type
  ON manga(username, manga_type, created_at DESC);
