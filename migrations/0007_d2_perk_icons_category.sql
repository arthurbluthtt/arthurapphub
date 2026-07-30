-- Migración: agrega columna `category` a d2_perk_icons para que el
-- usuario pueda asignar manualmente el tipo del perk (Barrel | Magazine
-- | Trait | NULL). Cuando es NULL, el perk aparece en la seccion
-- "Custom" en todos los inputs del picker. Cuando tiene valor, se
-- filtra al input correcto (Cañón / Cargador / Rasgo).
ALTER TABLE d2_perk_icons ADD COLUMN category TEXT;
