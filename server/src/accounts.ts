// Comptes joueurs et inventaire (D1). Le jeton de session est un secret aléatoire envoyé dans l'en-tête
// Authorization ; seule son empreinte SHA-256 est stockée. Les objets possédés ne sont lus que dans la base :
// le navigateur ne peut pas s'attribuer un objet.
import { PRODUCTS, ITEM_SLOT } from './catalog';
import { createCheckoutSession, verifyWebhook } from './stripe';
import { SCHEMA } from './schema';

export interface AccountEnv {
  DB: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  GAME_URL: string;
}

const NAME_RE = /[^\p{L}\p{N} _\-.'’]/gu;

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}
function rand(bytes: number): string { const b = new Uint8Array(bytes); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(''); }
/** Code de récupération lisible : 4 groupes de 4 caractères. */
function recoveryCode(): string { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = new Uint8Array(16); crypto.getRandomValues(b); return Array.from(b, (x, i) => (i && i % 4 === 0 ? '-' : '') + A[x % A.length]).join(''); }

export async function playerFromToken(env: AccountEnv, token: string | null | undefined): Promise<{ id: string; name: string } | null> {
  if (!token || token.length < 20 || token.length > 128) return null;
  await ensureSchema(env);
  const row = await env.DB.prepare('SELECT id, name FROM players WHERE token_hash = ?').bind(await sha256(token)).first<{ id: string; name: string }>();
  return row || null;
}
function bearer(req: Request): string | null { const h = req.headers.get('Authorization') || ''; return h.startsWith('Bearer ') ? h.slice(7).trim() : null; }

/** Profil public vérifié (badge et cosmétiques équipés), utilisé par les salons. */
export async function verifiedCosmetics(env: AccountEnv, playerId: string): Promise<{ badge: string | null; equipped: Record<string, string> }> {
  const eq = await env.DB.prepare('SELECT e.slot, e.item_id FROM equipped e JOIN entitlements t ON t.player_id = e.player_id AND t.item_id = e.item_id AND t.revoked = 0 WHERE e.player_id = ?').bind(playerId).all<{ slot: string; item_id: string }>();
  const badge = await env.DB.prepare("SELECT 1 FROM entitlements WHERE player_id = ? AND item_id = 'badge_fondateur' AND revoked = 0").bind(playerId).first();
  const equipped: Record<string, string> = {};
  for (const r of eq.results || []) equipped[r.slot] = r.item_id;
  return { badge: badge ? 'FONDATEUR' : null, equipped };
}

type J = (data: unknown, status?: number) => Response;

let schemaReady = false;
/** Crée les tables si besoin (une fois par instance du Worker). */
export async function ensureSchema(env: AccountEnv): Promise<void> {
  if (schemaReady || !env.DB) return;
  await env.DB.batch(SCHEMA.map((q) => env.DB.prepare(q)));
  schemaReady = true;
}

