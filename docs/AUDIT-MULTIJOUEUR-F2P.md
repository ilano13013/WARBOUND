# WARBOUND — Audit multijoueur, architecture et plan Free-to-Play

État du dépôt : branche `claude/warbound-fps-game-mhwfzi`, version de jeu 2.5.0, 13 novembre 2026.
Ce document est une **analyse et une proposition**. Aucune modification majeure n'est engagée avant validation.
Les quotas et tarifs cités ont été relevés sur les pages officielles le 13/11/2026 (sources en fin de document) ; ils changent régulièrement et doivent être revérifiés avant chaque décision.

---

## 1. Audit technique du projet

### 1.1 Socle

| Élément | Constat |
|---|---|
| Langage, outils | TypeScript strict, Vite 5, Three.js 0.170, Web Audio, IndexedDB. Environ 15 000 lignes de TypeScript. |
| Hébergement | Site statique (`dist/`, 41 Mo, 259 fichiers) sur Netlify. Aucun backend, aucune base de données, aucune API à soi. |
| Services externes | Uniquement les serveurs STUN publics de Google, pour le duel. Aucun compte, aucun suivi, aucun paiement. |
| Assets | 39 Mo dans `public/assets` (229 fichiers : modèles GLB, textures, sons). Tous les assets intégrés sont CC0 ; polices sous licence SIL OFL ; Three.js et Vite sous MIT. Les assets CC BY et Fab sont seulement « en attente », non intégrés (voir `ASSETS.md`). |
| Tests | 8 scénarios Playwright automatisés (`npm test`), dont un duel complet entre deux navigateurs **sur la même machine**. |

### 1.2 Contenu réutilisable

| Domaine | Réutilisable pour le multijoueur | Remarques |
|---|---|---|
| Contrôleur FPS (`player/Player.ts`) | Oui, tel quel : course, sprint, glissade, saut, franchissement. | Physique déterministe simple : prédiction locale facile. |
| Armes (`player/WeaponSystem.ts`, `data/weapons.ts`) | Oui. 12 armes, 13 accessoires, recul et dispersion. Le mode « armes imposées » (`override`) donne déjà des statistiques neutres, sans talent ni bonus de classe. | La cadence, le chargeur et le rechargement sont calculés côté client : à revalider côté autorité. |
| Zones de touche (`ai/Enemy.ts`, `ai/Rival.ts`) | Oui. L'adversaire réseau est déjà un « ennemi » piloté par le réseau : tête (sphère) et corps (cylindre), hauteur accroupie. | Aucune compensation de latence. |
| Personnages animés (`render/CharacterRig.ts`) | Oui. Squelettes Quaternius, retargeting, couleurs par matériau (`MatTweak`). C'est exactement ce qu'il faut pour des tenues cosmétiques et pour colorer les équipes. | L'arme tenue par l'adversaire est générique ; pas d'animation distante de rechargement. |
| Interface (`ui/*`) | Oui : HUD, mini-carte, bannières, notifications, écran de résultats, menus. | À ajouter : score d'équipe, chronomètre de match, tableau des scores, fil des éliminations. |
| Cartes (`levels/*`, `world/Level.ts`) | Le kit de construction (boîtes, conteneurs, escaliers, plates-formes, éclairage, habillage automatique) est réutilisable. | Les cartes de campagne sont linéaires, pas adaptées au 4v4. L'arène du duel (60 × 34 m) est trop petite pour 8 joueurs : il faut 1 à 2 cartes dédiées. |
| Sauvegarde (`save/Save.ts`) | Le profil local (niveau, talents, butin) reste valable pour le solo. | Stockage local modifiable par le joueur : **inutilisable** comme preuve de possession d'un achat, et à ne pas utiliser pour les statistiques en ligne. |
| Modes solo | Campagne de 5 opérations, survie, QG, entraînement. | Totalement indépendants du réseau : ils restent disponibles si le multijoueur est saturé. |
| Tests (`tests/`) | Le harnais à deux navigateurs est extensible à 8 contextes (avec une machine assez puissante). | Ne remplace pas un test entre appareils et réseaux réels. |

### 1.3 Analyse du duel 1v1 existant (`src/net/Peer.ts`, `src/net/Duel.ts`, `src/ai/Rival.ts`)

**Technologie.** Connexion WebRTC directe entre deux navigateurs, deux canaux de données : un fiable et ordonné (événements), un non fiable sans retransmission (positions). Aucun serveur de jeu ; STUN Google pour découvrir les adresses ; **aucun serveur relais (TURN)**.

