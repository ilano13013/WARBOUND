// Compte joueur (serveur : server/src/accounts.ts). Le jeton est un identifiant de session, pas une preuve de
// possession : les objets possédés sont toujours relus sur le serveur. Sans serveur configuré, la boutique
// fonctionne en démonstration (aperçu et essai local, aucun achat, rien n'est synchronisé).
import { LOBBY_URL } from './LobbyClient';
import type { CosSlot } from '../data/cosmetics';

const KEY = 'wb-account';

export interface Me { id: string; name: string; owned: string[]; revoked: string[]; equipped: Partial<Record<CosSlot, string>>; badge: string | null; purchases: { id: string; sku: string; amount_cents: number; currency: string; status: string; livemode: number; created_at: number }[] }
export interface Catalog { currency: string; payments: boolean; testMode: boolean; products: { sku: string; name: string; priceCents: number }[] }

export class Account {
  me: Me | null = null;
  catalog: Catalog | null = null;
  /** Essai local (démonstration) : jamais envoyé en partie, jamais conservé. */
  trial: Partial<Record<CosSlot, string>> = {};
  error = '';

  get online(): boolean { return !!LOBBY_URL; }
  get token(): string | null { try { return localStorage.getItem(KEY); } catch { return null; } }
  private set token(t: string | null) { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch { /* */ } }

  /** Cosmétiques à afficher sur le joueur local : possédés et équipés (vérifiés), sinon essai de démonstration. */
  equipped(slot: CosSlot): string | null { return this.me?.equipped[slot] || this.trial[slot] || null; }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const r = await fetch(LOBBY_URL + path, { ...init, headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...(init.headers || {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(body.error || `Erreur du serveur (${r.status}).`) as Error & { status?: number }; e.status = r.status; throw e; }
    return body as T;
  }

  async loadCatalog(): Promise<Catalog | null> {
    if (!this.online) return null;
    try { this.catalog = await this.call<Catalog>('/api/catalog'); } catch (e) { this.error = (e as Error).message; this.catalog = null; }
    return this.catalog;
  }

  /** Charge le compte (le crée au besoin). */
  async ensure(name: string): Promise<Me | null> {
    if (!this.online) return null;
    try {
      if (!this.token) { const c = await this.call<{ token: string }>('/api/account', { method: 'POST', body: JSON.stringify({ name }) }); this.token = c.token; }
      this.me = await this.call<Me>('/api/me');
      this.error = '';
    } catch (e) {
      if ((e as { status?: number }).status === 401) { this.token = null; this.me = null; }
      this.error = (e as Error).message;
    }
    return this.me;
  }

  async refresh(): Promise<void> { if (this.token) { try { this.me = await this.call<Me>('/api/me'); } catch (e) { this.error = (e as Error).message; } } }

  async equip(slot: CosSlot, item: string | null): Promise<void> {
    await this.call('/api/me/equip', { method: 'POST', body: JSON.stringify({ slot, item }) });
    await this.refresh();
  }

  async checkout(sku: string): Promise<string> { const r = await this.call<{ url: string }>('/api/me/checkout', { method: 'POST', body: JSON.stringify({ sku }) }); return r.url; }
  async recoveryCode(): Promise<string> { return (await this.call<{ code: string }>('/api/me/recovery', { method: 'POST' })).code; }
  async recover(code: string): Promise<void> { const r = await this.call<{ token: string }>('/api/account/recover', { method: 'POST', body: JSON.stringify({ code }) }); this.token = r.token; await this.refresh(); }
}