export async function handleAccounts(req: Request, env: AccountEnv, url: URL, json: J): Promise<Response | null> {
  const p = url.pathname;
  await ensureSchema(env);
  const now = Date.now();

  // catalogue public (prix TTC, faisant foi)
  if (p === '/api/catalog' && req.method === 'GET') {
    return json({ currency: 'EUR', payments: !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET), testMode: !!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), products: Object.values(PRODUCTS).map((x) => ({ sku: x.sku, name: x.name, priceCents: x.priceCents, grants: x.grants })) });
  }

  // création d'un compte anonyme
  if (p === '/api/account' && req.method === 'POST') {
    let body: { name?: string } = {};
    try { body = await req.json(); } catch { /* */ }
    const name = String(body.name || 'Opérateur').replace(NAME_RE, '').trim().slice(0, 20) || 'Opérateur';
    const token = rand(24), id = rand(8);
    await env.DB.prepare('INSERT INTO players (id, name, token_hash, created_at, last_seen) VALUES (?, ?, ?, ?, ?)').bind(id, name, await sha256(token), now, now).run();
    return json({ id, name, token }, 201);
  }

  // récupération d'un compte avec son code
  if (p === '/api/account/recover' && req.method === 'POST') {
    let body: { code?: string } = {};
    try { body = await req.json(); } catch { /* */ }
    const code = String(body.code || '').toUpperCase().replace(/\s/g, '');
    if (!/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(code)) return json({ error: 'Code de récupération invalide.' }, 400);
    const row = await env.DB.prepare('SELECT id, name FROM players WHERE recovery_hash = ?').bind(await sha256(code)).first<{ id: string; name: string }>();
    if (!row) return json({ error: 'Code de récupération inconnu.' }, 404);
    // nouveau jeton : l'ancien appareil est déconnecté
    const token = rand(24);
    await env.DB.prepare('UPDATE players SET token_hash = ?, last_seen = ? WHERE id = ?').bind(await sha256(token), now, row.id).run();
    return json({ id: row.id, name: row.name, token });
  }

  // Webhook Stripe (pas d'authentification joueur : la signature fait foi)
  if (p === '/api/stripe/webhook' && req.method === 'POST') return stripeWebhook(req, env, json);

  if (!p.startsWith('/api/me')) return null;
  const me = await playerFromToken(env, bearer(req));
  if (!me) return json({ error: 'Session invalide ou expirée.' }, 401);
  await env.DB.prepare('UPDATE players SET last_seen = ? WHERE id = ?').bind(now, me.id).run();

  if (p === '/api/me' && req.method === 'GET') {
    const ent = await env.DB.prepare('SELECT item_id, revoked FROM entitlements WHERE player_id = ?').bind(me.id).all<{ item_id: string; revoked: number }>();
    const pur = await env.DB.prepare('SELECT id, sku, amount_cents, currency, status, livemode, created_at FROM purchases WHERE player_id = ? ORDER BY created_at DESC').bind(me.id).all();
    const cos = await verifiedCosmetics(env, me.id);
    return json({ id: me.id, name: me.name, owned: (ent.results || []).filter((e) => !e.revoked).map((e) => e.item_id), revoked: (ent.results || []).filter((e) => e.revoked).map((e) => e.item_id), equipped: cos.equipped, badge: cos.badge, purchases: pur.results || [] });
  }

  if (p === '/api/me/equip' && req.method === 'POST') {
    let body: { slot?: string; item?: string | null } = {};
    try { body = await req.json(); } catch { /* */ }
    const slot = String(body.slot || '');
    if (!['camo', 'outfit', 'emblem', 'card'].includes(slot)) return json({ error: 'Emplacement inconnu.' }, 400);
    if (!body.item) { await env.DB.prepare('DELETE FROM equipped WHERE player_id = ? AND slot = ?').bind(me.id, slot).run(); return json({ ok: true }); }
    const item = String(body.item);
    if (ITEM_SLOT[item] !== slot) return json({ error: 'Cet objet ne va pas dans cet emplacement.' }, 400);
    const own = await env.DB.prepare('SELECT 1 FROM entitlements WHERE player_id = ? AND item_id = ? AND revoked = 0').bind(me.id, item).first();
    if (!own) return json({ error: 'Objet non possédé.' }, 403);
    await env.DB.prepare('INSERT INTO equipped (player_id, slot, item_id) VALUES (?, ?, ?) ON CONFLICT(player_id, slot) DO UPDATE SET item_id = excluded.item_id').bind(me.id, slot, item).run();
    return json({ ok: true });
  }

  if (p === '/api/me/recovery' && req.method === 'POST') {
    const code = recoveryCode();
    await env.DB.prepare('UPDATE players SET recovery_hash = ? WHERE id = ?').bind(await sha256(code), me.id).run();
    return json({ code }); // affiché une seule fois ; seule son empreinte est conservée
  }

  if (p === '/api/me/checkout' && req.method === 'POST') {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Les paiements ne sont pas activés sur ce serveur.' }, 503);
    let body: { sku?: string } = {};
    try { body = await req.json(); } catch { /* */ }
    const prod = PRODUCTS[String(body.sku || '')];
    if (!prod) return json({ error: 'Produit inconnu.' }, 404);
    // déjà possédé : pas de second achat
    const owned = await env.DB.prepare(`SELECT COUNT(*) AS n FROM entitlements WHERE player_id = ? AND revoked = 0 AND item_id IN (${prod.grants.map(() => '?').join(',')})`).bind(me.id, ...prod.grants.map((g) => g.id)).first<{ n: number }>();
    if ((owned?.n || 0) >= prod.grants.length) return json({ error: 'Vous possédez déjà cet objet.' }, 409);
    const base = env.GAME_URL.replace(/\/?$/, '/');
    try {
      const s = await createCheckoutSession({ secretKey: env.STRIPE_SECRET_KEY, sku: prod.sku, name: prod.name, amountCents: prod.priceCents, playerId: me.id, successUrl: `${base}?achat=ok`, cancelUrl: `${base}?achat=annule` });
      return json({ url: s.url });
    } catch (e) { return json({ error: (e as Error).message }, 502); }
  }

  return json({ error: 'Introuvable.' }, 404);
}