**Invitation et salon.** Échange manuel de deux codes (environ 550 caractères chacun : description de session compressée). Pas de salon au sens propre : un hôte, un invité. La collecte des adresses attend jusqu'à 4 s. Contrôle de version à la connexion.

**Synchronisation.**

| Élément | Fonctionnement actuel |
|---|---|
| Déplacements | État complet envoyé 20 fois par seconde en JSON (environ 118 octets) : position, orientation, vitesse, hauteur, visée, santé, invulnérabilité, étape d'arme. Lissage exponentiel côté réception (≈ 70 ms de retard ajouté), pas de tampon d'interpolation. |
| Animations | Déduites de la vitesse et de la visée reçues (marche, course, visée). Accroupi simulé par écrasement de la silhouette. Pas de rechargement ni de changement d'arme visibles. |
| Tirs | Chaque tir envoie le point d'impact (≈ 69 octets) : l'adversaire voit le traceur et entend le son. Les tirs silencieux ne s'affichent pas sur sa mini-carte. |
| Dégâts | Le tireur détecte la touche sur sa propre image de l'adversaire et envoie la valeur des dégâts ; la victime les applique (plafond 400). |
| Éliminations, victoire | La victime annonce sa mort ; le gagnant annonce lui-même la fin de partie. |
| Déconnexion | Après 10 s sans message, la partie s'arrête et le joueur restant gagne. Pas de reconnexion. |

**Ce qui a été vérifié et ce qui ne l'a pas été.** Le test automatique joue une partie complète entre deux onglets de la même machine (20/20). **Aucun test entre deux appareils ni entre deux réseaux n'a été fait** : le fonctionnement via Internet n'est pas démontré.

**Problèmes identifiés.**

1. **Onglet en arrière-plan** : la boucle de jeu repose sur `requestAnimationFrame`, que le navigateur suspend dans un onglet masqué. Un joueur qui change d'onglet plus de 10 s (par exemple pour copier un code ou répondre à un message) **n'envoie plus rien et perd la partie**. Pour un hôte de 4v4, l'arrière-plan figerait toute la partie.
2. **Pas de serveur relais** : selon les réseaux (entreprise, 4G, NAT symétrique), une partie des connexions directes échouera.
3. **Confiance totale** : un joueur modifié peut envoyer des dégâts arbitraires, ignorer les touches reçues, se téléporter, tirer sans limite de cadence ou envoyer « fin de partie » pour gagner. Acceptable entre amis, pas pour du compétitif.
4. **Pas de compensation de latence** : la touche est jugée sur l'image du tireur, qui a du retard ; la victime peut être touchée « derrière un mur ». À conserver comme principe (« le tireur a raison ») mais avec une vérification bornée.
5. **Ergonomie** : copier-coller de longs codes dans les deux sens. Impraticable à 8 joueurs.

**Supporte-t-il huit joueurs ?** **Non.** L'architecture est strictement à deux pairs : une seule connexion, un seul adversaire, des messages sans identifiant de joueur. Un maillage complet à 8 demanderait 28 connexions et 56 échanges de codes. Il faut un serveur de signalisation (salon) et une topologie en étoile ou un serveur de jeu.

**Consommation réseau mesurée (format actuel).**

| Cas | Débit |
|---|---|
| Duel, par joueur | ≈ 2,4 Ko/s émis (20 × 118 o) + tirs. Négligeable. |
| 4v4 en étoile, format JSON actuel | Hôte : reçoit 7 × 2,4 Ko/s, émet un état des 8 joueurs à 7 clients : ≈ 130 Ko/s (≈ 1 Mbit/s) en émission. Trop pour une connexion domestique modeste. |
| 4v4 en étoile, format binaire quantifié (≈ 20 o par joueur) | Hôte : ≈ 25 Ko/s émis. Correct. |

Conclusion : le format binaire est nécessaire avant le 4v4, quelle que soit l'architecture.

### 1.4 Ce qui doit changer pour le 4v4

