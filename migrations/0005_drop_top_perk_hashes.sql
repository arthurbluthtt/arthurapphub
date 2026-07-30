-- Migración: dropea la columna legacy `top_perk_hashes`.
-- Ya no se usa: el nuevo flujo almacena perks en `perks_json`.
-- (Filas restantes con perks_json válido no se ven afectadas.)
ALTER TABLE d2_wishlist DROP COLUMN top_perk_hashes;
