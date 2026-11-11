# WARBOUND — The Fracture Chronicles

FPS 3D / Action-RPG militaire dark fantasy, jouable dans le navigateur (PC). Campagne solo de quatre opérations, trois boss à phases, six classes, progression RPG, butin, QG interactif et mode survie.

Tout le contenu (modèles 3D, textures, effets, sons, musiques) est **généré procéduralement par le code** : aucune ressource externe, aucun service cloud, aucun backend.

## Lancer le jeu

Prérequis : Node.js 18+ (testé avec Node 22).

```bash
npm install        # installe three, vite, typescript
npm run dev        # serveur de développement → http://localhost:5173
```

Build de production (site statique, déployable tel quel) :

```bash
npm run build      # vérifie les types puis génère dist/
npm run preview    # sert dist/ → http://localhost:4173
```

Le dossier `dist/` peut être déposé sur n'importe quel hébergement statique (chemins relatifs).

Navigateur conseillé : Chrome, Edge ou Firefox récents, avec accélération matérielle (WebGL 2). Cliquez dans le jeu pour capturer la souris.

## Lancer sous Windows sans installer Node.js (sans droits administrateur)

Double-cliquez sur **`LANCER-WARBOUND.bat`**. Le script :

1. utilise Node.js s'il est déjà présent (version 18 ou plus) ;
2. sinon télécharge le ZIP portable officiel depuis `nodejs.org`, vérifie son empreinte SHA-256, et le décompresse dans `tools\node` (dans le dossier du jeu) ;
3. au premier lancement, installe les dépendances dans `node_modules` et compile le jeu ;
4. démarre un serveur local sur `http://localhost:4173` (accessible uniquement depuis votre PC) et ouvre le navigateur.

**`BUILD-WARBOUND.bat`** reconstruit le jeu après une modification du code.

Rien n'est installé ni modifié hors du dossier du jeu : pas de droits administrateur, pas de registre, le `PATH` n'est changé que pour la fenêtre du script. Pour tout retirer, supprimez `tools\node`, `node_modules` et `dist`. Si une règle de sécurité du PC bloque le téléchargement ou l'exécution, le script s'arrête avec un message et ne contourne rien.

## Commandes (AZERTY par défaut)

| Action | Touche |
| --- | --- |
| Se déplacer | Z Q S D |
| Viser / tirer | Souris, clic gauche ; clic droit : visée (ADS) |
| Sprint | Maj gauche (double appui : sprint tactique) |
| Sauter / franchir un obstacle | Espace |
| S'accroupir / glisser (pendant le sprint) | Ctrl gauche |
| Recharger | R |
| Interagir | F (maintenir pour certaines actions) |
| Armes | 1, 2 ou molette |
| Compétences 1 / 2 / 3 | A / E / C |
| Capacité ultime | X |
| Grenade | G |
| Personnage, inventaire, talents | Tab |
| Carte et objectifs | M |
| Pause | Échap |

Une disposition QWERTY (WASD, compétence 1 sur Q) et la réassignation de chaque touche sont disponibles dans **Paramètres**. En QWERTY, évitez Ctrl+W dans un onglet non plein écran (raccourci de fermeture du navigateur) : passez en plein écran depuis les paramètres ou réassignez l'accroupissement.

## Contenu jouable

### Structure
- Menu principal avec décor 3D animé, création du personnage, introduction en cinématique moteur.
- **Fort Aegis** (QG en vue FPS) : table tactique, armurerie, terminal de personnage, atelier arcanique, terminal de survie, zone d'entraînement (cibles, simulation de combat), caisses de munitions.
- **Campagne** : quatre opérations liées par une histoire, chacune avec briefing, objectifs, radio, documents à découvrir, points de contrôle, écran de résultats.
  1. **CENDRES** — complexe HELIX, laboratoire, défense du terminal, conduits, boss *Gardien d'Helix*.
  2. **VILLE MORTE** — rues de Varsen, défense de la station de métro, destruction du portail, extraction.
  3. **TEMPLE DU VOILE** — ruines, énigme des trois sceaux, gardiens, cristaux, boss *Archonte du Voile*.
  4. **POINT ZÉRO** — défenses HELIX, trois stabilisateurs, zone altérée, contre-attaque, boss final *Souverain Fracturé*, cinématique de fin et crédits.
