// Monde physique : collisions AABB, lancer de rayons, déplacement de personnages et grille de navigation A*.
import * as THREE from 'three';

export type Surface = 'concrete' | 'metal' | 'dirt' | 'crystal' | 'flesh' | 'energy';

export interface Damageable {
  takeDamage(amount: number, info: DamageInfo): void;
}

export interface DamageInfo {
  point?: THREE.Vector3;
  dir?: THREE.Vector3;
  head?: boolean;
  source: 'player' | 'enemy' | 'ally' | 'world';
  type: 'bullet' | 'fire' | 'arcane' | 'explosion' | 'melee' | 'shock';
  weaponUid?: string;
  silent?: boolean;
  legend?: string;
  skill?: string;
}

export class Collider {
  enabled = true;
  walk = true; // bloque les déplacements
  shoot = true; // bloque les balles
  see = true; // bloque la vision
  nav = true; // pris en compte par la grille de navigation
  owner: Damageable | null = null;
  constructor(
    public minX: number, public minY: number, public minZ: number,
    public maxX: number, public maxY: number, public maxZ: number,
    public surf: Surface = 'concrete',
  ) {}
}

export interface RayHit { t: number; point: THREE.Vector3; normal: THREE.Vector3; collider: Collider }

const CELL = 8;
const key = (cx: number, cz: number) => (cx + 512) * 2048 + (cz + 512);

export class World {
  colliders: Collider[] = [];
  private hash = new Map<number, Collider[]>();
  nav!: NavGrid;
  killY = -25;

  add(c: Collider): Collider {
    this.colliders.push(c);
    const x0 = Math.floor(c.minX / CELL), x1 = Math.floor(c.maxX / CELL), z0 = Math.floor(c.minZ / CELL), z1 = Math.floor(c.maxZ / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = key(x, z);
      let a = this.hash.get(k);
      if (!a) { a = []; this.hash.set(k, a); }
      a.push(c);
    }
    return c;
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, surf: Surface = 'concrete'): Collider {
    return this.add(new Collider(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, surf));
  }

