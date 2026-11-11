# WARBOUND — Résultats des tests et limites connues

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
