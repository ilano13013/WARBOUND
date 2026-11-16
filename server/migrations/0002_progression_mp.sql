-- Progression multijoueur sur le compte : XP totale et classes personnalisées (JSON). Ajout de colonnes uniquement.
ALTER TABLE players ADD COLUMN mp_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN mp_classes TEXT;
