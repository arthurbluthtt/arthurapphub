-- Migración: agrega la columna `saga` a la tabla `games`.
--
-- `saga` es TEXT NULL-ABLE. Es texto libre (no FK) para que el usuario pueda
-- asignar cualquier saga, incluso las que no están en el catálogo seed.
-- El catálogo seed (src/lib/games/sagas.ts) provee sugerencias y la lista
-- del filtro, pero la DB no las restringe.
--
-- Se agrega un índice sobre (username, saga, created_at DESC) para que el
-- filtro por saga sea rápido.

ALTER TABLE games ADD COLUMN saga TEXT;

CREATE INDEX IF NOT EXISTS idx_games_user_saga
  ON games(username, saga, created_at DESC)
  WHERE saga IS NOT NULL;
