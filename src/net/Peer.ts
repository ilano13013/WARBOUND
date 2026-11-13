// Liaison directe entre deux navigateurs (WebRTC DataChannel), établie par échange manuel de codes.
// Aucun serveur de jeu : l'hôte crée un code d'invitation, l'invité répond par un code de réponse.
// Les codes contiennent la description de session (SDP) avec ses adresses candidates, compressée.

export type PeerRole = 'host' | 'guest';

/** Serveurs STUN publics : ils servent seulement à découvrir l'adresse publique de chaque joueur. */
const STUN: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const PREFIX = 'WB1';

async function deflate(text: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'undefined') return data;
  const s = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function inflate(data: Uint8Array): Promise<string> {
  const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(s).text();
}
function b64(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64(s: string): Uint8Array { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i); return out; }

/** Code texte : WB1.<o|a>.<z|p>.<base64url> (o = invitation, a = réponse ; z = compressé, p = brut). */
export async function encodeCode(kind: 'o' | 'a', sdp: string): Promise<string> {
  const z = typeof CompressionStream !== 'undefined';
  return `${PREFIX}.${kind}.${z ? 'z' : 'p'}.${b64(await deflate(sdp))}`;
}
export async function decodeCode(code: string): Promise<{ kind: 'o' | 'a'; sdp: string }> {
  const clean = code.replace(/\s+/g, '');
  const parts = clean.split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX || (parts[1] !== 'o' && parts[1] !== 'a')) throw new Error('Code invalide : copiez-le en entier, sans rien ajouter.');
  let bytes: Uint8Array;
  try { bytes = unb64(parts[3]); } catch { throw new Error('Code invalide : caractères inattendus.'); }
  let sdp: string;
  try { sdp = parts[2] === 'z' ? await inflate(bytes) : new TextDecoder().decode(bytes); } catch { throw new Error('Code incomplet ou abîmé.'); }
  if (!sdp.startsWith('v=0')) throw new Error('Code invalide.');
  return { kind: parts[1] as 'o' | 'a', sdp };
}

export class Peer {
  pc: RTCPeerConnection;
  /** Canal fiable et ordonné : événements (touches, éliminations, fin de partie). */
  rel: RTCDataChannel | null = null;
  /** Canal non fiable : positions (une perte est remplacée par l'état suivant). */
  fast: RTCDataChannel | null = null;
  onMessage: (m: any) => void = () => {};
  /** Messages binaires (positions, instantanés : voir wire.ts). */
  onBinary: (b: ArrayBuffer) => void = () => {};
  onOpen: () => void = () => {};
  onClose: (why: string) => void = () => {};
  open = false;
  closed = false;
  lastRecv = 0;

  constructor(public role: PeerRole, useStun = true) {
    this.pc = new RTCPeerConnection({ iceServers: useStun ? STUN : [] });
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      if (s === 'failed') this.close('La connexion directe a échoué (réseau incompatible ou pare-feu).');
      else if (s === 'closed') this.close('Connexion fermée.');
    };
    if (role === 'host') {
      this.bind(this.pc.createDataChannel('rel', { ordered: true }));
      this.bind(this.pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 }));
    } else this.pc.ondatachannel = (e) => this.bind(e.channel);
  }

  private bind(ch: RTCDataChannel): void {
    if (ch.label === 'fast') this.fast = ch; else this.rel = ch;
    ch.binaryType = 'arraybuffer';
    ch.onmessage = (e) => {
      this.lastRecv = performance.now();
      if (e.data instanceof ArrayBuffer) { this.onBinary(e.data); return; }
      let m: unknown;
      try { m = JSON.parse(String(e.data)); } catch { return; /* message illisible ignoré */ }
      this.onMessage(m);
    };
    ch.onopen = () => { if (!this.open && this.rel?.readyState === 'open' && this.fast?.readyState === 'open') { this.open = true; this.lastRecv = performance.now(); this.onOpen(); } };
    ch.onclose = () => { if (ch === this.rel) this.close('L’adversaire s’est déconnecté.'); };
  }

  /** Attend la fin de la collecte des adresses (ou au plus maxMs, les serveurs STUN pouvant être injoignables). */
  private gather(maxMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') { resolve(); return; }
      const t = setTimeout(done, maxMs);
      const pc = this.pc;
      function done() { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', check); resolve(); }
      function check() { if (pc.iceGatheringState === 'complete') done(); }
      pc.addEventListener('icegatheringstatechange', check);
    });
  }

  /** Hôte : produit le code d'invitation. */
  async createInvite(maxMs = 4000): Promise<string> {
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this.gather(maxMs);
    return encodeCode('o', this.pc.localDescription!.sdp);
  }

  /** Invité : lit l'invitation et produit le code de réponse. */
  async acceptInvite(code: string, maxMs = 4000): Promise<string> {
    const c = await decodeCode(code);
    if (c.kind !== 'o') throw new Error('Ce code est une réponse : il doit être collé chez l’hôte. Il vous faut le code d’invitation.');
    await this.pc.setRemoteDescription({ type: 'offer', sdp: c.sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this.gather(maxMs);
    return encodeCode('a', this.pc.localDescription!.sdp);
  }

  /** Hôte : applique la réponse de l'invité ; la connexion s'ouvre ensuite d'elle-même. */
  async acceptAnswer(code: string): Promise<void> {
    const c = await decodeCode(code);
    if (c.kind !== 'a') throw new Error('Ce code est une invitation : collez ici le code de réponse de votre adversaire.');
    await this.pc.setRemoteDescription({ type: 'answer', sdp: c.sdp });
  }

  send(m: unknown, fast = false): void {
    const ch = fast ? this.fast : this.rel;
    if (ch && ch.readyState === 'open') { try { ch.send(JSON.stringify(m)); } catch { /* tampon plein : état suivant */ } }
  }

  sendBinary(b: ArrayBuffer, fast = true): void {
    const ch = fast ? this.fast : this.rel;
    if (ch && ch.readyState === 'open' && ch.bufferedAmount < 256_000) { try { ch.send(b); } catch { /* */ } }
  }

  close(why = 'Connexion fermée.'): void {
    if (this.closed) return;
    this.closed = true; this.open = false;
    try { this.rel?.close(); this.fast?.close(); this.pc.close(); } catch { /* déjà fermé */ }
    this.onClose(why);
  }
}
