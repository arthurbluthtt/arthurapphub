-- Migración: tabla `uma_wishlist` para la sub-app Umamusume Cards.
-- Cada fila = un personaje agregado a la wishlist del usuario.
-- Las recomendaciones de cartas se leen desde data/uma/recommendations.json
-- (estático, regenerado con `npm run build:uma-data`), no se guardan acá.

CREATE TABLE IF NOT EXISTS uma_wishlist (
  username TEXT NOT NULL,
  character_id TEXT NOT NULL,
  found INTEGER NOT NULL DEFAULT 0,
  found_at INTEGER,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (username, character_id)
);

CREATE INDEX IF NOT EXISTS idx_uma_wishlist_user_found
  ON uma_wishlist(username, found, added_at DESC);