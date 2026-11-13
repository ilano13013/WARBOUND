// Protocole du salon WARBOUND, partagé (par copie) avec le client : src/net/lobbyProtocol.ts.
// Toute modification doit être reportée des deux côtés ; PROTOCOL_VERSION protège contre les écarts.

export const PROTOCOL_VERSION = 1;

export type ModeId = 'duel' | 'tdm' | 'dom';
export type Team = 'red' | 'blue' | null;

export const MODES: Record<ModeId, { name: string; max: number; min: number; teams: boolean; maps: string[] }> = {
  duel: { name: 'Défi d’armes 1v1', max: 2, min: 2, teams: false, maps: ['chantier'] },
  tdm: { name: 'Match à mort par équipe 4v4', max: 8, min: 2, teams: true, maps: ['chantier'] },
  dom: { name: 'Domination 4v4', max: 8, min: 2, teams: true, maps: ['chantier'] },
};

/** Code de salon : 6 caractères sans ambiguïté (pas de O/0, I/1). */
export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export function newRoomCode(): string {
  const b = new Uint8Array(6); crypto.getRandomValues(b);
  return Array.from(b, (x) => ROOM_ALPHABET[x % ROOM_ALPHABET.length]).join('');
}

/** cos : cosmétiques équipés, VÉRIFIÉS par le serveur dans la base des achats (jamais déclarés par le client). */
export interface PlayerView { id: string; name: string; team: Team; ready: boolean; connected: boolean; host: boolean; badge: string | null; cos: Record<string, string> }
export interface RoomView { code: string; mode: ModeId; map: string; max: number; phase: 'lobby' | 'playing'; players: PlayerView[]; version: number }

/** Messages du client vers le salon. */
export type ClientMsg =
  | { t: 'join'; name: string; token?: string; acct?: string; version: number; build: string }
  | { t: 'ready'; v: boolean }
  | { t: 'team'; id: string; team: 'red' | 'blue' }
  | { t: 'balance' }
  | { t: 'config'; mode: ModeId; map: string }
  | { t: 'start' }
  | { t: 'end' }
  | { t: 'signal'; to: string; data: unknown }
  | { t: 'ping'; n: number };

/** Messages du salon vers le client. */
export type ServerMsg =
  | { t: 'welcome'; you: string; token: string; room: RoomView }
  | { t: 'room'; room: RoomView }
  | { t: 'start'; host: string; room: RoomView }
  | { t: 'end'; room: RoomView }
  | { t: 'signal'; from: string; data: unknown }
  | { t: 'pong'; n: number }
  | { t: 'error'; msg: string; fatal?: boolean };