1. Un **salon en ligne** (création, code et lien d'invitation, liste des joueurs, équipes, prêt, lancement) avec signalisation automatique : plus de copier-coller.
2. Une **autorité unique** par partie (hôte ou serveur) qui décide des dégâts, éliminations, scores, captures, chronomètre et fin de partie.
3. Un **protocole binaire** avec identifiants de joueurs, numéros de séquence et horodatage, et un tampon d'interpolation (≈ 100 ms).
4. Une **boucle réseau indépendante de l'affichage** (Web Worker ou minuterie protégée), pour survivre à un onglet en arrière-plan.
5. Des **cartes 4v4** dédiées (≈ 80 × 60 m, trois voies, points d'apparition par équipe, zones A/B/C pour Domination).
6. **Identification des équipes** (silhouette et marqueur au-dessus des alliés, couleur imposée sur les tenues), tableau des scores, fil des éliminations.

---

## 2. Architectures réseau comparées

| Critère | A. WebRTC pair à pair, hôte joueur | B. Cloudflare Workers + Durable Objects (serveur autoritaire) | C. Hybride recommandé |
|---|---|---|---|
| Principe | Un joueur héberge la partie dans son navigateur ; les autres s'y connectent en étoile. | Chaque partie est un Durable Object qui reçoit les commandes de 8 WebSockets et simule l'état faisant foi. | Salon et signalisation sur un Durable Object ; partie jouée en WebRTC en étoile chez l'hôte, avec un module d'autorité partagé, déplaçable plus tard dans un Durable Object. |
| Coût | 0 € (hors relais TURN). | Gratuit mais très limité (voir §3) ; au-delà, offre payante Workers (≈ 5 $/mois, carte bancaire requise). | 0 € tant que les quotas du salon suffisent (large marge). |
| Latence | Hôte au milieu : bonne si l'hôte a une bonne connexion. L'hôte a 0 ms de latence (avantage). | Serveur Cloudflare proche de l'hôte du salon ; latence homogène. | Comme A pendant la partie. |
| Anti-triche | Faible : l'hôte peut tricher ; les autres sont contrôlés par l'hôte. | Fort : le serveur valide tout. | Moyen : les clients sont contrôlés par l'hôte ; l'hôte reste de confiance. Suffisant pour des salons privés entre amis, **pas** pour un classement public. |
| Fiabilité | L'hôte qui part ou passe en arrière-plan coupe la partie (migration d'hôte possible mais complexe). Pas de relais : certaines connexions échouent. | Indépendante des joueurs. | Comme A ; relais TURN optionnel. |
| Charge de développement | Moyenne. | Élevée (simulation de collisions côté serveur, code partagé). | Moyenne ; l'autorité est écrite une seule fois en TypeScript partagé. |
| Évolutivité | Gratuite à toute échelle. | Coût proportionnel au temps de jeu. | Permet de passer au mode B partie par partie (classé, public) quand le budget existe. |

**Recommandation : architecture C (hybride), en deux temps.**

1. **Maintenant, à 0 €** : salon et signalisation sur Cloudflare (Worker + Durable Object en hibernation), partie en WebRTC en étoile chez l'hôte. L'hôte exécute le **module d'autorité** : il valide cadences, munitions, distances parcourues, dégâts (recalculés à partir de l'identifiant d'arme, jamais repris tels quels du client), éliminations, scores, captures et chronomètre. Les clients prédisent leurs propres déplacements et sont corrigés par l'hôte.
2. **Plus tard, sur décision et budget explicites** : exécuter ce même module dans un Durable Object pour les parties publiques ou classées.

À dire clairement : en mode C, « validé par l'autorité réseau » signifie « validé par le navigateur de l'hôte ». Un hôte qui triche reste possible. C'est acceptable pour des salons privés ; le jour d'un matchmaking public, il faudra le mode B.

### 2.1 Exigences techniques et réponse prévue

| Exigence | Réponse |
|---|---|
| Prédiction locale | Le client applique ses commandes immédiatement (contrôleur existant), numérote chaque commande. |
| Réconciliation | L'hôte renvoie la dernière commande traitée et la position validée ; le client rejoue les commandes non confirmées (seulement si l'écart dépasse un seuil, pour éviter les à-coups). |
| Interpolation | Tampon de ≈ 100 ms sur les autres joueurs (remplace le lissage actuel), avec extrapolation courte en cas de perte. |
| Tirs | Le client envoie « tir » (arme, origine, direction, horodatage) ; l'hôte vérifie la cadence et les munitions, rejoue la touche sur les positions passées (rembobinage borné à 200 ms) et décide. |
| Rechargements | Durée connue par l'arme ; l'hôte refuse un tir pendant un rechargement. |
| Déplacements impossibles | Vitesse maximale et hauteur de saut bornées par tick ; une position hors limites est ramenée à la dernière position valide. |
| Latence | Mesure du ping par l'hôte (affichée au tableau des scores) ; compensation plafonnée. |
| Déconnexion | Joueur gardé 30 s dans la partie ; jeton de reconnexion délivré par le salon. Si l'hôte part : fin de partie propre (migration d'hôte en phase ultérieure). |
| Économie de messages | Format binaire, envoi des seuls joueurs proches ou visibles en priorité, regroupement des événements par tick, fréquences configurables (simulation 30 Hz, envoi 20 Hz au départ, à ajuster sur mesures). |
| Scène Three.js | Jamais synchronisée : seuls les états de joueurs, tirs et événements de partie circulent. |
| Onglet masqué | Boucle réseau et simulation de l'hôte dans un Web Worker, découplées de l'affichage. |

