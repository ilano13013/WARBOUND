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

## Version 2.2 — assets Poly Haven et ambientCG (téléchargés directement à la source)

Récupérés par `node tools/assets/fetch-polyhaven.mjs` (API `api.polyhaven.com`, fichiers `dl.polyhaven.org`, `ambientcg.com`), convertis par `node tools/assets/build-assets.mjs polyhaven`. Couleur et normale en 2K, carte AO/rugosité/métal en 1K, maillages lourds simplifiés puis compressés (meshopt).

| Fichier | Asset | Auteur | Licence | Traitement |
| --- | --- | --- | --- | --- |
| `models/props/ph_pipes.glb` | *Modular Industrial Pipes 01* | Jorge Camacho, Poly Haven | CC0 1.0 | 8 pièces, 12 340 triangles |
| `models/props/ph_airduct.glb` | *Modular Airduct Rectangular 01* | James Ray Cock, Poly Haven | CC0 1.0 | pièces de gaine, grilles et raccords |
| `models/props/ph_generator.glb` | *Portable Generator* | James Ray Cock, Poly Haven | CC0 1.0 | 26 400 → environ 12 000 triangles |
| `models/props/ph_barrier.glb` | *Concrete Road Barrier* | Amal Kumar, Poly Haven | CC0 1.0 | 60 900 → 6 100 triangles |
| `models/props/ph_rockface.glb` | *Rock Face 01* | Dario Barresi, Poly Haven | CC0 1.0 | 20 200 → 4 400 triangles |
| `textures/ruinwall_*.jpg` | *Rabdentse Ruins Wall* (dalle de 2 m) | Amal Kumar, Poly Haven | CC0 1.0 | 2K |
| `textures/concrete_damaged_*.jpg` | *Concrete 042 D* | ambientCG | CC0 1.0 | 2K |

Les noms d'auteurs viennent de l'API Poly Haven. La page de licence du site (`polyhaven.com/license`) n'a pas pu être ouverte depuis l'environnement de construction (hôte non autorisé) : la licence CC0 est celle annoncée par Poly Haven et ambientCG pour l'ensemble de leurs catalogues.

### Assets demandés mais non intégrés (téléchargement soumis à un compte)

| Asset | Blocage | À fournir |
| --- | --- | --- |
| *AK-47 Assault rifle*, Nneako (Sketchfab, CC BY 4.0) | Le téléchargement Sketchfab exige une connexion | L'archive téléchargée (glTF de préférence, ou FBX + textures) déposée dans `tools/assets/incoming/ak47/` |
| *Quantum Modular Character Free Sample* (Fab, licence Fab Standard) | Acquisition et téléchargement via un compte Epic | Le FBX et ses textures dans `tools/assets/incoming/quantum/` |

Ces deux modèles ne sont pas dans le jeu : l'Aegis-762 et les PNJ de Fort Aegis utilisent toujours les modèles de la 2.0.

## Limite de vérification

Les sites d'origine (quaternius.com, opengameart.org, ambientcg.com) ne sont pas accessibles depuis l'environnement où le jeu a été construit. Les licences ont été vérifiées dans les fichiers de licence et README des dépôts GitHub miroirs listés ci-dessus, pas directement sur les pages d'origine. Avant une publication commerciale, il est conseillé de reconfirmer la licence sur chaque page source.

## Polices

| Paquet | Usage | Licence |
| --- | --- | --- |
| `@fontsource/cinzel` | Titres, logo | SIL Open Font License 1.1 |
| `@fontsource/rajdhani` | Interface, HUD | SIL Open Font License 1.1 |

Les polices sont embarquées dans le build par Vite (aucun appel à un service externe).

Tout le reste (niveaux, effets, interface, musique, sons de compétences) est créé par le code du jeu.