  private scratch: Collider[] = [];
  private stamp = 0;
  private stamps = new WeakMap<Collider, number>();
  /** Colliders potentiellement en contact avec la zone XZ donnée. */
  query(minX: number, minZ: number, maxX: number, maxZ: number): Collider[] {
    const out = this.scratch; out.length = 0;
    this.stamp++;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL), z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const a = this.hash.get(key(x, z));
      if (!a) continue;
      for (const c of a) {
        if (!c.enabled || this.stamps.get(c) === this.stamp) continue;
        this.stamps.set(c, this.stamp);
        out.push(c);
      }
    }
    return out;
  }

  overlaps(x: number, y: number, z: number, r: number, h: number): Collider | null {
    const e = 0.001;
    for (const c of this.query(x - r, z - r, x + r, z + r)) {
      if (!c.walk) continue;
      if (x + r > c.minX + e && x - r < c.maxX - e && z + r > c.minZ + e && z - r < c.maxZ - e && y + h > c.minY + e && y < c.maxY - e) return c;
    }
    return null;
  }

  /**
   * Déplace une boîte de personnage (pieds en pos) avec glissement le long des murs et montée de marches.
   */
  moveCharacter(pos: THREE.Vector3, delta: THREE.Vector3, r: number, h: number, stepH: number, grounded: boolean): { grounded: boolean; ceil: boolean; wall: boolean } {
    const res = { grounded: false, ceil: false, wall: false };
    // subdivise les grands déplacements pour éviter de traverser les murs fins
    const dist = Math.max(Math.abs(delta.x), Math.abs(delta.z), Math.abs(delta.y));
    const steps = Math.max(1, Math.ceil(dist / 0.3));
    const sx = delta.x / steps, sy = delta.y / steps, sz = delta.z / steps;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0) {
        pos.x += sx;
        const c = this.overlaps(pos.x, pos.y, pos.z, r, h);
        if (c) {
          const up = c.maxY - pos.y;
          if ((grounded || res.grounded) && up > 0 && up <= stepH && !this.overlaps(pos.x, c.maxY + 0.002, pos.z, r, h)) pos.y = c.maxY + 0.002;
          else { pos.x -= sx; res.wall = true; }
        }
      }
      if (sz !== 0) {
        pos.z += sz;
        const c = this.overlaps(pos.x, pos.y, pos.z, r, h);
        if (c) {
          const up = c.maxY - pos.y;
          if ((grounded || res.grounded) && up > 0 && up <= stepH && !this.overlaps(pos.x, c.maxY + 0.002, pos.z, r, h)) pos.y = c.maxY + 0.002;
          else { pos.z -= sz; res.wall = true; }
        }
      }
      if (sy !== 0) {
        pos.y += sy;
        const c = this.overlaps(pos.x, pos.y, pos.z, r, h);
        if (c) {
          if (sy < 0) { pos.y = c.maxY + 0.001; res.grounded = true; } else { pos.y = c.minY - h - 0.001; res.ceil = true; }
          // sécurité : si toujours bloqué, annule
          if (this.overlaps(pos.x, pos.y, pos.z, r, h)) pos.y -= sy;
        }
      }
    }
    return res;
  }

  /** Hauteur du sol sous un point (ou -Infinity). */
  groundAt(x: number, z: number, fromY: number): number {
    let best = -Infinity;
    for (const c of this.query(x - 0.05, z - 0.05, x + 0.05, z + 0.05)) {
      if (!c.walk) continue;
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ && c.maxY <= fromY + 0.01 && c.maxY > best) best = c.maxY;
    }
    return best;
  }

  private hit: RayHit = { t: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), collider: null as any };

  /** Rayon contre les colliders. mode : propriété testée (« shoot », « see » ou « walk »). Le résultat est réutilisé : le copier si nécessaire. */
  raycast(o: THREE.Vector3, d: THREE.Vector3, maxT: number, mode: 'shoot' | 'see' | 'walk' = 'shoot'): RayHit | null {
    let best = maxT, bc: Collider | null = null, bAxis = 0, bSign = 0;
    const ix = d.x !== 0 ? 1 / d.x : Infinity, iy = d.y !== 0 ? 1 / d.y : Infinity, iz = d.z !== 0 ? 1 / d.z : Infinity;
    const cols = this.colliders;
    for (let i = 0, n = cols.length; i < n; i++) {
      const c = cols[i];
      if (!c.enabled || !c[mode]) continue;
      let t1 = (c.minX - o.x) * ix, t2 = (c.maxX - o.x) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), axis = 0;
      t1 = (c.minY - o.y) * iy; t2 = (c.maxY - o.y) * iy;
      let a = Math.min(t1, t2), b = Math.max(t1, t2);
      if (a > tmin) { tmin = a; axis = 1; }
      if (b < tmax) tmax = b;
      t1 = (c.minZ - o.z) * iz; t2 = (c.maxZ - o.z) * iz;
      a = Math.min(t1, t2); b = Math.max(t1, t2);
      if (a > tmin) { tmin = a; axis = 2; }
      if (b < tmax) tmax = b;
      if (tmax >= tmin && tmin > 0 && tmin < best) { best = tmin; bc = c; bAxis = axis; bSign = axis === 0 ? -Math.sign(d.x) : axis === 1 ? -Math.sign(d.y) : -Math.sign(d.z); }
    }
    if (!bc) return null;
    const h = this.hit;
    h.t = best; h.collider = bc;
    h.point.copy(d).multiplyScalar(best).add(o);
    h.normal.set(bAxis === 0 ? bSign : 0, bAxis === 1 ? bSign : 0, bAxis === 2 ? bSign : 0);
    return h;
  }

  private losDir = new THREE.Vector3();
  /** Ligne de vue dégagée entre deux points. */
  los(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = this.losDir.subVectors(b, a);
    const len = d.length();
    if (len < 0.01) return true;
    d.multiplyScalar(1 / len);
    return !this.raycast(a, d, len - 0.05, 'see');
  }

  buildNav(minX: number, minZ: number, maxX: number, maxZ: number, floorY = 0): void {
    this.nav = new NavGrid(this, minX, minZ, maxX, maxZ, floorY);
  }
}

/** Grille de navigation 2D (cellules de 1 m) avec recherche A*. */
export class NavGrid {
  w: number; h: number;
  blocked: Uint8Array;
  private g: Float32Array; private f: Float32Array; private from: Int32Array; private seen: Uint32Array; private closed: Uint32Array;
  private gen = 0;
  private heap: number[] = [];