/** Webhook Stripe : attribution après paiement confirmé, retrait après remboursement ou contestation. */
async function stripeWebhook(req: Request, env: AccountEnv, json: J): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Webhook non configuré.' }, 503);
  const payload = await req.text();
  if (!(await verifyWebhook(payload, req.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET))) return json({ error: 'Signature invalide.' }, 400);
  let ev: { id: string; type: string; livemode?: boolean; data: { object: any } };
  try { ev = JSON.parse(payload); } catch { return json({ error: 'Corps illisible.' }, 400); }
  const now = Date.now();
  // un même événement n'est traité qu'une fois (Stripe peut le renvoyer)
  const first = await env.DB.prepare('INSERT OR IGNORE INTO stripe_events (id, type, received_at) VALUES (?, ?, ?)').bind(ev.id, ev.type, now).run();
  if (!first.meta.changes) return json({ received: true, duplicate: true });
  const o = ev.data.object;

  if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
    if (o.payment_status !== 'paid') return json({ received: true, pending: true });
    const sku = String(o.metadata?.sku || ''), playerId = String(o.metadata?.player || o.client_reference_id || '');
    const prod = PRODUCTS[sku];
    if (!prod || !playerId) return json({ received: true, ignored: 'métadonnées incomplètes' });
    // contrôle : le montant payé doit être celui du catalogue
    if (Number(o.amount_total) !== prod.priceCents || String(o.currency).toLowerCase() !== 'eur') return json({ received: true, ignored: 'montant inattendu' });
    const purchaseId = `p_${o.id}`;
    const ins = await env.DB.prepare('INSERT OR IGNORE INTO purchases (id, player_id, sku, amount_cents, currency, stripe_session, payment_intent, status, livemode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(purchaseId, playerId, sku, prod.priceCents, 'eur', o.id, o.payment_intent || null, 'paid', ev.livemode ? 1 : 0, now, now).run();
    if (!ins.meta.changes) return json({ received: true, duplicate: true });
    const stmts = prod.grants.map((g) => env.DB.prepare('INSERT INTO entitlements (player_id, item_id, source, revoked, created_at) VALUES (?, ?, ?, 0, ?) ON CONFLICT(player_id, item_id) DO UPDATE SET revoked = 0, source = excluded.source').bind(playerId, g.id, `purchase:${purchaseId}`, now));
    if (o.customer_details?.email) stmts.push(env.DB.prepare('UPDATE players SET email = COALESCE(email, ?) WHERE id = ?').bind(String(o.customer_details.email).slice(0, 200), playerId));
    await env.DB.batch(stmts);
    return json({ received: true, granted: prod.grants.map((g) => g.id) });
  }

  if (ev.type === 'charge.refunded' || ev.type === 'charge.dispute.created') {
    const pi = String(o.payment_intent || '');
    if (ev.type === 'charge.refunded' && o.refunded === false) return json({ received: true, partial: true }); // remboursement partiel : pas de retrait automatique
    const pur = await env.DB.prepare('SELECT id, player_id, sku FROM purchases WHERE payment_intent = ?').bind(pi).first<{ id: string; player_id: string; sku: string }>();
    if (!pur) return json({ received: true, ignored: 'achat inconnu' });
    const status = ev.type === 'charge.refunded' ? 'refunded' : 'disputed';
    const prod = PRODUCTS[pur.sku];
    const stmts = [env.DB.prepare('UPDATE purchases SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, pur.id)];
    for (const g of prod?.grants || []) {
      stmts.push(env.DB.prepare('UPDATE entitlements SET revoked = 1 WHERE player_id = ? AND item_id = ? AND source = ?').bind(pur.player_id, g.id, `purchase:${pur.id}`));
      stmts.push(env.DB.prepare('DELETE FROM equipped WHERE player_id = ? AND item_id = ?').bind(pur.player_id, g.id));
    }
    await env.DB.batch(stmts);
    return json({ received: true, revoked: true, status });
  }

  return json({ received: true });
}
