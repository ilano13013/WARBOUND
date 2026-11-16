-- Niveaux d'armes multijoueur : XP par arme (JSON { arme: xp }). Ajout de colonne uniquement.
ALTER TABLE players ADD COLUMN mp_weapons TEXT;
