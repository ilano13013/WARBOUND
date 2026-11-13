// Test des comptes, de l'inventaire et des webhooks Stripe contre `wrangler dev` local.
// Les événements Stripe sont signés ici avec le secret de test de server/.dev.vars : aucun appel à Stripe.
import { createHmac } from 'node:crypto';
const BASE = process.argv[2] || 'http://localhost:8787';
const SECRET = 'whsec_local_test_only';
const ORIGIN = 'http://localhost:4174';
let pass = 0, fail = 0;
const ok = (c, label, extra = '') => { if (c) pass++; else fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${label} ${extra}`); };
const api = async (path, { method = 'GET', body, token, headers = {} } = {}) => {
  const r = await fetch(BASE + path, { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const hook = (ev, { t = Math.floor(Date.now() / 1000), secret = SECRET } = {}) => {
  const payload = JSON.stringify(ev);
  const sig = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return api('/api/stripe/webhook', { method: 'POST', body: payload, headers: { 'Stripe-Signature': `t=${t},v1=${sig}`, Origin: '' } });
};
const rid = () => Math.random().toString(36).slice(2, 10);

const cat = await api('/api/catalog');
ok(cat.status === 200 && cat.body.products.length === 4 && cat.body.products.find((p) => p.sku === 'pack_fondateur').priceCents === 999, 'catalogue : 4 produits, prix fixés par le serveur', cat.body.products.map((p) => `${p.sku}=${p.priceCents}`).join(' '));
ok(cat.body.testMode === true, 'catalogue : mode test signalé');

const acc = await api('/api/account', { method: 'POST', body: { name: 'Alpha' } });
ok(acc.status === 201 && acc.body.token?.length === 48, 'compte anonyme créé', acc.body.id);
const T = acc.body.token, PID = acc.body.id;
let me = await api('/api/me', { token: T });
ok(me.status === 200 && me.body.owned.length === 0, 'inventaire vide au départ');
ok((await api('/api/me', { token: 'x'.repeat(48) })).status === 401, 'jeton inconnu refusé');
ok((await api('/api/me/equip', { method: 'POST', token: T, body: { slot: 'outfit', item: 'outfit_fondateur' } })).status === 403, 'équiper un objet non possédé : refusé');

// webhooks
const sess = (over = {}) => ({ id: 'evt_' + rid(), type: 'checkout.session.completed', livemode: false, data: { object: { id: 'cs_test_' + rid(), payment_status: 'paid', amount_total: 999, currency: 'eur', payment_intent: 'pi_' + rid(), client_reference_id: PID, metadata: { sku: 'pack_fondateur', player: PID }, customer_details: { email: 'test@example.invalid' }, ...over } } });
const bad = await api('/api/stripe/webhook', { method: 'POST', body: JSON.stringify(sess()), headers: { 'Stripe-Signature': 't=1,v1=00', Origin: '' } });
ok(bad.status === 400, 'webhook à signature invalide refusé');
const old = await hook(sess(), { t: Math.floor(Date.now() / 1000) - 3600 });
ok(old.status === 400, 'webhook trop ancien (rejeu) refusé');
const wrongSecret = await hook(sess(), { secret: 'whsec_autre' });
ok(wrongSecret.status === 400, 'webhook signé avec un autre secret refusé');
const cheap = await hook(sess({ amount_total: 1 }));
ok(cheap.body.ignored === 'montant inattendu', 'montant différent du catalogue : aucun objet attribué');

const e1 = sess();
const g1 = await hook(e1);
ok(g1.status === 200 && g1.body.granted?.length === 5, 'paiement confirmé : Pack Fondateur attribué (5 objets)', JSON.stringify(g1.body.granted));
const dupEvt = await hook(e1);
ok(dupEvt.body.duplicate, 'même événement renvoyé par Stripe : ignoré');
const dupSess = await hook({ ...e1, id: 'evt_' + rid() });
ok(dupSess.body.duplicate, 'même session sous un autre événement : pas de double attribution');

me = await api('/api/me', { token: T });
ok(me.body.owned.length === 5 && me.body.badge === 'FONDATEUR', 'inventaire et badge Fondateur après achat', me.body.owned.join(','));
ok(me.body.purchases.length === 1 && me.body.purchases[0].status === 'paid', 'historique : un achat payé');
ok((await api('/api/me/equip', { method: 'POST', token: T, body: { slot: 'outfit', item: 'outfit_fondateur' } })).status === 200, 'tenue Fondateur équipée');
ok((await api('/api/me/equip', { method: 'POST', token: T, body: { slot: 'outfit', item: 'camo_fondateur' } })).status === 400, 'objet dans le mauvais emplacement : refusé');
await api('/api/me/equip', { method: 'POST', token: T, body: { slot: 'camo', item: 'camo_fondateur' } });

// le salon lit les cosmétiques dans la base (le client ne les déclare pas)
const room = await api('/api/rooms', { method: 'POST', body: { mode: 'duel' } });
const ws = new WebSocket(BASE.replace('http', 'ws') + `/api/rooms/${room.body.code}/ws`, { headers: { Origin: ORIGIN } });
const welcome = await new Promise((res) => { ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name: 'Alpha', acct: T, version: 1, build: 'test' })); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'welcome') res(m); }; setTimeout(() => res(null), 4000); });
const pv = welcome?.room.players[0];
ok(pv?.badge === 'FONDATEUR' && pv?.cos.outfit === 'outfit_fondateur' && pv?.cos.camo === 'camo_fondateur', 'salon : badge et cosmétiques vérifiés par le serveur', JSON.stringify(pv && { badge: pv.badge, cos: pv.cos }));
ws.close();

// remboursement total -> retrait
const ref = await hook({ id: 'evt_' + rid(), type: 'charge.refunded', data: { object: { id: 'ch_' + rid(), payment_intent: e1.data.object.payment_intent, refunded: true } } });
ok(ref.body.revoked && ref.body.status === 'refunded', 'remboursement : objets retirés');
me = await api('/api/me', { token: T });
ok(me.body.owned.length === 0 && !me.body.badge && !me.body.equipped.outfit && me.body.purchases[0].status === 'refunded', 'après remboursement : inventaire vide, rien d’équipé, achat marqué remboursé');

// contestation sur un second achat
const e2 = sess({ amount_total: 199, metadata: { sku: 'camo_cendre', player: PID } });
await hook(e2);
const disp = await hook({ id: 'evt_' + rid(), type: 'charge.dispute.created', data: { object: { id: 'dp_' + rid(), payment_intent: e2.data.object.payment_intent } } });
ok(disp.body.status === 'disputed', 'contestation de paiement : objet retiré');

// récupération du compte
const rec = await api('/api/me/recovery', { method: 'POST', token: T });
ok(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(rec.body.code), 'code de récupération généré', rec.body.code);
const back = await api('/api/account/recover', { method: 'POST', body: { code: rec.body.code } });
ok(back.status === 200 && back.body.id === PID, 'compte récupéré avec le code');
ok((await api('/api/me', { token: T })).status === 401 && (await api('/api/me', { token: back.body.token })).status === 200, 'ancien jeton invalidé, nouveau jeton valide');

// paiement : clé invalide (aucune vraie clé n'est utilisée dans ce test)
const co = await api('/api/me/checkout', { method: 'POST', token: back.body.token, body: { sku: 'camo_glacier' } });
ok(co.status === 502 && typeof co.body.error === 'string', 'paiement avec une clé de test invalide : erreur propre, aucun objet attribué', `${co.status} ${co.body.error}`);
ok((await api('/api/me/checkout', { method: 'POST', token: back.body.token, body: { sku: 'inconnu' } })).status === 404, 'produit inconnu refusé');

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
