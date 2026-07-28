-- Clean slate (borra el legacy 'default' + sesiones + códigos)
DELETE FROM pin_credentials;
DELETE FROM sessions;
DELETE FROM auth_codes;

-- Reemplaza pin_credentials con esquema username-aware
DROP TABLE pin_credentials;
CREATE TABLE pin_credentials (
  username    TEXT PRIMARY KEY,
  pin_hash    TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);