  constructor(private world: World, public minX: number, public minZ: number, maxX: number, maxZ: number, public floorY: number) {
    this.w = Math.ceil(maxX - minX); this.h = Math.ceil(maxZ - minZ);
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n); this.f = new Float32Array(n); this.from = new Int32Array(n); this.seen = new Uint32Array(n); this.closed = new Uint32Array(n);
    this.rebuild();
  }

  rebuild(): void {
    const pad = 0.32;
    this.blocked.fill(0);
    for (const c of this.world.colliders) {
      if (!c.enabled || !c.walk || !c.nav) continue;
      if (c.maxY <= this.floorY + 0.4 || c.minY >= this.floorY + 1.7) continue;
      const x0 = Math.max(0, Math.floor(c.minX - pad - this.minX)), x1 = Math.min(this.w - 1, Math.floor(c.maxX + pad - this.minX));
      const z0 = Math.max(0, Math.floor(c.minZ - pad - this.minZ)), z1 = Math.min(this.h - 1, Math.floor(c.maxZ + pad - this.minZ));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.blocked[z * this.w + x] = 1;
    }
  }

  idx(x: number, z: number): number {
    const cx = Math.floor(x - this.minX), cz = Math.floor(z - this.minZ);
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return -1;
    return cz * this.w + cx;
  }

  isOpen(x: number, z: number): boolean { const i = this.idx(x, z); return i >= 0 && !this.blocked[i]; }

  center(i: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.minX + (i % this.w) + 0.5, this.floorY, this.minZ + Math.floor(i / this.w) + 0.5);
  }

  nearestOpen(x: number, z: number, maxR = 6): number {
    const cx = Math.floor(x - this.minX), cz = Math.floor(z - this.minZ);
    for (let r = 0; r <= maxR; r++) {
      let best = -1, bd = Infinity;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
        const i = nz * this.w + nx;
        if (this.blocked[i]) continue;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Vérifie qu'un segment en ligne droite ne traverse aucune cellule bloquée. */
  clearLine(x0: number, z0: number, x1: number, z1: number): boolean {
    const dx = x1 - x0, dz = z1 - z0;
    const n = Math.ceil(Math.hypot(dx, dz) / 0.4);
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0 : i / n;
      if (!this.isOpen(x0 + dx * t, z0 + dz * t)) return false;
    }
    return true;
  }

  private push(i: number): void {
    const h = this.heap; h.push(i);
    let c = h.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.f[h[p]] <= this.f[h[c]]) break;
      [h[p], h[c]] = [h[c], h[p]]; c = p;
    }
  }
  private pop(): number {
    const h = this.heap; const top = h[0]; const last = h.pop()!;
    if (h.length) {
      h[0] = last; let p = 0;
      for (;;) {
        const l = p * 2 + 1, r = l + 1; let m = p;
        if (l < h.length && this.f[h[l]] < this.f[h[m]]) m = l;
        if (r < h.length && this.f[h[r]] < this.f[h[m]]) m = r;
        if (m === p) break;
        [h[p], h[m]] = [h[m], h[p]]; p = m;
      }
    }
    return top;
  }

  /** Chemin A* lissé sous forme de points monde. Retourne null s'il n'y a pas de chemin. */
  findPath(sx: number, sz: number, tx: number, tz: number, maxIter = 5000): THREE.Vector3[] | null {
    let s = this.idx(sx, sz), t = this.idx(tx, tz);
    if (s < 0 || this.blocked[s]) s = this.nearestOpen(sx, sz);
    if (t < 0 || this.blocked[t]) t = this.nearestOpen(tx, tz);
    if (s < 0 || t < 0) return null;
    const w = this.w, h = this.h;
    this.gen++;
    const gen = this.gen;
    this.heap.length = 0;
    const tcx = t % w, tcz = Math.floor(t / w);
    const heur = (i: number) => { const dx = Math.abs((i % w) - tcx), dz = Math.abs(Math.floor(i / w) - tcz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    this.g[s] = 0; this.f[s] = heur(s); this.from[s] = -1; this.seen[s] = gen;
    this.push(s);
    let iter = 0, found = false;
    while (this.heap.length && iter++ < maxIter) {
      const cur = this.pop();
      if (cur === t) { found = true; break; }
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      const cx = cur % w, cz = Math.floor(cur / w);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const ni = nz * w + nx;
        if (this.blocked[ni] || this.closed[ni] === gen) continue;
        if (dx && dz && (this.blocked[cz * w + nx] || this.blocked[nz * w + cx])) continue;
        const ng = this.g[cur] + (dx && dz ? Math.SQRT2 : 1);
        if (this.seen[ni] !== gen || ng < this.g[ni]) {
          this.seen[ni] = gen; this.g[ni] = ng; this.f[ni] = ng + heur(ni); this.from[ni] = cur;
          this.push(ni);
        }
      }
    }
    if (!found) return null;
    const cells: number[] = [];
    for (let c = t; c !== -1; c = this.from[c]) cells.push(c);
    cells.reverse();
    // lissage : saute les points intermédiaires quand la ligne directe est libre
    const pts: THREE.Vector3[] = [];
    const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
    let anchor = 0;
    while (anchor < cells.length - 1) {
      let far = anchor + 1;
      this.center(cells[anchor], tmp);
      for (let j = Math.min(cells.length - 1, anchor + 14); j > anchor + 1; j--) {
        this.center(cells[j], tmp2);
        if (this.clearLine(tmp.x, tmp.z, tmp2.x, tmp2.z)) { far = j; break; }
      }
      pts.push(this.center(cells[far], new THREE.Vector3()));
      anchor = far;
    }
    if (!pts.length) pts.push(this.center(t, new THREE.Vector3()));
    return pts;
  }

  /** Cellule ouverte aléatoire dans un rayon autour d'un point. */
  randomOpen(x: number, z: number, rMin: number, rMax: number, out: THREE.Vector3, tries = 12): boolean {
    for (let i = 0; i < tries; i++) {
      const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (this.isOpen(px, pz)) { out.set(px, this.floorY, pz); return true; }
    }
    return false;
  }
}
