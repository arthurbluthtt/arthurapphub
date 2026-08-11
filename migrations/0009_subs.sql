-- Migración: tabla `subs` para la sub-app Suscripciones.
-- Cada fila = una suscripción mensual del usuario.
-- `price_cents` guarda el precio en centavos (enteros, sin floats).
-- `billing_day` es el día del mes en que se cobra (1-31, clampeado al último
-- día en meses cortos).
-- `active` distingue activas de pausadas: solo las activas suman al total del mes.

CREATE TABLE IF NOT EXISTS subs (
  username    TEXT NOT NULL,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'MXN',
  billing_day INTEGER NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (username, id)
);

CREATE INDEX IF NOT EXISTS idx_subs_user_active
  ON subs(username, active, created_at DESC);
