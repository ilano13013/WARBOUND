# WARBOUND — Résultats des tests et limites connues

## Version 2.5 (opération 5, tireur d'élite, Défi d'armes, mini-carte)

Exécution complète `npm test` (machine non chargée) : gameplay 27/27, settings sans échec, boss, survie 6/6, niveaux cohérents (op1 à op5 et QG), campagne des cinq opérations jusqu'aux crédits sans erreur JavaScript. Le contrôle `systems` a échoué une fois sur « opération 2 verrouillée » parce qu'il attendait 3 opérations verrouillées au lieu de 4 ; il compte maintenant à partir du nombre d'opérations, puis 26/26. Nouveau test `duel` : 19/19.

### Opération 5
- `layout` : chaque objectif, interaction et ennemi au sol de LIGNE DE CRÊTE est atteignable à pied depuis le départ, y compris de l'autre côté du monte-charge.
- `campaign` : les 9 objectifs enchaînés jusqu'à « MISSION ACCOMPLIE », sans mort, 35 éliminations.
- Tireur d'élite HELIX : il repère le joueur, tire, change de poste (environ 5,5 s caché) et ne prend aucun dégât pendant son déplacement.
- Table tactique (capture en 960×540) : la carte de l'opération 5 reste visible après sélection ; le temps record manquant n'affiche plus « NaN:NaN ».

### Défi d'armes (`tests/duel.mjs`)
Deux navigateurs (contextes séparés) sur la même machine, sans réseau extérieur : codes produits (environ 550 caractères chacun), code invalide refusé avec un message clair, invitation collée à la place de la réponse refusée, connexion établie, noms échangés, même première arme, position de l'adversaire synchronisée (écart inférieur à 0,6 m). Partie complète sur une échelle raccourcie à 3 armes : chaque élimination confirmée fait passer l'hôte à l'arme suivante, l'invité voit cette progression, réapparition après 3 s, victoire chez l'hôte et défaite chez l'invité, bilan 3 éliminations / 3 morts, retour au QG avec les armes du profil.

**Non vérifié** : connexion entre deux machines réelles sur Internet (l'environnement de test n'a pas accès aux serveurs STUN). Elle repose sur le même mécanisme, mais les réseaux d'entreprise, les partages de connexion mobile et les pare-feu stricts peuvent la bloquer (pas de serveur relais).

Arène refaite en « trois voies, un étage » : le test vérifie aussi qu'on monte à pied de la base à l'étage central (escalier, toit du conteneur, plate-forme). Vérifié à part : on grimpe sur l'étage depuis les voies A et C par les caisses (franchissement). Test du duel : 20/20.

### Mini-carte
Capture en 1280×720 sur VILLE MORTE avec des ennemis en alerte : obstacles, objectif (losange) et points rouges des ennemis qui viennent de tirer. Dans le duel, l'adversaire n'y apparaît que lorsqu'il tire, et la grande carte (M) ne révèle plus sa position.

### Problèmes trouvés pendant ce travail
- Le premier test du duel ne touchait jamais : la position de test de l'hôte était à l'intérieur du pilier central de l'arène. Les positions ont été déplacées dans l'allée dégagée.
- L'objectif du duel était ajouté après le démarrage de la mission et ne s'affichait pas ; il est maintenant défini avant.
- À la mort, le pointeur était libéré, ce qui obligeait à recliquer après chaque réapparition automatique ; il reste capturé en duel.
- En duel, la carte tactique révélait l'adversaire, considéré comme « en combat » ; corrigé.

## Version 2.4 (équipement électrique, préparation AK et soldat)

