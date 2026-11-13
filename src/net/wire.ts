// Format binaire des messages fréquents (canal non fiable), pour limiter le débit de l'hôte en 4v4.
// Positions en centimètres (Int16 : ±327 m), angles quantifiés, le reste sur un octet.
//   Mise à jour d'un joueur (client -> hôte) : 18 octets
//   Instantané de la partie (hôte -> clients) : 9 octets + 17 octets par joueur

export const T_INPUT = 1, T_SNAP = 2;

export interface PlayerState { x: number; y: number; z: number; yaw: number; pitch: number; speed: number; height: number; ads: boolean; crouch: boolean }
export interface SnapPlayer extends PlayerState { idx: number; hp: number; alive: boolean; inv: boolean; firing: boolean }

const A = 32767 / Math.PI;
const cm = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v * 100)));
const ang = (v: number) => { let a = v % (Math.PI * 2); if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2; return Math.round(a * A); };

export function encodeInput(seq: number, s: PlayerState): ArrayBuffer {
  const b = new ArrayBuffer(18), v = new DataView(b);
  v.setUint8(0, T_INPUT); v.setUint16(1, seq & 0xffff);
  v.setInt16(3, cm(s.x)); v.setInt16(5, cm(s.y)); v.setInt16(7, cm(s.z));
  v.setInt16(9, ang(s.yaw)); v.setInt16(11, ang(s.pitch));
  v.setUint8(13, Math.min(255, Math.round(s.speed * 20))); v.setUint8(14, Math.min(255, Math.round(s.height * 100)));
  v.setUint8(15, (s.ads ? 1 : 0) | (s.crouch ? 2 : 0));
  return b;
}

export function decodeInput(b: ArrayBuffer): { seq: number; s: PlayerState } | null {
  if (b.byteLength < 16) return null;
  const v = new DataView(b);
  if (v.getUint8(0) !== T_INPUT) return null;
  const f = v.getUint8(15);
  return { seq: v.getUint16(1), s: { x: v.getInt16(3) / 100, y: v.getInt16(5) / 100, z: v.getInt16(7) / 100, yaw: v.getInt16(9) / A, pitch: v.getInt16(11) / A, speed: v.getUint8(13) / 20, height: v.getUint8(14) / 100, ads: !!(f & 1), crouch: !!(f & 2) } };
}

export function encodeSnap(tick: number, time: number, players: SnapPlayer[]): ArrayBuffer {
  const b = new ArrayBuffer(9 + players.length * 17), v = new DataView(b);
  v.setUint8(0, T_SNAP); v.setUint32(1, tick >>> 0); v.setFloat32(5, time);
  let o = 9;
  for (const p of players) {
    v.setUint8(o, p.idx); v.setInt16(o + 1, cm(p.x)); v.setInt16(o + 3, cm(p.y)); v.setInt16(o + 5, cm(p.z));
    v.setInt16(o + 7, ang(p.yaw)); v.setInt16(o + 9, ang(p.pitch));
    v.setUint8(o + 11, Math.min(255, Math.round(p.speed * 20))); v.setUint8(o + 12, Math.min(255, Math.round(p.height * 100)));
    v.setUint8(o + 13, Math.max(0, Math.min(255, Math.round(p.hp))));
    v.setUint8(o + 14, (p.alive ? 1 : 0) | (p.inv ? 2 : 0) | (p.ads ? 4 : 0) | (p.crouch ? 8 : 0) | (p.firing ? 16 : 0));
    v.setUint16(o + 15, 0);
    o += 17;
  }
  return b;
}

export function decodeSnap(b: ArrayBuffer): { tick: number; time: number; players: SnapPlayer[] } | null {
  if (b.byteLength < 9) return null;
  const v = new DataView(b);
  if (v.getUint8(0) !== T_SNAP) return null;
  const players: SnapPlayer[] = [];
  for (let o = 9; o + 17 <= b.byteLength; o += 17) {
    const f = v.getUint8(o + 14);
    players.push({ idx: v.getUint8(o), x: v.getInt16(o + 1) / 100, y: v.getInt16(o + 3) / 100, z: v.getInt16(o + 5) / 100, yaw: v.getInt16(o + 7) / A, pitch: v.getInt16(o + 9) / A,
      speed: v.getUint8(o + 11) / 20, height: v.getUint8(o + 12) / 100, hp: v.getUint8(o + 13), alive: !!(f & 1), inv: !!(f & 2), ads: !!(f & 4), crouch: !!(f & 8), firing: !!(f & 16) });
  }
  return { tick: v.getUint32(1), time: v.getFloat32(5), players };
}
