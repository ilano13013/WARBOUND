// Garde-fou de quotas : un seul Durable Object global compte les salons créés et les connexions du jour (UTC)
// et refuse au-delà des seuils configurés, bien avant les limites gratuites de Cloudflare.
// Il limite aussi la création de salons par adresse IP (par heure), contre les abus.
import { DurableObject } from 'cloudflare:workers';

type Verdict = { ok: true } | { ok: false; reason: string };

export class Guard extends DurableObject {
  private day(): string { return new Date().toISOString().slice(0, 10); }

  private async bump(key: string): Promise<number> {
    const n = ((await this.ctx.storage.get<number>(key)) || 0) + 1;
    await this.ctx.storage.put(key, n);
    return n;
  }

  /** Purge des compteurs des jours précédents (appelée au passage). */
  private async purge(): Promise<void> {
    const d = this.day();
    const last = await this.ctx.storage.get<string>('day');
    if (last === d) return;
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.put('day', d);
  }

  async allowRoom(ip: string, maxPerDay: number, maxPerIpHour: number): Promise<Verdict> {
    await this.purge();
    const d = this.day();
    const rooms = (await this.ctx.storage.get<number>(`rooms:${d}`)) || 0;
    if (rooms >= maxPerDay) return { ok: false, reason: 'Les serveurs de salons ont atteint leur limite du jour. Réessayez demain ; le jeu solo reste disponible.' };
    const hour = new Date().toISOString().slice(0, 13);
    const perIp = (await this.ctx.storage.get<number>(`ip:${ip}:${hour}`)) || 0;
    if (perIp >= maxPerIpHour) return { ok: false, reason: 'Trop de salons créés depuis votre connexion. Patientez une heure.' };
    await this.bump(`rooms:${d}`);
    await this.bump(`ip:${ip}:${hour}`);
    return { ok: true };
  }

  async allowJoin(maxPerDay: number): Promise<Verdict> {
    await this.purge();
    const n = (await this.ctx.storage.get<number>(`joins:${this.day()}`)) || 0;
    if (n >= maxPerDay) return { ok: false, reason: 'Les serveurs de salons ont atteint leur limite du jour.' };
    await this.bump(`joins:${this.day()}`);
    return { ok: true };
  }

  async status(): Promise<{ day: string; rooms: number; joins: number }> {
    const d = this.day();
    return { day: d, rooms: (await this.ctx.storage.get<number>(`rooms:${d}`)) || 0, joins: (await this.ctx.storage.get<number>(`joins:${d}`)) || 0 };
  }
}
