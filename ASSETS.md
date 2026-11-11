# WARBOUND — Assets externes et licences

Tous les assets externes de WARBOUND 2.0 sont sous licence **CC0 1.0** (domaine public : usage commercial, modification et redistribution libres, sans attribution obligatoire). Les crédits ci-dessous sont donnés par courtoisie.

Les fichiers optimisés sont dans `public/assets/` et copiés tels quels dans `dist/`. Ils sont régénérés par :

```bash
bash tools/assets/fetch-sources.sh      # télécharge les sources (≈ 450 Mo, hors dépôt)
node tools/assets/build-assets.mjs      # optimise : meshopt, textures 1024 px, sons Ogg mono
```

| Dossier | Contenu | Auteur | Licence | Source vérifiée |
| --- | --- | --- | --- | --- |
| `models/weapons/` (11 armes) | *Flat Guns West* et *Flat Guns East* : fusils d'assaut, SMG, précision, pistolet, armes riggées (chargeur, culasse, glissière) | Publié sur OpenGameArt (« CC0 Flat Guns West / East ») | CC0 1.0 | Dépôt `petroulacl/fps-asset-kit` (README : CC0, liens OpenGameArt) |
| `models/weapons/ash.glb` | Revolver (*Survival Pack*) | Quaternius | CC0 1.0 | `trebeljahr/quaternius-showcase`, fichier `LICENSES.md` |
| `models/chars/` | Personnages *Ultimate Modular Men / Women* (Swat, Soldier, Witch, King, Spacesuit), *Easy Enemy* (araignée), *Animated Knight*, *Animated Animals* (loup), *Cyberpunk Game Kit* (drone), *Animated Mech* (George) | Quaternius | CC0 1.0 | `trebeljahr/quaternius-showcase`, `LICENSES.md` |
| `models/anims/ual.glb` | *Universal Animation Library* (édition gratuite), squelette et 25 animations, sans le maillage du mannequin | Quaternius | CC0 1.0 | `J-Ponzo/gltf-universal-animation-library` (fichier `LICENSE`) |
| `models/props/` | Décors : *Modular Sci-Fi*, *Cyberpunk Game Kit*, *Survival Pack*, *Modular Dungeon*, *Modular Streets*, *Buildings Pack 3*, *Animated Tanks*, *Ultimate Nature* | Quaternius | CC0 1.0 | `trebeljahr/quaternius-showcase`, `LICENSES.md` |
| `textures/` | 16 matériaux PBR (béton, métal, asphalte, briques, roche, sol, plâtre, bois) réduits en 1024 px | ambientCG | CC0 1.0 | Dépôt `petroulacl/fps-asset-kit` (README : CC0) |
| `sounds/*.ogg` (tirs) | *The Free Firearm Sound Library* : enregistrements réels (AR-15, AK-47, SKS, PPSh, M45, 1911, Walther PPQ, S&W 642, Tikka, Savage, Mossberg) | Publié sur OpenGameArt | CC0 1.0 | Dépôt `petroulacl/fps-asset-kit` |
| `sounds/step_*.ogg` | *Fantozzi's Footsteps* (sable, pierre) | Fantozzi, OpenGameArt | CC0 1.0 | Dépôt `petroulacl/fps-asset-kit` |

## Limite de vérification

Les sites d'origine (quaternius.com, opengameart.org, ambientcg.com) ne sont pas accessibles depuis l'environnement où le jeu a été construit. Les licences ont été vérifiées dans les fichiers de licence et README des dépôts GitHub miroirs listés ci-dessus, pas directement sur les pages d'origine. Avant une publication commerciale, il est conseillé de reconfirmer la licence sur chaque page source.

Tout le reste (niveaux, effets, interface, musique, sons de compétences) est créé par le code du jeu.
