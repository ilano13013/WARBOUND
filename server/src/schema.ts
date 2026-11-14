// Schéma de la base D1, appliqué automatiquement au premier appel (CREATE ... IF NOT EXISTS : sans effet s'il existe déjà).
// Copie de migrations/0001_comptes_boutique.sql : permet un déploiement depuis le tableau de bord, sans console SQL.
export const SCHEMA: string[] = [
  "CREATE TABLE IF NOT EXISTS players ( id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, recovery_hash TEXT, email TEXT, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL )",
  "CREATE TABLE IF NOT EXISTS entitlements ( player_id TEXT NOT NULL, item_id TEXT NOT NULL, source TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, PRIMARY KEY (player_id, item_id) )",
  "CREATE TABLE IF NOT EXISTS purchases ( id TEXT PRIMARY KEY, player_id TEXT NOT NULL, sku TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL, stripe_session TEXT NOT NULL UNIQUE, payment_intent TEXT, status TEXT NOT NULL, livemode INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS purchases_player ON purchases(player_id)",
  "CREATE INDEX IF NOT EXISTS purchases_pi ON purchases(payment_intent)",
  "CREATE TABLE IF NOT EXISTS stripe_events ( id TEXT PRIMARY KEY, type TEXT NOT NULL, received_at INTEGER NOT NULL )",
  "CREATE TABLE IF NOT EXISTS equipped ( player_id TEXT NOT NULL, slot TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (player_id, slot) )",
];
