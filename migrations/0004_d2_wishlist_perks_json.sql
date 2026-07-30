-- Migración: agrega perks_json a d2_wishlist para soportar 4 perks
-- (cañón, cargador, rasgo 1, rasgo 2).
--
-- Filas existentes con top_perk_hashes siguen funcionando:
-- el resolver cae a top_perk_hashes cuando perks_json es NULL.
ALTER TABLE d2_wishlist ADD COLUMN perks_json TEXT;