- **Protocole Infini** : mode survie par vagues, améliorations temporaires toutes les deux vagues, mini-boss toutes les cinq vagues, score et record.

### Combat
- Contrôleur FPS : marche 5,5 m/s, sprint 8 m/s, sprint tactique, saut, accroupissement, glissade (0,75 s), franchissement d'obstacles, contrôle aérien, FOV 100° réglable.
- **12 armes** (3 fusils d'assaut, 3 SMG, 2 mitrailleuses, 2 fusils de précision, 2 armes de poing) : hitscan, recul réel sur la visée, dispersion dynamique, atténuation à distance, tirs à la tête, rechargements animés, lunette pour les fusils de précision.
- **13 accessoires** (optiques, bouches, chargeurs, poignées, modifications arcaniques) qui modifient les statistiques et le modèle 3D.
- Grenades à fragmentation, barils explosifs, objets destructibles.

### Classes (6)
Vanguard, Bulwark, Lifebinder, Wraith, Arcanist, Ranger : trois compétences actives et une ultime chacune (24 capacités implémentées), deux arbres de cinq talents par classe (60 talents), bonus d'affinité d'arme.

### Ennemis et IA
Huit archétypes (fantassin, tireur d'élite, briseur de ligne à bouclier, dévoreur, arcaniste, drone, commandant à aura, gardien du temple) et trois boss. IA à états : patrouille, détection par la vue et l'ouïe, alerte, combat, recherche après perte de contact, mise à couvert, contournement, navigation A*, réactions aux altérations (brûlure, ralentissement, immobilisation, étourdissement, marque). Trois difficultés qui jouent surtout sur la précision, l'agressivité et le temps de réaction.

### RPG
Niveaux 1 à 20, un point de talent par niveau, armes débloquées par niveau, butin à quatre raretés (commun, rare, épique, légendaire avec 10 effets spéciaux), cinq emplacements d'équipement, comparaison, recyclage, amélioration à l'atelier, tables de butin spécifiques aux boss.

### Technique
Three.js + TypeScript + Vite. Matériaux PBR procéduraux avec normal maps, ombres, brouillard, bloom, tone mapping ACES, particules mutualisées, géométrie de niveau fusionnée par matériau, trois préréglages graphiques, audio spatial et musique générative (Web Audio), sauvegarde IndexedDB versionnée avec copie de secours et validation.

## Organisation du code

```
src/
  core/       Game (boucle, états, transitions), Combat, Input
  render/     Renderer, Materials (textures procédurales), FX
  world/      World (collisions, rayons, navigation A*), Level (kit modulaire)
  player/     Player, WeaponSystem, WeaponModels, Abilities
  ai/         Enemy, EnemyModels, Boss, Ally
  mission/    Mission (objectifs, points de contrôle, radio)
  levels/     hub, op1..op4, survival, common
  rpg/        items (butin), Stats (talents, armes, expérience)
  data/       weapons, classes, enemies, missions (données configurables)
  save/       Save (profil, paramètres, IndexedDB)
  audio/      Audio (synthèse des sons et de la musique)
  ui/         UI, HUD, Panels, styles.css
  cinematic/  Cinematics (menu, introduction, fin)
  debug/      AutoTest (mode de test, chargé uniquement avec ?autotest)
tests/        scénarios Playwright
```

## Tests

Les scénarios pilotent un vrai navigateur (Chromium via Playwright) sur le build de production. Ils nécessitent Playwright installé globalement.

```bash
npm test                         # build + tous les scénarios
node tests/gameplay.mjs          # entrées clavier/souris réelles
node tests/systems.mjs           # classes, talents, inventaire, sauvegarde, paramètres
node tests/boss.mjs              # phases des trois boss
node tests/survival.mjs          # mode survie
node tests/campaign.mjs          # parcours des quatre opérations jusqu'aux crédits
```

Le mode de test s'active uniquement avec `?autotest` dans l'URL : il expose le jeu aux scripts et fournit un pilote qui se rend aux objectifs, inflige des dégâts par la voie normale et déclenche les interactions. Il n'existe pas dans une partie normale.

Les résultats de la dernière exécution et les limites connues sont dans [`TESTS.md`](TESTS.md).
