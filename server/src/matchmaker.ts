// Matchmaking public : un Durable Object global tient la liste des salles publiques en attente, par mode.
// « Partie rapide » envoie le joueur dans la salle la plus remplie qui a encore de la place, sinon en crée une.
// Les places restantes au lancement sont occupées par des bots (simulés par l'hôte de la partie).
import { DurableObject } from 'cloudflare:workers';
import type { ModeId } from './protocol';

interface Entry { code: string; mode: ModeId; n: number; max: number; phase: 'lobby' | 'playing'; t: number }
const STALE_MS = 5 * 60_000;

export class Matchmaker extends DurableObject {
  private rooms: Record<string, Entry> | null = null;

  private async load(): Promise<Record<string, Entry>> {
    if (!this.rooms) this.rooms = (await this.ctx.storage.get<Record<string, Entry>>('rooms')) || {};
    return this.rooms;
  }
  private async save(): Promise<void> { await this.ctx.storage.put('rooms', this.rooms || {}); }

  /** Salle publique disponible pour ce mode (la plus remplie), ou null. */
  async find(mode: ModeId): Promise<string | null> {
    const rooms = await this.load(), now = Date.now();
    let best: Entry | null = null;
    for (const [code, e] of Object.entries(rooms)) {
      if (now - e.t > STALE_MS) { delete rooms[code]; continue; }
      if (e.mode !== mode || e.phase !== 'lobby' || e.n >= e.max) continue;
      if (!best || e.n > best.n) best = e;
    }
    await this.save();
    if (best) { best.n++; best.t = now; await this.save(); } // place réservée en attendant la connexion
    return best ? best.code : null;
  }

  /** Mise à jour envoyée par une salle publique (joueurs connectés, phase). n = -1 : salle fermée. */
  async update(code: string, mode: ModeId, n: number, max: number, phase: 'lobby' | 'playing'): Promise<void> {
    const rooms = await this.load();
    if (n < 0) delete rooms[code];
    else rooms[code] = { code, mode, n, max, phase, t: Date.now() };
    await this.save();
  }
}
