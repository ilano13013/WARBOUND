# WARBOUND — The Fracture Chronicles

FPS 3D / Action-RPG militaire dark fantasy, jouable dans le navigateur (PC). Campagne solo de cinq opérations (dont un épilogue), trois boss à phases, six classes, progression RPG, butin, QG interactif et mode survie.

Le jeu est un site statique : aucun service cloud, aucun backend. Les modèles, textures et sons libres (CC0) sont embarqués dans le dépôt ; le reste (décors de niveau, effets, musique, habillage) est généré par le code.

## Version 2.11.1 (correctif)

- Atelier « Créer une classe » et boutique : l'arme n'apparaissait plus dans l'aperçu 3D (taille mal mesurée sur les armes animées, réduite à un point). Corrigé pour les 12 armes ; bras de l'Ember-45 masqués et exclus du camouflage ; chargeur de rechange de l'Ember-45 masqué dans l'aperçu.

## Version 2.11 (refonte graphique de l'arsenal)

- **Les 12 armes en vue subjective** sont remplacées par des ensembles « bras + arme + animations » texturés en PBR : attente, tir, rechargement (et rechargement à vide quand la source le fournit), sortie de l'arme. Les doigts et les mains suivent les animations des auteurs ; l'ancienne pose calculée et les anciens mouvements de chargeur sont désactivés pour ces armes. Fusil à verrou : culasse manœuvrée après chaque tir ; revolver : rechargement cartouche par cartouche.
- Visée alignée sur les organes de visée de chaque arme, sons de rechargement calés sur l'animation, flash de bouche et douilles attachés à l'arme animée, recul procédural réduit (l'animation porte déjà le recul).
- Bras harmonisés entre auteurs (manches et gants de toile kaki).
- Arme des ennemis et des autres joueurs : AK-74M texturée à la place du modèle à aplats.
- Décors : caisses, barils, jerricans, bouteilles de propane, caisses militaires et radio texturés (Poly Haven) à la place des modèles à aplats, collisions inchangées.
- Chargement : seules les armes du profil sont chargées au démarrage ; les autres à la demande (l'ancien modèle s'affiche le temps du chargement).
- Crédits : `ASSET_CREDITS.md` et, dans le jeu, Mentions légales → « Crédits des modèles 3D » (licence CC BY 4.0 : attribution obligatoire).

## Version 2.10 (niveaux d'armes, grenades et atouts)

- **Niveaux d'armes** : chaque arme gagne de l'XP quand on élimine avec elle (100, +25 à la tête) et 100 XP à la fin d'une partie terminée avec elle en arme principale. De 10 à 11 niveaux par arme ; chaque niveau à partir du 2 débloque un accessoire de cette arme, dans l'ordre : viseur reflex, compensateur, chargeur étendu, poignée verticale, ACOG, silencieux, chargeur rapide, poignée d'assaut, canon lourd, lunette x8 (selon compatibilité). XP par arme enregistrée sur le compte ; progression affichée dans l'atelier et sur l'écran de fin.
- **Niveau joueur** : il débloque désormais les armes, l'équipement létal (Grenade Frag niveau 3, Semtex niveau 8) et les atouts.
- **Équipement létal** gérés par l'hôte : la Frag rebondit et explose après 2,2 s (rayon 6 m) ; la Semtex colle à la première surface ou au premier joueur touché et explose après 1,6 s. Dégâts dégressifs, arrêtés par les murs, pas de tir allié, moitié des dégâts sur soi. Une grenade par vie. Touche G (ou bouton GREN. au doigt). Les bots en lancent aussi.
- **Atouts** (3 emplacements) : Vigueur (niv. 1, régénération après 2,5 s au lieu de 5) / Gilet renforcé (niv. 5, explosifs −50 %) ; Rechargement rapide (niv. 2, −30 %) / Munitions supplémentaires (niv. 7, +2 chargeurs, +1 grenade) ; Pillard (niv. 4, un chargeur récupéré par élimination) / Fantôme (niv. 10, tirs absents de la mini-carte adverse). Effets appliqués par l'hôte. Aucun atout ni grenade en 1v1.
- **Régénération de la santé en multijoueur** (gérée par l'hôte ; elle manquait).

## Version 2.9 (classes et progression multijoueur)

- **Progression multijoueur** séparée du solo, enregistrée sur le compte en ligne : 30 niveaux. XP : élimination 100 (+25 à la tête), assistance 50, capture de zone 150, partie terminée 200, victoire 300, égalité 100. Écran de fin avec le détail des gains, la montée de niveau et les nouveaux déblocages.
- **Déblocages** : armes (AR-17, Vesper-9 et Sidearm P9 au niveau 1 ; Requiem DMR 3, Spectre-PDW 5, Revolver Ash 7, Vektor-556 9, Titan-46 11, Ember-45 13, Frostbite .50 16, Aegis-762 19, Bastion-LMG 22) et accessoires (viseur reflex 2, compensateur 4, chargeur étendu 6, poignée verticale 8, ACOG 10, silencieux 12, chargeur rapide 14, poignée d'assaut 17, canon lourd 20, lunette x8 24). Les modifications arcaniques ne sont pas proposées en multijoueur.
- **Créer une classe** (Multijoueur en ligne → Créer une classe) : 5 classes personnalisées (nom, arme principale, accessoires par emplacement, arme secondaire) avec aperçu des statistiques, en plus de 4 classes prédéfinies (Assaut, Rapproché, Précision, Soutien). Les classes suivent le compte d'un appareil à l'autre.
- **En partie** : choix de la classe dans le salon ; changement en cours de partie par le menu pause (« Changer de classe »), appliqué à la réapparition suivante. Arme principale et secondaire (touches 1 et 2, molette ou bouton ARME au doigt). Le 1v1 aux fusils de précision garde son échelle d'armes.

## Version 2.8 (matchmaking public et bots)

- **Partie rapide** (Multijoueur en ligne → Partie rapide) pour chaque mode : le serveur envoie le joueur dans la partie publique ouverte la plus remplie, ou en crée une. Pas de statut « prêt » : la partie démarre seule après 20 s (15 s en 1v1), ou 3 s après qu'elle est pleine. Après la partie, elle repart automatiquement avec les joueurs restants et les nouveaux venus. Un code et un lien permettent aussi d'y inviter des amis.
- **Bots** : les places libres sont prises par des bots simulés par l'hôte (réaction 0,55 à 0,95 s, rotation modérée, erreur de visée d'environ 2,2°, tir en rafales courtes, tête rarement visée, vue limitée à 60 m — niveau baissé après les premiers essais ; déplacements latéraux en combat, chasse des ennemis, prise des zones A, B et C, montée à l'étage par l'escalier). Ils suivent exactement les mêmes règles que les joueurs : mêmes armes, mêmes dégâts, tirs résolus par l'autorité de la partie. Ils sont marqués [BOT].
- Les parties privées entre amis fonctionnent comme avant (pas de bots).

## Version 2.7 (téléphones et tablettes)

- **Jouable au doigt dans le navigateur** : détection automatique d'un écran tactile. Joystick dynamique à gauche (pousser à fond vers l'avant pour sprinter), visée en glissant le doigt à droite (aussi en gardant le doigt sur TIR ou VISÉE), boutons TIR, VISÉE, SAUT, ACCROUPI, RECHARGER, ACTION, ARME, et en solo GRENADE, compétences 1 à 3 et ULTIME ; pause, carte et scores en haut de l'écran. Les boutons de compétence montrent l'icône de la compétence (comme sur ordinateur), avec son temps de recharge par-dessus, et sont grisés quand l'énergie manque ; ULTIME affiche sa charge, GRENADE le nombre restant.
- **Aide à la visée** sur écran tactile, **en solo uniquement** (jamais en ligne) : attire doucement le réticule vers l'ennemi le plus proche du centre quand on vise ou tire. Désactivable dans Paramètres, avec la sensibilité tactile.
- **Réglages adaptés** au premier lancement sur téléphone (qualité basse, résolution 80 %, résolution dynamique), menus compacts en paysage, HUD réduit, invitation à tourner l'écran en mode portrait.
- **Installation sur l'écran d'accueil** (manifeste d'application web) : plein écran, orientation paysage. Sur Android, le plein écran est aussi demandé au premier contact ; sur iPhone, il passe par « Sur l'écran d'accueil » dans Safari.
- Testé en émulation tactile (Chromium, 844×390) ; **non testé sur un vrai téléphone** : performances et confort à vérifier.

## Version 2.6 (multijoueur en ligne, boutique cosmétique)

- **Multijoueur en ligne** (menu principal → *Multijoueur en ligne*) : salons privés créés par un serveur (code de 6 caractères ou lien d'invitation `?salon=CODE`), liste des joueurs, équipes Rouge et Bleu équilibrées automatiquement ou à la main par l'hôte, statut prêt, lancement par l'hôte, retour au salon et « rejouer », reconnexion après coupure, salons inactifs fermés automatiquement.
- **Trois modes** : *Défi d'armes 1v1* (fusils de précision), *Match à mort par équipe 4v4* (75 éliminations ou 10 minutes, réapparition en 3 s, tir allié désactivé) et *Domination 4v4* (zones A, B, C ; capture par présence, accélérée jusqu'à ×2 à trois coéquipiers, bloquée si les deux équipes sont présentes ; 1 point toutes les 5 s par zone ; 200 points ou 12 minutes ; réapparition en 5 s).
- **Autorité de l'hôte** : les joueurs se connectent directement à l'hôte (WebRTC en étoile). L'hôte valide déplacements, cadence de tir, munitions et rechargements, recalcule chaque tir sur les positions passées (compensation de latence bornée à 250 ms) et les dégâts à partir de l'arme, décide des éliminations, des scores, des captures et du chronomètre. Limite : un hôte modifié peut tricher (salons privés entre amis). Détails dans `docs/AUDIT-MULTIJOUEUR-F2P.md`.
- **HUD de partie** : scores des équipes, chronomètre, zones, fil des éliminations, tableau des scores (touche Personnage maintenue : éliminations, morts, assistances, ping), noms des alliés, alliés et zones sur la mini-carte, écrans de victoire, défaite et égalité. Armes au choix identiques pour tous (statistiques de base, sans talent ni bonus) ; compétences et grenades désactivées.
- **Boutique 100 % cosmétique** (menu principal → *Boutique*) : 3 camouflages d'armes (Cendre et Glacier à 1,99 €, Fracture à 4,99 €) et le Pack Fondateur (9,99 € : tenue, camouflage, emblème, badge permanent, carte de visite). Aperçu 3D, inventaire, équipement, historique des achats, compte sans mot de passe avec code de récupération. Prix et possession décidés par le serveur ; paiement Stripe Checkout, attribution par webhook signé, retrait en cas de remboursement ou de contestation. **Les paiements ne sont pas activés** : sans serveur configuré, la boutique fonctionne en démonstration (aperçu et essai local).
- **Serveur** (`server/`) : Cloudflare Worker + Durable Objects + D1, prévu pour l'offre gratuite, avec garde-fou de quotas. **Non déployé** : voir `docs/DEPLOIEMENT.md`. Documents légaux en brouillon dans `docs/legal/` (à faire valider).
- Le duel par échange de codes (sans serveur) reste disponible.

## Version 2.5 (opération 5 et tireurs d'élite)

- **Opération 5 — LIGNE DE CRÊTE** : épilogue débloqué après POINT ZÉRO. Le colonel Halvard tient le barrage hydroélectrique de Valmorre, dans un massif alpin, de nuit sous la pluie. Vallée d'approche battue par des tireurs d'élite, centrale (trois turbines, passerelles, vannes à fermer, purge à défendre), monte-charge jusqu'à la crête, relais à couper sur la tour de contrôle, extraction par hélicoptère. Neuf objectifs, trois documents à découvrir, niveau conseillé 14.
- **Nouvel ennemi : le tireur d'élite HELIX** : il tient un poste en hauteur, balaie la zone, trahit sa position par un reflet de lunette avant de tirer (46 dégâts, jusqu'à 140 m), puis **change de poste** après avoir tiré, si on l'approche à moins de 13 m ou s'il perd une partie de sa santé. Pendant le déplacement (2,5 à 7 s) il est hors d'atteinte.
- **Défi d'armes (1 contre 1)**, depuis le menu principal : duel en ligne aux **fusils de précision uniquement**, en course aux armes sur 6 étapes. Chaque élimination fait passer à l'étape suivante : Requiem DMR, Frostbite .50, Requiem DMR silencieux, Frostbite .50 canon lourd, Requiem DMR lunette x8, Frostbite .50 silencieux à lunette x8. Le premier qui élimine son adversaire avec la dernière gagne. Les tirs silencieux n'apparaissent pas sur la mini-carte adverse. Conditions égales : 100 PV, aucun talent, équipement, compétence ni grenade. Arène dédiée « trois voies, un étage » (chantier du barrage de Valmorre, de jour) : voies A et C au sol autour du bloc central, voie B en hauteur par les conteneurs et la plate-forme centrale, symétrique pour les deux camps ; adversaire en tenue sable et rouge, lisible de loin ; réapparition après 3 s au point le plus éloigné de l'adversaire, 1,5 s d'invulnérabilité. Voir « Défi d'armes : connexion » plus bas.
- **Mini-carte** (radar en haut à droite, orientée selon le regard) : obstacles, objectif et, en rouge, les ennemis qui viennent de tirer (le point s'efface après 3 s). Les boss apparaissent en orange.
- Table tactique : la liste défile jusqu'à l'opération choisie ; le temps record ne s'affiche plus en « NaN » quand il manque.

## Version 2.4 (équipement électrique, préparation des nouveaux assets)

- **Coffrets électriques** (*Power Box 01*, Poly Haven, CC0) sur les machines du QG, de CENDRES et de POINT ZÉRO et sur une partie des armoires murales, avec leur câble d'alimentation.
- **Câblage** (*Modular Electric Cables*, Poly Haven, CC0) : boîtiers de raccordement aux chemins de câbles, interrupteurs de service.
- **Préparation** : les armes importées avec des matériaux PBR texturés les conservent (pour l'AK-47 de Nneako) ; les animations se transfèrent aussi sur les squelettes Unreal 5 (personnage Quantum, exports AccuRig pour Unreal), avec correction de la pose de repos.
- **Non intégrés** (voir `ASSETS.md`) : AK-47, soldat tactique et modules de laboratoire (non fournis, téléchargement soumis à un compte) ; personnage Quantum (fourni sans ses textures).

## Version 2.3.1 (correctifs)

- CENDRES : l'entrée du laboratoire était murée derrière la porte. Le laboratoire, le réacteur et le boss sont de nouveau accessibles à pied.
- POINT ZÉRO : même défaut derrière la grande porte de l'installation. Corrigé.
- Les barrières en béton ne flottent plus (elles étaient à 44 cm du sol depuis la 2.2).
- Deux caisses de munitions enfoncées dans un socle de la salle du réacteur sont replacées.
- Le contrôle automatique des niveaux vérifie désormais qu'on peut tout atteindre à pied.

## Nouveautés de la version 2.3 (performances et sensibilité)

**Moins de ralentissements**
- **Résolution dynamique** (activée par défaut) : sous 50 images/s, la résolution interne baisse par paliers, jusqu'à 55 % ; elle remonte quand le jeu tient 60 images/s. Désactivable dans *Paramètres → Graphismes*. La résolution réelle s'affiche avec les FPS.
- **Densité de pixels plafonnée** : 1 en Faible et Moyen, 1,5 en Élevé. Sur un écran à 150 %, le jeu ne calcule plus 2,25 fois plus de pixels que nécessaire.
- **Personnages** : les pièces d'un même tissu sont fusionnées, l'arme des ennemis est figée en un seul maillage, les personnages hors champ ne sont plus dessinés ni projetés en ombre, et l'animation est allégée au-delà de 25 m. Soit 46 appels de dessin au lieu de 178 au départ de CENDRES, et 22 au lieu de 124 pour les ombres.
- **Lumières** : un nombre fixe de lumières réelles (2, 4 ou 8 selon la qualité) est attribué aux lampes les plus proches. Les lumières d'éclair passent de 4 à 2. Changer de classe dans le menu ne recompile plus tous les shaders.
- **Ombres** : recalculées une image sur deux en Moyen, en version simple ; les petits décors, les débris et l'horizon n'en projettent plus.
- **Post-traitement Moyen** : anticrénelage FXAA au lieu du multi-échantillonnage, occlusion et rayons du soleil allégés.
- **Saccades supprimées** : les shaders des effets (explosions, impacts, traçantes) sont compilés au chargement et non plus à leur première apparition. L'autodiagnostic graphique ne relit plus l'image qu'une fois par scène : en 2.2.3, il provoquait une saccade toutes les 12 secondes.
- Au total : de 43 à 68 % d'appels de dessin en moins par image selon l'endroit (mesures dans `TESTS.md`).

**Sensibilité** (*Paramètres → Contrôles*)
- Sensibilité générale de 0,05 à 5, au centième près.
- Sensibilité verticale (rapport vertical / horizontal).
- Sensibilité en visée et sensibilité dans la lunette, séparées.
- Inversion de l'axe vertical.
- Entrée brute : le mouvement de la souris sans l'accélération de Windows (actif par défaut si le navigateur le permet).
- Bouton de retour aux valeurs par défaut.

## Nouveautés de la version 2.2 (modèles et matériaux Poly Haven / ambientCG)

Sept assets CC0 téléchargés à la source et intégrés ; gameplay, collisions, objectifs, statistiques et sauvegardes inchangés. Les anciens décors restent en repli si un fichier manque.

- **Tuyauterie** (*Modular Industrial Pipes 01*) : remplace les tuyaux cylindriques de diamètre moyen et gros dans toutes les cartes (CENDRES et POINT ZÉRO en premier lieu). Les conduits destructibles des objectifs ne sont pas touchés.
- **Ventilation** (*Modular Airduct Rectangular 01*) : gaines et grilles au plafond du laboratoire de CENDRES et du hangar de Fort Aegis, bouches d'aération murales.
- **Groupe électrogène** (*Portable Generator*) : à côté du terminal de remise sous tension de CENDRES, à sa taille réelle.
- **Barrières** (*Concrete Road Barrier*) : habillage de toutes les barrières en béton ; la collision conserve les dimensions de couverture d'origine.
- **Falaises** (*Rock Face 01*) : autour du TEMPLE DU VOILE et de la zone altérée de POINT ZÉRO ; remplace `WallRocks`.
- **Maçonnerie ancienne** (*Rabdentse Ruins Wall*) : murs d'enceinte et de salles du temple ; colonnes, pilastres et sculptures gardent leur pierre.
- **Béton endommagé** (*Concrete 042 D*) : enceinte et mur du portail de CENDRES, station et soubassements des immeubles de VILLE MORTE, bunkers de POINT ZÉRO. Le laboratoire garde ses surfaces propres.

Non intégrés (téléchargement soumis à un compte) : l'AK-47 de Nneako et le personnage *Quantum Modular Character*. Voir `ASSETS.md` et `tools/assets/incoming/LISEZMOI.txt`.

## Nouveautés de la version 2.1 (refonte visuelle : ambiance, matériaux, densité)

Gameplay, missions, cartes, classes, boss et sauvegardes inchangés. Aucun asset ajouté : tout vient du rendu et de l'habillage.

- **Lumière et atmosphère** : ciel à nuages éclairés par le soleil, capturé en carte d'environnement pour que les reflets suivent l'ambiance de chaque carte ; occlusion ambiante, rayons du soleil et brume au sol calculés depuis la profondeur de la scène ; cônes de lumière et flaques lumineuses sous les lampes ; étalonnage final (contraste, teinte des ombres et des hautes lumières, vignettage, grain, netteté). Éclairage neutre en intérieur, ambiance du ciel en extérieur.
- **Matériaux** : variation à grande échelle qui casse la répétition des textures, salissures en pied de mur, coulures, **sol mouillé avec flaques réfléchissantes** (pluie sur Varsen, cendres humides sur le Site Cendres). Façades d'immeubles redessinées (encadrements, appuis, vitrages).
- **Densité** : habillage automatique de chaque mur (plinthes, pilastres, tuyauteries, chemins de câbles, armoires électriques, grilles, appliques, signalétique HELIX peinte), plafonds techniques (poutres, gaines, luminaires), taches et fissures au sol, débris. Immeubles avec soubassement, devantures, corniches, balcons, équipements de toit. Conteneurs et véhicules détaillés.
- **Composition et verticalité** : horizon propre à chaque carte (site industriel et reliefs, ville en ruine, flèches rocheuses et monolithes, éclats d'obsidienne), miradors, mâts d'éclairage, passerelles de tuyauteries, cuves, lignes électriques, gabions, barbelés, statues colossales, obélisques, bannières, braseros, incendies et colonnes de fumée, fissures et excroissances de la Fracture, roches en lévitation.
- **Météo** : cendres (Cendres), pluie (Ville Morte), poussières arcaniques (Temple, simulation), braises (Point Zéro).
- **Arme en vue subjective** : finition procédurale (usure brillante en traînées, grain, variation de teinte), éclairée par le soleil de la scène depuis sa vraie direction, contre-jour, reflets du ciel ; grain de tissu et de cuir sur les manches et les gants.
- **Correctifs** : cinq ennemis apparaissaient dans un obstacle (caisse, escalier, baril) ; un contrôle automatique (`tests/layout.mjs`) vérifie désormais chaque point d'apparition.

Le préréglage **Bas** désactive le post-traitement (occlusion, rayons, brume, étalonnage) pour les machines modestes ; **Moyen** et **Élevé** l'activent.

## Nouveautés de la version 2.0 (refonte visuelle)

Le gameplay, les six classes, les quatre opérations, les boss, l'inventaire et les sauvegardes de la 1.0 sont conservés. La 2.0 remplace la présentation :

- **Armes** : 12 modèles glTF riggés (*Flat Guns* et revolver Quaternius, CC0) avec accessoires montés sur leurs points d'attache, **bras et mains gantés** posés par cinématique inverse, rechargements animés (chargeur retiré puis inséré par la main gauche, armement de la culasse), culasse et glissière qui reculent à chaque tir, douilles éjectées.
- **Personnages** : ennemis, compagnons, PNJ et boss sont des modèles animés (Quaternius, CC0). Les animations de la *Universal Animation Library* sont **retargetées à l'exécution** sur les personnages humanoïdes : locomotion, visée et tir superposés au haut du corps, sorts, réactions aux impacts, morts.
- **Boss** : le Gardien d'Helix est un mech animé, l'Archonte et le Souverain sont des personnages animés qui conservent leurs halos, cristaux et ailes ; attaques annoncées par des zones animées et des colonnes d'énergie.
- **Environnements** : 16 matériaux PBR photographiques (ambientCG, CC0) et environ 110 décors glTF instanciés (laboratoire, rue, temple, installation).
- **Effets** : boules de feu en shader, éclats, brûlures au sol, éclairs en rubans ramifiés, trous de balle, flash de bouche en étoile, projectiles lumineux.
- **Son** : détonations enregistrées sur de vraies armes et bruits de pas (CC0), superposés à la synthèse existante.
- **Interface** : direction artistique militaire dark fantasy (polices Cinzel et Rajdhani embarquées), icônes vectorielles des compétences, recharges en balayage circulaire, boussole avec marqueur d'objectif.

Sources, licences et pipeline de régénération des assets : [`ASSETS.md`](ASSETS.md).

## Déployer sur Netlify

- Glisser-déposer le dossier `dist/` sur https://app.netlify.com/drop, ou
- relier le dépôt à Netlify : `netlify.toml` fournit la commande de build (`npm run build`) et le dossier publié (`dist`).

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

## Défi d'armes : connexion

Le duel ne passe par aucun serveur de jeu : les deux navigateurs se connectent directement (WebRTC), ce qui permet de garder un site statique sur Netlify.

1. **L'hôte** clique sur *Créer une invitation*, copie le code (`WB1.o.…`) et l'envoie à son adversaire (messagerie, e-mail…).
2. **L'invité** colle ce code dans *Rejoindre une partie*, clique sur *Générer ma réponse* et renvoie le code obtenu (`WB1.a.…`).
3. **L'hôte** colle la réponse et clique sur *Connecter*. La partie démarre chez les deux joueurs.

Limites :
- Un serveur STUN public (Google) sert seulement à découvrir l'adresse de chaque joueur ; aucune donnée de jeu n'y transite. Sans serveur relais (TURN), certains réseaux empêchent la connexion directe : réseaux d'entreprise ou d'école, partage de connexion mobile, pare-feu stricts. Sur la plupart des box domestiques, ça fonctionne.
- Un code n'est valable que pour une tentative ; en cas d'échec, recommencez depuis *Créer une invitation*.
- Les deux joueurs doivent avoir la même version du jeu (contrôlée à la connexion).
- Chaque joueur détecte ses propres touches et la victime les applique : le jeu fait confiance aux deux navigateurs (pas d'anti-triche), ce qui convient à un duel entre amis.
- La pause n'arrête pas le duel : l'adversaire continue de jouer.

## Contenu jouable

### Structure
- Menu principal avec décor 3D animé, création du personnage, introduction en cinématique moteur.
- **Fort Aegis** (QG en vue FPS) : table tactique, armurerie, terminal de personnage, atelier arcanique, terminal de survie, zone d'entraînement (cibles, simulation de combat), caisses de munitions.
- **Campagne** : quatre opérations liées par une histoire, chacune avec briefing, objectifs, radio, documents à découvrir, points de contrôle, écran de résultats.
  1. **CENDRES** — complexe HELIX, laboratoire, défense du terminal, conduits, boss *Gardien d'Helix*.
  2. **VILLE MORTE** — rues de Varsen, défense de la station de métro, destruction du portail, extraction.
  3. **TEMPLE DU VOILE** — ruines, énigme des trois sceaux, gardiens, cristaux, boss *Archonte du Voile*.
  4. **POINT ZÉRO** — défenses HELIX, trois stabilisateurs, zone altérée, contre-attaque, boss final *Souverain Fracturé*, cinématique de fin et crédits.
  5. **LIGNE DE CRÊTE** (épilogue) — barrage de Valmorre, tireurs d'élite mobiles, vannes de la centrale, purge, crête, relais de la Fracture, extraction.
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
  render/     Renderer, PostFX (ciel, atmosphère, étalonnage), Weather, Materials, FX
  world/      World (collisions, rayons, navigation A*), Level (kit modulaire), Detail (habillage automatique), SetPieces (éléments de décor)
  player/     Player, WeaponSystem, WeaponModels, Abilities
  ai/         Enemy, EnemyModels, EnemyRigs, Boss, Ally, Marksman (tireur mobile), Rival (adversaire du duel)
  mission/    Mission (objectifs, points de contrôle, radio)
  levels/     hub, op1..op5, survival, duel (arène 1v1), common, dress (décors glTF), art (passe level art)
  net/        Peer (WebRTC), Duel (duel par codes), LobbyClient (salons), Match (parties en ligne, autorité de l'hôte), wire (format binaire), Ticker (boucle réseau en arrière-plan), Account (compte, boutique)
server/       Cloudflare Worker : salons (Durable Objects), garde-fou de quotas, comptes et achats (D1), Stripe
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
node tests/campaign.mjs          # parcours des cinq opérations (crédits après la 4)
node tests/classes.mjs           # classes et progression multijoueur (serveur local requis)
node tests/quickplay.mjs         # matchmaking public et bots (serveur local requis)
node tests/mobile.mjs            # téléphone : commandes tactiles, aide à la visée, menus (émulation)
node tests/duel.mjs              # Défi d'armes : deux navigateurs, connexion par codes, partie complète
node tests/layout.mjs            # points d'apparition et accessibilité après habillage
```

Le mode de test s'active uniquement avec `?autotest` dans l'URL : il expose le jeu aux scripts et fournit un pilote qui se rend aux objectifs, inflige des dégâts par la voie normale et déclenche les interactions. Il n'existe pas dans une partie normale.

Les résultats de la dernière exécution et les limites connues sont dans [`TESTS.md`](TESTS.md).
