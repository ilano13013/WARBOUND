# WARBOUND — Déploiement, mises à jour et retour arrière

Ce guide décrit la mise en ligne des services multijoueur et boutique. **Rien de ce qui suit n'a été exécuté** : il faut votre compte Cloudflare (et plus tard Stripe). Toutes les étapes restent sur les offres gratuites ; aucune ne demande de moyen de paiement.

Netlify (`warbound.netlify.app`) reste en service tel quel. Sans les étapes ci-dessous, le site Netlify affiche « Multijoueur en ligne : serveur non configuré » et la boutique en démonstration ; le solo et le duel par codes fonctionnent.

## Vue d'ensemble

| Élément | Où | Rôle |
|---|---|---|
| Jeu (fichiers statiques) | Netlify (actuel) puis Cloudflare Pages | Téléchargement du jeu ; le solo n'utilise rien d'autre |
| `server/` (Worker + Durable Objects) | Cloudflare Workers | Salons, signalisation WebRTC, garde-fou de quotas, comptes, boutique, webhook Stripe |
| Base D1 `warbound` | Cloudflare D1 | Comptes, objets possédés, achats |
| Parties | Navigateurs des joueurs (WebRTC) | L'hôte fait autorité ; aucun trafic de jeu ne passe par Cloudflare |

## 1. Compte Cloudflare (vous)

1. Créer un compte sur https://dash.cloudflare.com/sign-up — **ne pas ajouter de moyen de paiement**, rester sur l'offre Free.
2. Sur votre ordinateur (ou dans une session Claude Code), dans le dossier du dépôt :
   ```bash
   cd server
   npm install
   npx wrangler login          # ouvre le navigateur pour autoriser wrangler
   ```

## 2. Base D1

```bash
npx wrangler d1 create warbound
```
Recopier l'identifiant affiché (`database_id`) dans `server/wrangler.toml`, puis :
```bash
npx wrangler d1 migrations apply warbound --remote
```

## 3. Worker (salons, comptes, boutique)

1. Dans `server/wrangler.toml`, vérifier `ALLOWED_ORIGINS` (adresses autorisées du jeu) et `GAME_URL`.
2. Déployer :
   ```bash
   npx wrangler deploy
   ```
   L'adresse affichée ressemble à `https://warbound-lobby.<votre-sous-domaine>.workers.dev`.
3. Vérifier : ouvrir `https://warbound-lobby.<…>.workers.dev/api/health` → `{"ok":true,…}`.

Les seuils du garde-fou (`MAX_ROOMS_PER_DAY`, `MAX_JOINS_PER_DAY`, `MAX_ROOMS_PER_IP_PER_HOUR`) sont réglés bien en dessous des 100 000 requêtes par jour de l'offre gratuite. Au-delà, le serveur refuse les nouveaux salons avec un message clair ; il ne peut pas y avoir de facturation sur un compte gratuit sans moyen de paiement.

## 4. Jeu sur Cloudflare Pages (en parallèle de Netlify)

1. Tableau de bord Cloudflare → Workers & Pages → Créer → Pages → **Connecter à Git** → dépôt `ilano13013/warbound`.
2. Réglages de construction :
   - Commande : `npm run build`
   - Dossier de sortie : `dist`
   - Variable d'environnement : `VITE_LOBBY_URL` = l'adresse du Worker (étape 3), sans `/` final
   - Variable : `NODE_VERSION` = `22`
3. Branche de production : celle que vous choisissez (par exemple `main` après fusion). Chaque autre branche poussée obtient une **prévisualisation** à une adresse distincte.
4. L'adresse permanente est `warbound.pages.dev` (ou `<nom>.pages.dev`). Ajouter cette adresse exacte à `ALLOWED_ORIGINS` puis redéployer le Worker.

Pour activer aussi le multijoueur sur Netlify : ajouter la variable `VITE_LOBBY_URL` dans Netlify (Site configuration → Environment variables) et redéployer. Attention : chaque déploiement Netlify consomme 15 des 300 crédits mensuels gratuits.

## 5. Paiements Stripe (mode test uniquement, après votre accord)

1. Créer un compte Stripe, rester en **mode test**.
2. Récupérer la clé secrète de test `sk_test_…` et l'enregistrer comme secret du Worker :
   ```bash
   npx wrangler secret put STRIPE_SECRET_KEY
   ```
3. Stripe → Développeurs → Webhooks → Ajouter un point de terminaison : `https://warbound-lobby.<…>.workers.dev/api/stripe/webhook`, événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`. Copier le secret de signature `whsec_…` :
   ```bash
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```
4. La boutique affiche alors « MODE TEST STRIPE ». Tester avec les cartes de test de Stripe (par exemple 4242 4242 4242 4242).
5. **Paiements réels** : uniquement après votre autorisation explicite, la validation des documents de `docs/legal/` et la vérification du statut juridique et fiscal. Il suffira alors de remplacer les deux secrets par les clés de production.

## 6. Mises à jour

1. Développement sur une branche, tests (`npm test`, et les tests en ligne ci-dessous).
2. Pousser la branche : Cloudflare Pages construit une prévisualisation.
3. Tester la prévisualisation, puis fusionner dans la branche de production.
4. Pour le serveur : `cd server && npx wrangler deploy`. Les migrations D1 sont uniquement additives.
5. Le protocole des salons a un numéro de version (`PROTOCOL_VERSION`) ; un jeu et un serveur de versions différentes refusent de se connecter avec un message clair. Déployer le serveur et le jeu ensemble quand ce numéro change.

## 7. Retour arrière

- Jeu (Cloudflare Pages) : Déploiements → choisir un déploiement précédent → « Rollback ».
- Jeu (Netlify) : Deploys → choisir un déploiement → « Publish deploy ».
- Worker : `npx wrangler deployments list` puis `npx wrangler rollback <id>`.
- D1 : `npx wrangler d1 time-travel restore warbound --timestamp=<date>` (restauration à un instant donné, offre gratuite comprise selon la documentation Cloudflare ; à vérifier avant d'en dépendre).

## 8. Tests en local (sans compte)

```bash
# serveur local (Durable Objects et D1 simulés)
cd server && npm install && npx wrangler d1 migrations apply warbound --local
printf 'STRIPE_WEBHOOK_SECRET=whsec_local_test_only\nSTRIPE_SECRET_KEY=sk_test_local_invalid_key\nMAX_ROOMS_PER_IP_PER_HOUR=1000\n' > .dev.vars
npm run dev                                     # http://localhost:8787
node test/lobby.test.mjs && node test/accounts.test.mjs

# jeu construit pour ce serveur, servi sur le port 4174
cd .. && VITE_LOBBY_URL=http://localhost:8787 npx vite build --outDir dist-test
npx vite preview --outDir dist-test --port 4174
node tests/online.mjs && node tests/shop.mjs
```

## 9. Suivi des quotas

- Tableau de bord Cloudflare → Workers & Pages → `warbound-lobby` → Métriques (requêtes, erreurs) ; D1 → Métriques.
- `GET /api/health` donne les compteurs du garde-fou du jour (salons créés, connexions).