Aucune promesse de qualité compétitive ne peut être faite avant des mesures de latence et de perte de paquets réelles (phase 8).

---

## 3. Hébergement gratuit : quotas et capacité estimée

### 3.1 Quotas officiels relevés le 13/11/2026

| Service | Offre gratuite | Au-delà |
|---|---|---|
| Cloudflare Workers | 100 000 requêtes par jour, 10 ms de CPU par requête. Remise à zéro à minuit UTC. | Dépassement : les requêtes échouent (erreur 1027). Pas de facturation possible sans passer à l'offre payante. |
| Durable Objects (offre gratuite) | 100 000 requêtes par jour, 13 000 Go·s de durée par jour. Chaque connexion WebSocket coûte une requête ; les messages **entrants** comptent pour 1/20 de requête ; les messages **sortants** sont gratuits. La durée ne court pas pendant l'hibernation. | Offre payante : 0,15 $ par million de requêtes, 12,50 $ par million de Go·s au-delà de 400 000 Go·s inclus par mois. |
| D1 (base SQL) | 5 millions de lignes lues et 100 000 écrites par jour, 5 Go au total, 500 Mo par base. | Selon le journal des modifications D1, à partir du 1er septembre 2026 les requêtes échouent en cas de dépassement sur l'offre gratuite. |
| Cloudflare Pages | 500 constructions par mois, 20 000 fichiers par site, 25 Mio par fichier. | Le jeu tient largement (259 fichiers, le plus gros fait 2,9 Mo). La bande passante gratuite n'a pas été confirmée par la recherche : **à vérifier sur la page officielle**. |
| Cloudflare TURN (relais) | 1 000 Go par mois gratuits, partagés avec le SFU ; STUN gratuit et illimité. | 0,05 $ par Go. **Non vérifié** : si l'activation exige un moyen de paiement. |
| Netlify (actuel) | 300 crédits par mois ; un déploiement en production coûte 15 crédits, la bande passante consomme aussi des crédits. | Quand les crédits sont épuisés, **les sites sont mis en pause** jusqu'au mois suivant ; pas d'achat de crédits sur l'offre gratuite. |

Point important pour vous : sur Netlify gratuit, **environ 20 déploiements par mois suffisent à épuiser les crédits** et à mettre le site en pause, avant même de compter les visiteurs. Ce rythme est atteignable avec nos mises à jour fréquentes. C'est un argument fort pour Cloudflare Pages, où les constructions sont décomptées séparément (500 par mois).

Garantie de coût : un compte Cloudflare sur l'offre gratuite, **sans moyen de paiement enregistré**, ne peut pas être facturé ; au pire, les services refusent les requêtes jusqu'au lendemain. C'est le comportement voulu. Le jeu solo, servi en fichiers statiques, n'est pas concerné par ces quotas.

### 3.2 Capacité estimée (calculs, pas des mesures)

Hypothèses : partie de 10 minutes ; Durable Object de 128 Mo, soit 0,125 Go facturé.