Exécution complète `npm test` sur une machine non chargée : 7 scénarios réussis (gameplay 27/27, systems 26/26, settings 10/10, boss 3/3, survival 6/6, layout cohérent, campagne jusqu'aux crédits sans erreur JavaScript).

### Vérifications visuelles réellement faites (captures)
- Coffret électrique de près (CENDRES) : porte fermée, pictogramme, usure ; coffrets sur les machines du générateur et de l'atrium.
- **Profil de squelette Unreal** sur le personnage Quantum fourni (copie de test allégée à 32 700 triangles, **sans textures**), de face, à côté du soldat actuel : repos, visée (arme levée à la même hauteur), marche. Pas de déformation visible. Mort, rechargement, coups et course non regardés.

### Problèmes trouvés pendant ce travail
- **Coût du câblage** : la première version posait 2 400 pièces de câble détaillées sur CENDRES (+1,8 million de triangles). Les longues descentes sont devenues des tubes simples, le coffret a été allégé et posé sur une armoire sur deux : surcoût ramené à environ 290 000 triangles instanciés (objets muraux, sans ombre).
- **Saccade à la première apparition des nouveaux objets** : leurs textures 2K étaient envoyées à la carte graphique au premier affichage. Elles le sont désormais au chargement, comme les shaders.
- **Tests** : la référence du test des talents était relevée avant l'application des PV de classe (corrigé) ; le test du saut attend que le personnage soit au sol. Une exécution lancée en même temps qu'une autre suite a échoué par surcharge de la machine : non retenue.

### Non vérifié
- AK-47, soldat tactique, modules de laboratoire : non fournis.
- Quantum en jeu : non intégré faute de textures ; aucune mesure de performance à 163 000 triangles par personnage.
- Rendu des matériaux PBR conservés pour une arme texturée : aucune arme texturée disponible pour l'essayer.

---

## Version 2.3.1 (accès bloqués et objets en lévitation)

### Défauts signalés et confirmés
- **CENDRES, entrée du laboratoire murée** (présent depuis la 1.0) : derrière la porte (z −40), les enceintes de la cour et du laboratoire avaient chacune un côté plein à z −41. Tout le laboratoire, le réacteur et le boss étaient inaccessibles à pied. Confirmé en marchant : le joueur butait à z −40,1 ; corrigé, il entre dans le hall.
- **POINT ZÉRO, complexe des stabilisateurs muré** (présent depuis la 1.0) : même défaut, côté sud de l'enceinte du complexe plein derrière la grande porte. Stabilisateurs, zone altérée, parvis et noyau étaient inaccessibles à pied.
- **Barrières en béton à 44 cm du sol** (79 barrières, 5 cartes, introduit en 2.2) : l'origine du modèle, à sa base, était prise pour son centre.
- **Deux caisses de munitions du réacteur de CENDRES enfoncées dans un socle de décor** (introduit en 2.0).

### Pourquoi les tests ne les voyaient pas
Le pilote de la campagne se téléporte d'objectif en objectif, et l'ancien contrôle `layout` vérifiait seulement que chaque point était sur la grille de navigation, sans exiger un chemin. Le contrôle vérifie maintenant un **cheminement à pied** : un remplissage au gabarit du joueur (rayon 0,36 m, grille de 25 cm, marches de moins de 0,42 m franchies), toutes portes ouvertes, du départ jusqu'à chaque marqueur d'objectif, chaque interaction et chaque ennemi au sol, sur les quatre opérations et le QG. Un contrôle ponctuel mesure l'écart entre la base de chaque objet posé et ce qui le porte : plus aucun objet ne flotte sur les six cartes.

### Limite de navigation des ennemis (constat, non modifié)
La grille de navigation des ennemis (cases de 1 m, marge de 0,32 m) ferme les portes de 3 m. Les ennemis ne savent donc pas poursuivre le joueur à travers ces portes. Le joueur, lui, passe. À traiter séparément : changer la grille modifie le comportement de tous les ennemis.

---

## Version 2.3 (performances et sensibilité)

| Scénario | Résultat |
| --- | --- |
| `gameplay` | 27 / 27 |
| `systems` | 29 / 29 |
| `settings` (nouveau : sensibilité générale, verticale, en visée, inversion, résolution dynamique, persistance, panneau) | 10 / 10 |
| `boss` | 3 / 3 |
| `survival` | 6 / 6 |
| `layout` | 21 / 21 |
| `campaign` | 4 / 4, aucune erreur JavaScript |

### Mesures (rendu logiciel, qualité Moyen, 640×360)
Les temps d'image du rendu logiciel ne reflètent pas une vraie carte graphique : le processeur y empile les images en retard. On mesure donc les **appels de dessin** (coût processeur, souvent le facteur limitant sur un portable) et les triangles. Valeur par image, avec la passe d'ombre une image sur deux :

| Vue | 2.2.3 | 2.3 |
| --- | --- | --- |
| CENDRES, départ | 772 | 437 |
| CENDRES, cour | 754 | 375 |
| CENDRES, laboratoire | 616 | 202 |
| VILLE MORTE, départ | 966 | 499 |
| POINT ZÉRO, départ | 928 | 510 |
| POINT ZÉRO, zone altérée | 801 | 254 |

Détail au départ de CENDRES : personnages animés 178 → 46 appels (ombres 124 → 22).

### Défauts trouvés et corrigés pendant ce travail
- **Saccade périodique** : l'autodiagnostic de la 2.2.3 relisait l'image toutes les 12 s, ce qui bloque la carte graphique. Il ne le fait plus qu'une fois par scène.
- **Recompilation des shaders sur l'écran de création** : chaque clic sur une classe ajoutait ou retirait une lumière.
- **Résolution dynamique inactive sur les machines les plus lentes** (trouvé par le nouveau test) : les images de plus de 120 ms étaient ignorées.
- **Première version du test `settings` invalide** : arguments inversés, tout passait. Corrigé avant toute conclusion.

### Fusion des pièces des personnages
Les modèles sont compressés (quantification glTF) : chaque pièce garde ses positions en entiers normalisés, et sa déquantification est intégrée à ses propres matrices d'os. La fusion convertit les attributs en flottants et transfère exactement chaque pièce dans le repère d'une pièce de référence, en vérifiant la cohérence sur tous les os communs. Si la vérification échoue, le groupe n'est pas fusionné. Un premier essai qui ignorait ce point déformait les personnages ; il a été vu sur capture et corrigé avant tout envoi. Rendu vérifié sur quatre types d'ennemis.

### Non vérifié en 2.3
- **Gain réel en images/s sur votre machine** : aucune carte graphique ici. Les gains sur la carte graphique (pixels, lumières, anticrénelage) ne sont pas chiffrés.
- **Entrée brute** : l'option demande au navigateur le mouvement sans accélération ; si le navigateur la refuse, le verrouillage classique est utilisé. Non testable sans souris réelle.
- **Lisibilité de l'image à résolution dynamique basse** (55 %) : plus floue, non jugée en jeu réel.

---

## Version 2.2 (assets Poly Haven et ambientCG)

Exécution complète `npm test` sur le build de production, Chromium piloté par Playwright, rendu logiciel. Les six scénarios ont passé dans la même exécution.

| Scénario | Résultat |
| --- | --- |
| `gameplay` | 27 / 27 |
| `systems` | 29 / 29 |
| `boss` | 3 / 3 |
| `survival` | 6 / 6 |
| `layout` (points d'apparition, interactions accessibles dont le terminal du générateur) | 21 / 21 |
| `campaign` (4 opérations jusqu'aux crédits) | 4 / 4, aucune erreur JavaScript |

### Ce qui a été vérifié sur captures
Groupe électrogène près du terminal de CENDRES, tuyaux et bouches d'aération sur les murs, gaine au plafond du laboratoire et du hangar, barrières en béton, béton endommagé du portail, falaises au-dessus de l'enceinte du temple.

### Problèmes rencontrés pendant l'intégration
- **Vitre du groupe électrogène** : son matériau « à transmission » faisait redessiner toute la scène deux fois (877 appels de rendu au lieu de 454 sur CENDRES). Remplacé par une transparence simple.
- **Pièces modulaires trop lourdes** : un module de gaine pèse 3 100 triangles et une barrière 61 000 à l'origine. Répétés des centaines de fois, ils dépassaient 1,4 million de triangles. Simplifiés (gaine 530, tuyau 370, barrière 1 200, falaise 4 400 triangles) ; le relief vient des cartes de normales 2K. Les tuyaux de moins de 9 cm de rayon restent des cylindres.
- **Tests** : trois vérifications étaient fausses ou trop sensibles et ont été corrigées, sans défaut du jeu. Le saut était mesuré après sa fin ; le bouclier du Souverain (3 s) était échantillonné trop rarement ; le menu de l'atelier dépassait son délai en 1280×720. Le mode test rend désormais à demi-résolution en qualité « Bas » pour garder des images assez rapides ; la logique de jeu est identique.

### Mesures indicatives (rendu logiciel, qualité Bas)
CENDRES : 459 appels de rendu, 598 000 triangles (302 000 en 2.1). QG : 209 appels, 132 000 triangles (89 000 en 2.1). Poids du build : 37 Mo (23 Mo en 2.1), surtout les textures 2K.

### Défaut signalé sur une vraie carte graphique : aplats noirs (2.2.3, non revérifié sur la machine concernée)
Sur le PC de test (Edge, Windows), de grands rectangles noirs couvraient le menu, la création de personnage, la cinématique et les cartes. Deux correctifs successifs (2.2.1, 2.2.2) n'ont pas suffi.

**Mécanisme, reproduit ici par injection** (`?fx=simnan`) : une seule valeur invalide (NaN) écrite dans l'image est étalée par le bloom ; sans garde-fou, l'écran entier devient noir. Le rendu logiciel des tests ne produit pas spontanément ces valeurs : la sonde `WB.hdrScan()`, y compris avec anticrénelage, n'en trouve aucune sur le menu ni sur les vues testées.

**Source la plus probable, corrigée en 2.2.3** : le shader des cônes de lumière sous les lampes (ajouté en 2.1) calculait une puissance d'une coordonnée interpolée. Avec l'anticrénelage, cette coordonnée peut devenir négative au bord du cône ; la puissance d'un nombre négatif est invalide sur une vraie carte graphique. Une lampe et son cône se trouvent devant le portail du menu, là où les zones noires des photos sont centrées, et sous chaque lampe de chaque carte. Ce n'est pas prouvé sur la machine concernée.

**Autres corrections du même type** : `atan(0, 0)` (portails, ciel, effets), `smoothstep` à bornes inversées (huit shaders), puissances à base possiblement négative (trois shaders), division par zéro du ciel, texture de profondeur partagée par erreur entre les deux tampons du post-traitement, commentaires non ASCII retirés des shaders.

**Défenses ajoutées** :
- garde-fou avant le bloom et dans la passe d'atmosphère, fondé sur un test binaire que les compilateurs de shaders ne peuvent pas supprimer (contrairement à `isnan`) ;
- **autodiagnostic embarqué** : 1,2 s après chaque changement de scène puis toutes les 12 s, le jeu sonde l'image brute sur la carte graphique du joueur. S'il trouve des valeurs invalides, il coupe une à une les catégories d'objets (halos et cônes, effets à shader, particules, reflets) jusqu'à retrouver une image saine. Le verdict est affiché en bas à gauche : `GFX 2.2.3 · OK · n` ou `GFX 2.2.3 · invalides N · coupe : …`. Vérifié ici par injection : la valeur injectée est détectée et sa catégorie coupée.

Diagnostic manuel par l'adresse : `?fx=off` (aucun post-traitement) ou une liste parmi `noatmo`, `nobloom`, `nograde`, `nomsaa`, `noenv`, `nosurf`, `noweather`, `nofx`, `nocheck`.

### Non vérifié en 2.2
- Fréquence d'images et mémoire vidéo sur une vraie carte graphique : les textures 2K ajoutent environ 20 textures de 2048 px.
- Rendu des nouveaux matériaux en jeu réel : jugé sur des captures 960×540 en rendu logiciel. La gaine de plafond et le béton endommagé du portail paraissent sombres sur ces captures.
- L'AK-47 et le personnage Quantum ne sont pas intégrés (fichiers non accessibles sans compte) : rien n'a été testé pour eux.

### Limites
- Les modules de gaine sont étirés ×2 en longueur pour diviser le nombre d'instances par deux.
- Tous les tuyaux utilisent la même texture ; les variantes de couleur (rouille, jaune) de la 2.1 ont disparu pour les gros diamètres.
- Les falaises sont hors de la zone jouable, sauf quatre affleurements avec collision au pied des murs.

---

## Version 2.1 (refonte visuelle : ambiance, matériaux, densité)

Exécution sur le build de production, Chromium piloté par Playwright, rendu logiciel (SwiftShader, pas de GPU dans l'environnement de développement).

| Scénario | Résultat |
| --- | --- |
| `gameplay` (entrées clavier/souris réelles) | 27 / 27 |
| `systems` (6 classes, 24 capacités, talents, inventaire, atelier, sauvegarde, mort/reprise, paramètres) | 29 / 29 |
| `boss` (Gardien, Archonte, Souverain : 3 phases, bouclier, renforts, victoire) | 3 / 3 |
| `survival` | 6 / 6 |
| `layout` (nouveau : points d'apparition et accessibilité des 4 opérations, absence d'erreur) | 21 / 21 |
| `campaign` (4 opérations jusqu'aux crédits et au menu) | 4 / 4, aucune erreur JavaScript |

`boss`, `survival`, `layout` et `campaign` ont passé dans l'exécution complète `npm test`. `gameplay` et `systems` ont passé relancés seuls, après correction de leurs délais (voir ci-dessous).

### Fragilité des tests en rendu logiciel (à connaître)
La 2.1 affiche beaucoup plus de géométrie. Sans carte graphique, une image prend 0,35 s au QG et 0,8 s dans l'opération 1 en qualité « Bas » (0,16 s et 0,3 s en 2.0). Plusieurs vérifications attendaient un délai fixe plus court qu'une image et ont échoué sans défaut du jeu : saut, ruée, accroupissement, « marque » du Wraith, capture d'écran. Elles ont été rendues indépendantes de la cadence (mesure image par image, appuis plus longs, départ dégagé). Malgré cela, une exécution lancée juste après un redémarrage de la machine a encore échoué sur deux vérifications de délai (« pas de côté », une vérification de `systems`), puis tout a passé à la relance. Ces scénarios restent donc sensibles à la charge de la machine de test ; le nombre de vérifications de `systems` affiché a aussi varié entre 26 et 29 selon les exécutions, sans échec.

### Défauts trouvés et corrigés
Le nouveau contrôle `layout` a révélé cinq ennemis qui apparaissaient dans un obstacle (caisse, escalier, baril, cristal). Ces défauts existaient déjà en 2.0 (vérifié en lançant le même contrôle sur l'ancien build) ; les points d'apparition ont été déplacés. La passe de décor n'a introduit aucun conflit.

### Mesures indicatives (rendu logiciel, 640×360)
| | 2.0 | 2.1 |
| --- | --- | --- |
| QG, qualité Bas | 170 appels, 68 000 triangles | 202 appels, 89 000 triangles |
| Opération 1, qualité Bas | 406 appels, 186 000 triangles | 445 appels, 302 000 triangles |
| Opération 2, qualité Élevée | non mesuré | 1 012 appels, 854 000 triangles |

### Non vérifié en 2.1
- **Fréquence d'images sur une vraie carte graphique** : toujours impossible ici. La 2.1 coûte plus cher que la 2.0 (géométrie, post-traitement plein écran, transparences). Si le jeu rame : qualité « Moyen », puis « Bas » (qui coupe post-traitement, shader de surface, halos, cônes de lumière, taches et débris).
- **Rendu réel de l'étalonnage** : exposition, contraste et saturation ont été réglés sur des captures 960×540 en rendu logiciel, pas sur un écran en jeu. Certaines zones peuvent paraître trop sombres ou trop denses en brume.
- **Lisibilité des ennemis** dans la pluie, la brume et les intérieurs plus contrastés : non éprouvée en jeu réel.
- Les points déjà listés pour la 2.0 (sons non écoutés, autres navigateurs, lanceurs Windows jamais exécutés sous Windows).

### Limites de la refonte 2.1
- L'image de référence est un rendu AAA (éclairage global, reflets en espace écran, modèles scannés). La 2.1 s'en rapproche par l'atmosphère, la densité et les matériaux, mais n'atteint pas ce niveau : personnages et décors glTF restent *low poly*, les reflets du sol mouillé montrent le ciel et non les objets, les halos lumineux sont simulés et non calculés.
- L'habillage des murs est automatique : il peut placer une armoire ou une plaque derrière un meuble existant.
- Les poteaux intermédiaires des passerelles de tuyauteries n'ont pas de collision (choix pour ne pas gêner la navigation des ennemis).

---

## Version 2.0 (refonte visuelle)

Dernière exécution complète : `npm test` sur le build de production, Chromium piloté par Playwright, rendu logiciel (SwiftShader, pas de GPU dans l'environnement de développement).

| Scénario | Résultat |
| --- | --- |
| `gameplay` (entrées clavier/souris réelles) | 27 / 27 |
| `systems` (6 classes, 24 capacités, talents, inventaire, armurerie, atelier, sauvegarde, mort/reprise, paramètres) | 29 / 29 |
| `boss` (Gardien, Archonte, Souverain : 3 phases, bouclier, attaques annoncées, renforts, victoire) | 3 / 3 |
| `survival` | 6 / 6 |
| `campaign` (4 opérations jusqu'aux crédits et au menu) | 4 / 4, aucune erreur JavaScript |

Deux assertions du scénario `gameplay` ont été ajustées pendant la refonte, sans rapport avec un défaut du jeu :
- « collision mur » : un conteneur ajouté au QG arrête désormais le joueur avant le mur ; le test vérifie qu'il ne traverse ni l'un ni l'autre ;
- « pas de côté » : la durée d'appui est allongée, car en rendu logiciel une image du QG prend maintenant plus de 0,8 s et un appui plus court tombait entre deux images.

Vérifications visuelles (captures inspectées à chaque étape) : armes et bras en visée hanche, visée et rechargement, roster des 8 ennemis, 3 boss, 4 niveaux, menus, HUD, talents, explosion, chaîne d'éclairs, annonces d'attaque des boss.

Mesure indicative (rendu logiciel, qualité faible) : Opération 1 ≈ 410 appels de rendu et 190 000 triangles ; QG ≈ 190 appels.

### Non vérifié en 2.0
- **Fréquence d'images sur une vraie carte graphique** : impossible ici. Les nouveaux modèles animés, décors et ombres coûtent plus cher que la 1.0 ; si le jeu rame, baisser la qualité dans les paramètres.
- **Écoute des sons enregistrés** : les fichiers se chargent et se décodent sans erreur, mais le mixage n'a pas été écouté.
- **Navigateurs autres que Chromium** ; décodage Ogg Vorbis sur Safari (repli automatique sur les sons synthétisés si le décodage échoue).
- **Lisibilité en jeu réel** : les choix de distance de l'arme, d'épaisseur des bras et de taille des décors ont été réglés sur des captures fixes, pas manette en main.

### Limites de la refonte visuelle
- Les modèles Quaternius sont stylisés *low poly* ; le rendu est nettement plus riche que la 1.0 mais reste en dessous d'une production AAA photoréaliste.
- Les bras sont ceux du personnage Swat (proportions stylisées), allongés et posés par IK ; les mains tiennent l'arme mais les doigts gardent une pose de prise fixe.
- Les animations de rechargement sont procédurales (os du chargeur et de la culasse animés en code), pas des animations capturées.
- Le Gardien du temple (modèle de chevalier très simple) reste le personnage le moins détaillé.
- Le revolver n'a pas de pièces mobiles (pas de barillet animé).

---

## Version 1.0

Dernière exécution : `npm test` sur le build de production, Chromium piloté par Playwright, rendu logiciel (SwiftShader, pas de GPU dans l'environnement de développement).

## Ce qui a été vérifié automatiquement

| Scénario | Résultat | Contenu |
| --- | --- | --- |
| `gameplay` | 27 / 27 | Entrées clavier/souris réelles : déplacements ZQSD, collision avec un mur, sprint (8,2 m/s mesurés), glissade, saut, accroupissement, tir automatique et coup par coup, consommation de munitions, impacts hitscan sur cible, recul réel sur la visée, ADS, rechargement, changement d'arme, 3 compétences + ultime du Vanguard (coût, cooldown, effet), régénération d'énergie, grenade, panneaux Tab / M / Échap, IA qui réagit au bruit des tirs, engage et blesse le joueur |
| `systems` | 26 / 26 | Les 24 capacités des 6 classes s'activent avec leur effet ; montée de niveau ; talent appris (+15 PV) et prérequis ; butin légendaire de boss ; équiper / déséquiper / recycler ; accessoires qui modifient recul et chargeur ; changement d'arme à l'armurerie ; amélioration à l'atelier ; verrouillage des opérations ; difficulté ; sauvegarde restaurée après rechargement de page ; mort puis reprise au point de contrôle ; abandon ; disposition QWERTY ; paramètres persistants ; sauvegarde corrompue gérée sans plantage |
| `boss` | 3 / 3 | Pour chaque boss : il blesse un joueur passif, les 3 phases sont atteintes, le bouclier s'active et tombe quand les conduits/cristaux sont détruits, des attaques annoncées sont actives, les renforts apparaissent, la victoire fait avancer l'objectif |
| `survival` | 6 / 6 | Vagues 1 à 5, mélange d'ennemis, mini-boss de la vague 5, amélioration appliquée, sortie volontaire avec score et record, mort en survie |
| `campaign` | 4 / 4 | Les 4 opérations enchaînées jusqu'à l'écran de résultats, cinématique de fin, crédits, retour au menu, sans erreur JavaScript |

Vérifié aussi : compilation TypeScript stricte sans erreur, build de production (≈ 860 Ko, 250 Ko gzip), inspection de captures d'écran du menu, du QG, des panneaux et des quatre niveaux.

## Ce qui n'a PAS été vérifié

- **Aucune partie jouée par un humain.** Le parcours de campagne est fait par un pilote de test qui se téléporte aux objectifs, est invulnérable et inflige des dégâts directement. Il prouve que chaque objectif est atteignable et que les enchaînements fonctionnent ; il ne prouve ni l'équilibrage, ni le plaisir de jeu, ni que chaque couloir est agréable à parcourir à pied.
- **Durée des missions** (12 à 25 min visées) : non mesurée en conditions réelles.
- **Équilibrage** des classes, des armes, des boss et des trois difficultés : réglé sur le papier, jamais éprouvé manette en main. La campagne n'a été parcourue automatiquement qu'avec le Vanguard ; aucun objectif ne dépend d'une classe.
- **Performances réelles** : l'environnement n'a pas de GPU (1 à 12 images/s en rendu logiciel). L'objectif de 60 FPS sur PC milieu de gamme n'a pas pu être mesuré. Le QG fait environ 160 appels de rendu en qualité faible et 290 en qualité moyenne.
- **Audio** : le code s'exécute sans erreur, mais aucun son n'a été écouté.
- **Verrouillage de la souris et plein écran** : testés seulement via le mode de test, qui les contourne.
- Navigateurs autres que Chromium.

## Limites et écarts par rapport au cahier des charges

- Sons et musiques sont synthétisés en direct par Web Audio, pas enregistrés dans des fichiers. Pas de voix : dialogues sous-titrés avec signal radio.
- Modèles 3D construits par assemblage de primitives : silhouettes lisibles et distinctes, mais pas de maillages sculptés ni d'animation squelettique. Le rendu est « stylisé semi-réaliste », en dessous d'un rendu AAA.
- Physique maison (boîtes alignées sur les axes) au lieu de Rapier : pas de pentes ni d'objets tournés à angle libre ; les hauteurs passent par des escaliers et des plateformes.
- La navigation ennemie est une grille au niveau du sol : les ennemis ne montent pas sur les plateformes (ceux qui s'y trouvent y sont postés).
- En disposition QWERTY, Ctrl+W ferme l'onglet hors plein écran (limite du navigateur).
- Le test `systems` saute trois vérifications d'armure si le tirage de butin n'en contient pas.
