# WARBOUND — Assets externes et licences

Les assets **actuellement intégrés au jeu** sont tous sous licence **CC0 1.0** (domaine public : usage commercial, modification et redistribution libres, attribution non obligatoire mais donnée ci-dessous). D'autres licences sont prévues pour des assets en attente (CC BY 4.0, Fab Standard) : elles imposent des obligations différentes, détaillées dans la section « Assets en attente ». Un fichier sous l'une de ces licences n'est **pas** intégré tant que la ligne correspondante n'est pas passée dans un tableau « intégré ».

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

### Version 2.4 — équipement électrique (Poly Haven, CC0)

| Fichier | Asset | Auteur | Licence | Traitement |
| --- | --- | --- | --- | --- |
| `models/props/ph_powerbox.glb` | *Power Box 01* | Rico Cilliers et Yann Kervran, Poly Haven | CC0 1.0 | porte refermée (rotation de charnière annulée), 21 300 → 3 900 triangles, textures 2K (ARM 1K) |
| `models/props/ph_cables.glb` | *Modular Electric Cables* | Kuutti Siitonen, Poly Haven | CC0 1.0 | 49 pièces, 42 000 → 13 700 triangles ; seuls boîtiers, interrupteurs et attaches sont posés (les longues descentes sont des tubes simples) |

Placement : coffret sur une face dégagée de chaque machine (QG, CENDRES, POINT ZÉRO), sur une armoire murale sur deux des habillages techniques, boîtiers de raccordement aux chemins de câbles.

## Assets en attente (non intégrés)

Aucun fichier de cette section n'est dans `public/assets/` ni dans le jeu. Les sources fournies à la main sont rangées dans `tools/assets/incoming/`, **exclu de Git** : les licences Fab et Sketchfab n'autorisent pas la redistribution des fichiers sources.

| Asset | Licence et obligations | État |
| --- | --- | --- |
| *AK-47 Assault rifle*, Nneako ([fiche](https://sketchfab.com/3d-models/ak-47-assault-rifle-948f6b1beeb749759b91bf1d5a6db481)) | CC BY 4.0 ([texte](https://creativecommons.org/licenses/by/4.0/)) : créditer Nneako, lier la licence, indiquer les modifications | **Bloqué** : téléchargement Sketchfab soumis à connexion ; archive à déposer dans `tools/assets/incoming/ak47/`. Le code est prêt à conserver ses matériaux PBR texturés (`GunAssets.remapMaterials`). |
| *Soldier Full Tactical Gear (LowPolyGameReady)*, DanlyVostok ([fiche](https://sketchfab.com/3d-models/soldier-full-tactical-gear-lowpolygameready-850593a8c7114c188395ba1849a66eb9)) | CC BY 4.0 : créditer DanlyVostok (maillage et textures), rig AccuRig (Reallusion) | **Bloqué** : non fourni ; à déposer dans `tools/assets/incoming/tactical_soldier/` |
| *Wall Ceiling Floor Module*, Naked Singularity Studio ([fiche](https://www.fab.com/listings/0e12b2ce-1c5b-40fa-99eb-29ac928b723b)) | Fab Standard ([CLUF](https://www.fab.com/eula)) : usage dans un projet, pas de redistribution des sources, « usage avec l'IA : non » | **Bloqué** : téléchargement Fab soumis à un compte Epic ; à déposer dans `tools/assets/incoming/lab_modules/` |
| *Quantum Modular Character Free Sample* (Fab) | Fab Standard : mêmes conditions | **Fourni sans textures** : 12 FBX reçus (personnage complet 163 000 triangles, squelette Unreal 5). Profil de squelette Unreal ajouté et validé en animation sur une copie de test allégée (repos, visée, marche). Non intégré : les 12 images de texture référencées manquent (`T_Body_BaseColor.png`, `T_Head_BaseColor.png`, `T_Bulletproof_Light_BaseColor.png`, `T_Jeans_Blue_BaseColor.png`, `T_Shirt_RolledUp_Blue_BaseColor.png`, `T_Drops_Tactical_Green_BaseColor.png`, `T_Holster_Hard_BaseColor.png`, `T_Cap_BaseColor.png`, `Rifle_BaseColor.png`, `Eye_BaseColor.png`, `Teeth_Color.tiff`, `Teeth_Roughness.tiff`). |

Note sur la licence Fab : l'asset optimisé et intégré au jeu fait partie du projet distribué ; les fichiers sources du pack ne doivent pas être publiés à part. Si le dépôt GitHub est public, un modèle Fab converti qu'on y committe reste extractible : à confirmer avant de pousser un tel fichier.

## Limite de vérification

Les sites d'origine (quaternius.com, opengameart.org, ambientcg.com) ne sont pas accessibles depuis l'environnement où le jeu a été construit. Les licences ont été vérifiées dans les fichiers de licence et README des dépôts GitHub miroirs listés ci-dessus, pas directement sur les pages d'origine. Avant une publication commerciale, il est conseillé de reconfirmer la licence sur chaque page source.

## Polices

| Paquet | Usage | Licence |
| --- | --- | --- |
| `@fontsource/cinzel` | Titres, logo | SIL Open Font License 1.1 |
| `@fontsource/rajdhani` | Interface, HUD | SIL Open Font License 1.1 |

Les polices sont embarquées dans le build par Vite (aucun appel à un service externe).

Tout le reste (niveaux, effets, interface, musique, sons de compétences) est créé par le code du jeu.