| Scénario | Requêtes Durable Object par partie | Parties par jour (offre gratuite) | Facteur limitant |
|---|---|---|---|
| Hybride C : salon et signalisation seulement (8 connexions, ≈ 200 messages entrants, appels d'API) | ≈ 30 Durable Object + ≈ 20 Worker | **≈ 2 000 à 3 000 parties 4v4 par jour** | Requêtes Worker et Durable Object ; durée quasi nulle grâce à l'hibernation. |
| B : 4v4 autoritaire serveur, commandes envoyées à 15 Hz | 8 × 15 × 600 / 20 ≈ 3 600 + 8 connexions | **≈ 25 parties 4v4 par jour** (≈ 200 joueurs-parties) | Requêtes (100 000/jour). Durée : 600 s × 0,125 = 75 Go·s par partie, soit ≈ 170 parties possibles. |
| B : 1v1 autoritaire serveur, 20 Hz | 2 × 20 × 600 / 20 = 1 200 | **≈ 80 duels par jour** | Requêtes. |
| B sur l'offre payante (≈ 5 $/mois, sur autorisation) | ≈ 3 600 requêtes + 75 Go·s | Coût marginal ≈ 0,0015 $ par partie 4v4 au-delà de l'inclus | Budget. |

Conclusion : le **serveur autoritaire gratuit ne tient qu'une vingtaine de parties 4v4 par jour**. L'hybride permet d'accueillir une vraie petite communauté à 0 €, avec la limite anti-triche décrite plus haut.

### 3.3 Protections de quotas prévues

- Compteur journalier dans un Durable Object « garde-fou » : au-delà de 80 % du quota estimé, création de salons refusée avec un message clair (« serveurs pleins, réessayez demain ; le solo reste disponible »).
- Salons fermés après 15 minutes d'inactivité (alarme Durable Object), hibernation des WebSockets.
- Plafond de salons simultanés, limite de création de salons par adresse IP.
- Aucun appel serveur pour le solo.
- Tableau de bord : lecture des métriques via l'API GraphQL d'analyse de Cloudflare (gratuite), ou simplement le tableau de bord Cloudflare au début.

---

## 4. Plan des modes 4v4

### 4.1 Commun aux deux modes

- Salon : choix du mode (1v1 aux fusils de précision, Match à mort par équipe 4v4, Domination 4v4), de la carte, capacité adaptée (2 ou 8), liste des joueurs avec badge et ping, équilibrage automatique (alternance et transfert manuel par l'hôte), statut prêt, lancement par l'hôte, retour au salon et « rejouer ».
- Lien d'invitation `https://…/?salon=CODE` et code court (6 caractères), expiration automatique des salons inactifs.
- Chargements identiques pour tous : armes de base sans talent ni bonus, comme le duel actuel. Compétences de classe **désactivées** au départ (équilibrage à faire avant de les activer).
- Équipes Rouge et Bleu : couleur imposée sur un élément de la tenue (indépendante des cosmétiques), contour et nom au-dessus des alliés, alliés en vert sur la mini-carte.
- Tir allié désactivé (contrôlé par l'autorité).
- Points d'apparition par équipe, choisis loin des ennemis vivants, 1,5 s d'invulnérabilité annulée au premier tir.
- HUD : scores des deux équipes, chronomètre, fil des éliminations ; tableau des scores (touche Tab) : éliminations, morts, assistances, ping.
- Écrans de victoire et défaite.
- Préparation d'un futur matchmaking public : le salon est déjà un objet adressable par code ; il suffira d'ajouter une file d'attente qui remplit des salons publics.

### 4.2 Match à mort par équipe

75 éliminations ou 10 minutes ; à égalité de temps, victoire au plus grand nombre d'éliminations (égalité possible, affichée comme telle) ; réapparition après 3 s. L'élimination n'est comptée que par l'autorité.

### 4.3 Domination

Zones A, B, C (cercles de 5 m, au sol). Capture en 10 s par un joueur, accélérée jusqu'à × 2 à partir de 3 coéquipiers, bloquée si les deux équipes sont présentes. Chaque zone tenue rapporte 1 point toutes les 5 s. 200 points ou 12 minutes ; réapparition après 5 s. Interface : indicateurs A, B, C dans le HUD et dans le monde, barre de progression, couleur du propriétaire, notifications de prise et de perte. Calcul uniquement chez l'autorité.

### 4.4 Cartes

Une première carte 4v4 en trois voies (≈ 80 × 60 m), dans le style de l'arène actuelle, avec trois emplacements de zones pour la Domination. La réutiliser pour les deux modes au départ ; une seconde carte ensuite.

---

## 5. Boutique, inventaire et comptes

### 5.1 Principes

- **100 % cosmétique** : un cosmétique ne change que des couleurs, textures ou images. Il n'a jamais accès aux statistiques. Règle technique : les cosmétiques sont appliqués après le calcul des statistiques et dans un module séparé, sans lien avec `weaponStats`.
- **Lisibilité** : les tenues gardent une luminosité minimale et la couleur d'équipe imposée ; aucun camouflage sombre ou de type « ghillie ».
- Le catalogue (noms, visuels) est dans le jeu ; **les prix et la possession sont décidés par le serveur**. Le stockage local n'est qu'un cache d'affichage.

### 5.2 MVP

| Produit | Contenu | Mise en œuvre dans l'existant |
|---|---|---|
| 3 skins d'armes (1,99 € ou 4,99 €) | Camouflages appliqués aux armes en vue subjective et sur l'arme tenue par le personnage | Remplacement de couleurs ou de textures sur les matériaux des armes (`GunAssets`, `WeaponModels`). |
| Pack Fondateur (9,99 €) | Tenue d'opérateur exclusive, camouflage d'arme exclusif, emblème, badge permanent, carte de visite | Tenue : couleurs par matériau sur le squelette existant (`MatTweak`). Emblème, carte de visite : images 2D. Badge : affiché au profil et dans les salons. |

Pas de mention de disponibilité limitée : le pack reste disponible tant qu'aucune raison réelle ne justifie le contraire.

### 5.3 Interface

Page Boutique depuis le menu et le QG : catégories, prix TTC, page de détail avec aperçu 3D (réutilise la scène d'aperçu de la sélection de classe), bouton d'achat, confirmation, inventaire, équipement, historique des achats.

### 5.4 Comptes et données (Cloudflare Worker + D1)

- **Compte sans friction** : à la première visite en ligne, un compte anonyme est créé ; un secret aléatoire est stocké dans un cookie `HttpOnly; Secure; SameSite=Lax` et sa version hachée en base. Jouer ne demande rien d'autre.
- **Récupération** : rattachement facultatif à une adresse e-mail (renseignée lors de l'achat Stripe) et/ou à une connexion Google ou Discord (OAuth, gratuit). Code de récupération affiché une fois. L'envoi d'e-mails de connexion n'est pas prévu au départ (service externe, coûts).
- **Tables D1** : `players`, `sessions`, `catalog`, `entitlements` (objet possédé, origine, révoqué ou non), `purchases` (identifiant de session Stripe unique), `stripe_events` (identifiant d'événement unique, contre les doubles traitements), `equipped`.
- **Synchronisation entre joueurs** : à l'entrée dans un salon, le serveur fournit pour chaque joueur la liste de ses cosmétiques équipés et **vérifiés** ; les clients n'affichent que ceux-là.

### 5.5 Paiements Stripe (mode test d'abord)

1. Le jeu appelle `POST /api/checkout` avec seulement l'identifiant du produit.
2. Le Worker vérifie le compte, lit le prix dans son propre catalogue (prix Stripe préenregistrés) et crée une session Stripe Checkout avec l'identifiant du joueur en métadonnées.
3. Le joueur paie sur la page de Stripe : WARBOUND ne voit jamais les numéros de carte.
4. Le webhook `checkout.session.completed` arrive au Worker ; la signature est vérifiée (Web Crypto). L'objet est attribué une seule fois (contrainte d'unicité sur la session et l'événement).
5. `charge.refunded` et `charge.dispute.created` : l'objet est marqué révoqué et l'historique le montre.
6. Mode test Stripe jusqu'à votre autorisation explicite ; clés secrètes uniquement dans les secrets du Worker, jamais dans le dépôt.

Frais (offre standard France, à confirmer dans votre tableau de bord Stripe : la page tarifaire indique 1,5 % + 0,25 € et la page d'aide française 1,4 % + 0,25 € pour les cartes européennes) : ≈ 0,28 € sur un skin à 1,99 € (≈ 14 %), ≈ 0,40 € sur le Pack Fondateur (≈ 4 %). Les petits prix sont proportionnellement chers ; une monnaie virtuelle n'est **pas** recommandée au départ (obligations supplémentaires).

### 5.6 Conformité (France et Union européenne) — à valider par un professionnel

- **Statut du vendeur** : vendre de façon régulière demande un statut (par exemple micro-entreprise) et un numéro SIRET ; Stripe vérifie l'identité du titulaire du compte.
- **TVA** : les règles applicables (franchise en base, seuils, guichet unique OSS pour les consommateurs d'autres pays de l'UE) dépendent de votre statut et de votre chiffre d'affaires, et ont fait l'objet de changements récents. À vérifier auprès de l'administration fiscale ou d'un comptable. Les prix affichés doivent être TTC.
- **Documents** : mentions légales, conditions générales de vente, politique de confidentialité (données : identifiant, adresse e-mail éventuelle, historique d'achats, adresse IP technique), page de contact.
- **Droit de rétractation** : pour un contenu numérique fourni immédiatement, le consommateur doit donner son accord exprès et reconnaître qu'il renonce à son droit de rétractation avant la livraison (case à cocher avant le paiement, confirmation par e-mail Stripe).
- **Mineurs** : achats réservés aux majeurs ou avec l'accord d'un parent (case à cocher) ; pas de sollicitations pressantes ; procédure de remboursement en cas d'achat non autorisé.
- **Licences d'assets** : tous les assets intégrés sont CC0 (usage commercial autorisé). Reconfirmer chaque licence sur sa page d'origine avant la vente (certaines n'ont été vérifiées que sur des dépôts miroirs). Les assets Fab marqués « usage avec IA : non » ne doivent pas être intégrés par cet outil.

**La boutique ne sera pas présentée comme prête à vendre tant que ces points n'auront pas été vérifiés.**

---

## 6. Risques

| Risque | Gravité | Réponse |
|---|---|---|
| Triche d'un hôte en architecture hybride | Haute pour du compétitif public | Salons privés d'abord ; mode serveur (B) pour un futur classement. |
| Connexions directes impossibles sur certains réseaux | Moyenne | Relais TURN Cloudflare (1 000 Go gratuits par mois, conditions d'activation à vérifier) ; message d'erreur clair. |
| Onglet de l'hôte en arrière-plan | Haute | Simulation et réseau dans un Web Worker. |
| Dépassement des quotas Cloudflare | Faible financièrement (offre gratuite non facturable), forte pour la disponibilité | Garde-fou à 80 %, solo toujours disponible. |
| Netlify mis en pause par manque de crédits | Moyenne | Migration progressive vers Cloudflare Pages, Netlify gardé en secours jusqu'à validation. |
| Paiement attribué deux fois ou pas du tout | Moyenne | Webhook signé, contraintes d'unicité, tests en mode test Stripe, journal des événements. |
| Remboursements et litiges | Moyenne | Révocation automatique, historique visible. |
| Obligations légales et fiscales | Haute | Validation par un professionnel avant toute vente réelle. |
| Rentabilité | Incertaine | Frais fixes Stripe élevés sur les petits prix ; aucune hypothèse de revenus dans ce document. |
| Performance navigateur à 8 joueurs | Moyenne | Fusion des personnages et animation à distance déjà en place ; à mesurer sur machine modeste. |
| Charge de travail | Haute | Découpage en phases avec validation à chaque étape. |

---

## 7. Déploiement et mises à jour (proposition)

1. **Développement** : Claude Code sur une branche de travail, tests automatiques (`npm test`) avant chaque validation.
2. **GitHub** : chaque branche poussée produit une **prévisualisation** Cloudflare Pages (URL distincte) ; la branche principale produit la version publique.
3. **URL permanente** : `warbound.pages.dev` (gratuite), en parallèle de `warbound.netlify.app` tant que la migration n'est pas validée.
4. **Worker et Durable Objects** : déployés avec `wrangler` depuis le dépôt ; environnements `dev` et `prod` séparés ; secrets Stripe via `wrangler secret`.
5. **Validation d'une version** : tests automatiques, test manuel sur la prévisualisation, puis fusion dans la branche principale.
6. **Retour arrière** : Cloudflare Pages permet de republier un déploiement précédent en un clic ; les Workers gardent leurs versions (`wrangler rollback`). Les migrations D1 sont uniquement additives (pas de suppression de colonne sans sauvegarde).
7. Aucune action sur Cloudflare, Stripe ou Netlify ne sera faite par moi sans votre accord ; la création des comptes et l'association à GitHub sont à faire par vous.

---

## 8. Plan de tests

Rien ne sera déclaré réussi sans avoir été exécuté ; chaque résultat sera consigné dans `TESTS.md` avec ce qui n'a pas pu être testé.

| Domaine | Tests automatisés (ici) | Tests réels (avec vous et d'autres joueurs) |
|---|---|---|
| 1v1 | Partie complète entre deux navigateurs (déjà en place) | Deux appareils sur le même réseau, puis sur deux réseaux différents (dont un en 4G) |
| Salons | Création, code, lien, prêt, lancement, expiration, reconnexion (Worker local avec `wrangler dev`) | Invitations envoyées réellement |
| 2v2 puis 4v4 | 4 puis 8 navigateurs automatisés ; latence et pertes simulées | Parties à 4 puis 8 personnes |
| Autorité | Tirs trop rapides, munitions infinies, dégâts falsifiés, téléportation, faux message de fin : tous refusés | — |
| Domination | Capture, accélération, contestation, points, fin à 200 | — |
| Performance | Images par seconde à 8 joueurs sur la configuration de test | Votre PC et un PC modeste |
| Boutique | Affichage, aperçu, équipement, cosmétique sans effet sur les statistiques (comparaison automatique) | — |
| Paiements | Stripe en mode test : achat, webhook signé, rejeu d'un webhook (pas de double attribution), remboursement, litige, erreur réseau | Achat test de bout en bout par vous |
| Infrastructure | Comportement à quota dépassé (simulé) : solo disponible, message clair | Déploiement Cloudflare réel, retour arrière |

---

## 9. Feuille de route priorisée

| Phase | Contenu | Livrable vérifiable | Prérequis de votre côté |
|---|---|---|---|
| 1. Audit | Ce document | Validation de l'architecture C | Votre accord |
| 2. Infrastructure | Projet Cloudflare Pages relié à GitHub (prévisualisations), Worker + Durable Object « salon » minimal, garde-fou de quotas ; Netlify inchangé | Jeu servi sur `*.pages.dev`, salon de test joignable | Créer un compte Cloudflare **sans moyen de paiement**, autoriser l'accès à GitHub |
| 3a. Fiabilisation du 1v1 | Boucle réseau en Web Worker, salons avec lien d'invitation (fin du copier-coller), protocole binaire, interpolation, reconnexion | 1v1 testé entre deux réseaux réels | Un ami pour le test réel |
| 3b. Équipes | Topologie en étoile, autorité d'hôte, 2v2 puis TDM 4v4, carte 4v4, HUD d'équipe, tableau des scores | Parties 2v2 puis 4v4 réelles | Joueurs testeurs |
| 4. Domination | Zones, captures, scores | Partie de Domination complète | — |
| 5. Boutique (démonstration) | Interface, 3 skins, Pack Fondateur, aperçu 3D, équipement local **sans achat** | Cosmétiques visibles en jeu et chez les autres joueurs | — |
| 6. Comptes et inventaire | Comptes anonymes, OAuth, D1, possessions côté serveur | Inventaire retrouvé sur un autre appareil | Création des applications OAuth Google ou Discord |
| 7. Paiements (test) | Stripe Checkout en mode test, webhooks, remboursements, pages légales en brouillon | Achats test de bout en bout | Compte Stripe en mode test ; démarches de statut |
| 8. Bêta publique | Mesures de latence, réglage des fréquences, ouverture progressive | Rapport de mesures | Communauté de testeurs |
| 9. Commercialisation | Activation des paiements réels | — | **Votre autorisation explicite** et la validation juridique et fiscale |

Ordre recommandé : la phase 3a passe en premier, car elle corrige les deux défauts bloquants du duel actuel (arrière-plan, copier-coller) et pose le protocole utilisé ensuite pour le 4v4.

---

## 10. État d'avancement (version 2.6.0)

| Phase | État | Remarques |
|---|---|---|
| 1. Audit | Fait | Ce document |
| 2. Infrastructure | **Déployé** | Worker `warbound-lobby.amvprod.workers.dev` et base D1 `warbound` (offre gratuite), déployés depuis GitHub ; jeu publié aussi sur Cloudflare Pages ; Netlify conservé en secours |
| 3. Multijoueur | Fait et testé en local | Salons par code ou lien, étoile WebRTC, autorité de l'hôte, protocole binaire, boucle réseau en Web Worker, reconnexion au salon ; 1v1, TDM 4v4. **Pas encore testé entre appareils et réseaux réels.** Migration d'hôte non faite (si l'hôte part, la partie s'arrête). La réconciliation se fait par correction de position (pas de rejeu des commandes). |
| 4. Domination | Fait et testé en local | Zones A, B, C sur l'arène actuelle ; une carte 4v4 plus grande reste à faire |
| 5. Boutique | Faite | 3 camouflages, Pack Fondateur, aperçu 3D, essai local en démonstration |
| 6. Comptes et inventaire | Code prêt, testé en local | Compte anonyme, code de récupération ; connexion Google ou Discord non faite (demande vos applications OAuth) |
| 7. Paiements | **Mode test Stripe validé** | Achat, attribution, équipement et remboursement vérifiés par le propriétaire en mode test. Paiements réels **non activés** : en attente de la validation juridique et fiscale et d'une autorisation explicite |
| 8–9. Bêta et vente | Non commencé | Après tests réels, validation légale et votre autorisation |

## Sources (consultées le 13/11/2026)

- [Tarifs Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Limites Durable Objects](https://developers.cloudflare.com/durable-objects/platform/limits/), [WebSockets et hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Tarifs Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Limites Workers](https://developers.cloudflare.com/workers/platform/limits/)
- [Limites D1](https://developers.cloudflare.com/d1/platform/limits/), [Journal des modifications D1](https://developers.cloudflare.com/changelog/product/d1/)
- [Limites Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/)
- [Tarifs Cloudflare Realtime (TURN)](https://developers.cloudflare.com/realtime/sfu/pricing/), [FAQ TURN](https://developers.cloudflare.com/realtime/turn/faq/)
- [Netlify : comparaison des offres](https://www.netlify.com/pricing/pro-vs-free/)
- [Stripe : tarifs France](https://stripe.com/en-fr/pricing), [Stripe en France (aide)](https://support.stripe.com/questions/stripe-en-france?locale=fr-FR)
