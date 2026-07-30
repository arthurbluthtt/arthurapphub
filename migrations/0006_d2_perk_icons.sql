-- Migración: pool de iconos custom para perks.
-- Tabla per-usuario que mapea (perk_name_lower) → icon_path (URL de Bungie
-- CDN, R2, o externa). Usada cuando una perk se guarda con hash vacío
-- (no la encontramos en el manifest), para mostrar un icono manual.
CREATE TABLE IF NOT EXISTS d2_perk_icons (
  username TEXT NOT NULL,
  perk_name_lower TEXT NOT NULL,
  perk_name_display TEXT NOT NULL,
  icon_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (username, perk_name_lower)
);
CREATE INDEX IF NOT EXISTS idx_d2_perk_icons_user ON d2_perk_icons(username);
