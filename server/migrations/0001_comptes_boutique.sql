-- Comptes joueurs, objets possédés, achats et événements Stripe (WARBOUND).
-- Migrations uniquement additives : aucune suppression de données sans sauvegarde préalable.

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,                 -- identifiant permanent (aléatoire)
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,     -- SHA-256 du jeton de session (le jeton lui-même n'est jamais stocké)
  recovery_hash TEXT,                  -- SHA-256 du code de récupération
  email TEXT,                          -- facultatif (renseigné par Stripe lors d'un achat)
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entitlements (
  player_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  source TEXT NOT NULL,                -- 'purchase:<id>' ou 'gift'
  revoked INTEGER NOT NULL DEFAULT 0,  -- 1 après remboursement ou contestation
  created_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, item_id)
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  stripe_session TEXT NOT NULL UNIQUE, -- empêche une double attribution
  payment_intent TEXT,
  status TEXT NOT NULL,                -- 'paid' | 'refunded' | 'disputed'
  livemode INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS purchases_player ON purchases(player_id);
CREATE INDEX IF NOT EXISTS purchases_pi ON purchases(payment_intent);

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,                 -- un événement Stripe n'est traité qu'une fois
  type TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS equipped (
  player_id TEXT NOT NULL,
  slot TEXT NOT NULL,                  -- 'camo' | 'outfit' | 'emblem' | 'card'
  item_id TEXT NOT NULL,
  PRIMARY KEY (player_id, slot)
);
