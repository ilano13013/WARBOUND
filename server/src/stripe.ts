// Stripe Checkout sans SDK (appels HTTP directs) et vérification de la signature des webhooks (Web Crypto).
// Aucun numéro de carte ne transite par WARBOUND : le paiement a lieu sur la page hébergée par Stripe.

export interface CheckoutArgs { secretKey: string; sku: string; name: string; amountCents: number; playerId: string; successUrl: string; cancelUrl: string }

/** Crée une session Stripe Checkout (paiement unique, euros, prix fixé par le serveur). */
export async function createCheckoutSession(a: CheckoutArgs): Promise<{ id: string; url: string }> {
  const f = new URLSearchParams();
  f.set('mode', 'payment');
  f.set('success_url', a.successUrl);
  f.set('cancel_url', a.cancelUrl);
  f.set('client_reference_id', a.playerId);
  f.set('line_items[0][quantity]', '1');
  f.set('line_items[0][price_data][currency]', 'eur');
  f.set('line_items[0][price_data][unit_amount]', String(a.amountCents));
  f.set('line_items[0][price_data][product_data][name]', a.name);
  f.set('metadata[sku]', a.sku);
  f.set('metadata[player]', a.playerId);
  // les métadonnées sont recopiées sur le paiement, pour retrouver l'achat lors d'un remboursement ou d'une contestation
  f.set('payment_intent_data[metadata][sku]', a.sku);
  f.set('payment_intent_data[metadata][player]', a.playerId);
  f.set('custom_text[submit][message]', 'Contenu numérique livré immédiatement après le paiement : en confirmant, vous demandez cette livraison immédiate et renoncez à votre droit de rétractation (art. L221-28 du Code de la consommation).');
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${a.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: f.toString(),
  });
  const body = (await r.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!r.ok || !body.id || !body.url) throw new Error(body.error?.message || `Stripe a refusé la création du paiement (${r.status}).`);
  return { id: body.id, url: body.url };
}

function hex(buf: ArrayBuffer): string { return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join(''); }
function safeEqual(a: string, b: string): boolean { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }

/** Signature HMAC-SHA256 au format Stripe (aussi utilisée par les tests pour signer des événements de test). */
export async function signPayload(secret: string, timestamp: number, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
}

/** Vérifie l'en-tête Stripe-Signature (t=...,v1=...) avec une tolérance de 5 minutes contre le rejeu. */
export async function verifyWebhook(payload: string, header: string | null, secret: string, toleranceS = 300, now = Date.now()): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]; }));
  const t = Number(parts.t);
  const sigs = header.split(',').filter((kv) => kv.trim().startsWith('v1=')).map((kv) => kv.trim().slice(3));
  if (!Number.isFinite(t) || !sigs.length) return false;
  if (Math.abs(now / 1000 - t) > toleranceS) return false;
  const expected = await signPayload(secret, t, payload);
  return sigs.some((s) => safeEqual(s, expected));
}
