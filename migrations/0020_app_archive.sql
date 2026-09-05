-- Preferencias de visibilidad del hub por usuario.
-- La ausencia de una fila significa que la app está activa.
CREATE TABLE IF NOT EXISTS app_archives (
  username TEXT NOT NULL,
  app_id TEXT NOT NULL,
  archived_at INTEGER NOT NULL,
  PRIMARY KEY (username, app_id)
);

CREATE INDEX IF NOT EXISTS idx_app_archives_username
  ON app_archives(username);
