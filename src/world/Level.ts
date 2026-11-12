// Niveau : conteneur de la géométrie, des entités interactives et kit modulaire de construction.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Collider, World, type Damageable, type DamageInfo, type Surface } from './World';
import { mat, cmat, TILE, softTexture, type MatName } from '../render/Materials';
import { Assets } from '../assets/Assets';
import { detailBuilding, detailWall, detailRoof, detailGround, glowPatch, lightCone, type Theme } from './Detail';

export interface Ambience {
  skyTop: number; skyHorizon: number; fog: number; fogDensity: number;
  sun: number; sunIntensity: number; sunDir: [number, number, number];
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  rift?: boolean; // faille dans le ciel
  /** Rendu : humidité du sol, brume, rayons, occlusion, couverture nuageuse, reflets, exposition et étalonnage. */
  wet?: number; mist?: number; rays?: number; ao?: number; storm?: number; env?: number; exposure?: number;
  contrast?: number; saturation?: number; gradeShadow?: number; gradeLight?: number;
  weather?: "ash" | "rain" | "motes" | "embers";
  dust?: number; // couleur des particules d'ambiance
}

export interface Zone { minX: number; minZ: number; maxX: number; maxZ: number; light: number; fogDensity?: number; fog?: number; name?: string }

export class Interactable {
  enabled = true;
  used = false;
  hold = 0; // durée de maintien requise (0 = instantané)
  constructor(public pos: THREE.Vector3, public prompt: string, public onUse: () => void, public radius = 2.4) {}
}

export class Destructible implements Damageable {
  alive = true;
  invulnerable = false;
  maxHp: number;
  flash = 0;
  onDestroyed: (() => void) | null = null;
  onHit: ((dmg: number) => void) | null = null;
  label = '';
  playerOnly = true;
  constructor(public hp: number, public mesh: THREE.Object3D, public collider: Collider | null, public center: THREE.Vector3) {
    this.maxHp = hp;
    if (collider) collider.owner = this;
  }
  takeDamage(amount: number, info: DamageInfo): void {
    if (!this.alive || this.invulnerable) return;
    if (this.playerOnly && info.source === 'enemy') return;
    this.hp -= amount;
    this.flash = 0.12;
    this.onHit?.(amount);
    if (this.hp <= 0) this.destroy();
  }
  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.mesh.visible = false;
    if (this.collider) this.collider.enabled = false;
    this.onDestroyed?.();
  }
  revive(hp = this.maxHp): void {
    this.alive = true; this.hp = hp; this.maxHp = hp; this.mesh.visible = true;
    if (this.collider) this.collider.enabled = true;
  }
}

export class Door {
  open = false;
  private t = 0;
  private baseY: number;
  constructor(public mesh: THREE.Object3D, public collider: Collider, private h: number) { this.baseY = mesh.position.y; }
  setOpen(o: boolean): void { this.open = o; this.collider.enabled = !o; }
  update(dt: number): void {
    const target = this.open ? 1 : 0;
    this.t += Math.sign(target - this.t) * Math.min(Math.abs(target - this.t), dt * 1.6);
    this.mesh.position.y = this.baseY + this.t * (this.h - 0.15);
  }
}

export interface Pickup { kind: 'ammo' | 'health' | 'energy'; pos: THREE.Vector3; mesh: THREE.Object3D; life: number }

interface Batch { pos: number[]; nor: number[]; uv: number[]; idx: number[] }

export interface BoxOpts { collide?: boolean; walk?: boolean; shoot?: boolean; see?: boolean; nav?: boolean; surf?: Surface; noShadow?: boolean }

const SURF: Partial<Record<MatName, Surface>> = {
  metal: 'metal', darkmetal: 'metal', rust: 'metal', container_red: 'metal', container_blue: 'metal', container_green: 'metal', grate: 'metal', hazard: 'metal',
  dirt: 'dirt', ash: 'dirt', sandbag: 'dirt', fabric: 'dirt', crystal: 'crystal', crystal_red: 'crystal', black: 'metal', olive: 'metal',
};

export class Level {
  world = new World();
  root = new THREE.Group();
  interactables: Interactable[] = [];
  destructibles: Destructible[] = [];
  doors: Door[] = [];
  pickups: Pickup[] = [];
  zones: Zone[] = [];
  updaters: ((dt: number, t: number) => void)[] = [];
  spawn = new THREE.Vector3(0, 0.1, 0);
  spawnYaw = 0;
  bounds = { minX: -50, minZ: -50, maxX: 50, maxZ: 50 };
  private batches = new Map<MatName, Batch>();
  private decos = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private lightCount = 0;
  private propList: { name: string; m: THREE.Matrix4 }[] = [];
  maxLights = 8;
  /** Maillages d'ambiance (halos, cônes, taches, débris) : coupés en qualité « Bas ». */
  fxMeshes: THREE.Object3D[] = [];
  setFx(on: boolean): void { for (const m of this.fxMeshes) m.visible = on; }
  /** Direction artistique de l'habillage automatique (voir Detail.ts). */
  theme: Theme = 'military';
  /** Désactive l'habillage automatique (zones déjà détaillées à la main). */
  autoDetail = true;
  time = 0;

  constructor(public id: string, public name: string, public ambience: Ambience) {}

  // ---------- primitives ----------

  /** Boîte statique texturée (y = base). Fusionnée par matériau ; collider AABB par défaut. */
  box(m: MatName, x: number, y: number, z: number, w: number, h: number, d: number, o: BoxOpts = {}): Collider | null {
    let b = this.batches.get(m);
    if (!b) { b = { pos: [], nor: [], uv: [], idx: [] }; this.batches.set(m, b); }
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y, y1 = y + h, z0 = z - d / 2, z1 = z + d / 2;
    const s = 1 / (TILE[m] || 3);
    const face = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, dx: number, dy: number, dz: number, nx: number, ny: number, nz: number) => {
      const i = b!.pos.length / 3;
      b!.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
      for (let k = 0; k < 4; k++) b!.nor.push(nx, ny, nz);
      const uvOf = (px: number, py: number, pz: number) => (nx !== 0 ? [pz * s, py * s] : ny !== 0 ? [px * s, pz * s] : [px * s, py * s]);
      b!.uv.push(...uvOf(ax, ay, az), ...uvOf(bx, by, bz), ...uvOf(cx, cy, cz), ...uvOf(dx, dy, dz));
      b!.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    };
    face(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0);
    face(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0);
    face(x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 0, 1, 0);
    face(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0);
    face(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1);
    face(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1);
    if (o.collide === false) return null;
    const c = new Collider(x0, y0, z0, x1, y1, z1, o.surf || SURF[m] || 'concrete');
    if (o.walk === false) c.walk = false;
    if (o.shoot === false) c.shoot = false;
    if (o.see === false) c.see = false;
    if (o.nav === false) c.nav = false;
    return this.world.add(c);
  }

  /** Géométrie décorative fusionnée (sans collision). */
  deco(material: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m4);
    let a = this.decos.get(material);
    if (!a) { a = []; this.decos.set(material, a); }
    a.push(g);
  }

  collider(x: number, y: number, z: number, w: number, h: number, d: number, surf: Surface = 'concrete', o: BoxOpts = {}): Collider {
    const c = this.world.box(x, y, z, w, h, d, surf);
    if (o.walk === false) c.walk = false;
    if (o.shoot === false) c.shoot = false;
    if (o.see === false) c.see = false;
    if (o.nav === false) c.nav = false;
    return c;
  }

  /** Finalise le niveau : fusionne la géométrie et construit la navigation. */
  finish(): void {
    if (this.autoDetail) detailGround(this);
    for (const [m, b] of this.batches) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(b.idx);
      const mesh = new THREE.Mesh(g, mat(m));
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.root.add(mesh);
    }
    for (const [material, geos] of this.decos) {
      const g = mergeGeometries(geos, false);
      if (!g) continue;
      const mesh = new THREE.Mesh(g, material);
      mesh.castShadow = !(material as any).transparent; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      // halos, cônes de lumière, taches : effets d'ambiance masquables en qualité « Bas »
      if ((material as any).transparent && (material as any).depthWrite === false) this.fxMeshes.push(mesh);
      this.root.add(mesh);
      for (const x of geos) x.dispose();
    }
    this.batches.clear(); this.decos.clear();
    this.buildProps();
    const b = this.bounds;
    this.world.buildNav(b.minX, b.minZ, b.maxX, b.maxZ, 0);
  }

  update(dt: number): void {
    this.time += dt;
    for (const d of this.doors) d.update(dt);
    for (const u of this.updaters) u(dt, this.time);
    for (const d of this.destructibles) if (d.flash > 0) d.flash -= dt;
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry && !(m.geometry as any).__shared) m.geometry.dispose();
    });
    this.root.removeFromParent();
  }

  zoneAt(x: number, z: number): Zone | null {
    for (const zn of this.zones) if (x >= zn.minX && x <= zn.maxX && z >= zn.minZ && z <= zn.maxZ) return zn;
    return null;
  }

  // ---------- décors glTF instanciés (Quaternius, CC0) ----------

  /**
   * Place un décor glTF. `h` = hauteur voulue en mètres (l'échelle conserve les proportions).
   * `solid` ajoute une collision AABB (rotations par quarts de tour). Retourne false si l'asset manque.
   */
  prop(name: string, x: number, y: number, z: number, ry = 0, h = 1, solid = false, surf: Surface = 'metal'): boolean {
    const info = propInfo(name);
    if (!info) return false;
    const k = h / info.h;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y - info.min.y * k, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(k, k, k));
    this.propList.push({ name, m });
    if (solid) {
      const quarter = Math.round(ry / (Math.PI / 2)) % 2 !== 0;
      const sx = (quarter ? info.size.z : info.size.x) * k, sz = (quarter ? info.size.x : info.size.z) * k;
      const cx = ((info.min.x + info.max.x) / 2) * k, cz = ((info.min.z + info.max.z) / 2) * k;
      const c = new THREE.Vector3(cx, 0, cz).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      this.collider(x + c.x, y, z + c.z, sx * 0.9, info.h * k, sz * 0.9, surf);
    }
    return true;
  }

  /** Place un décor avec une transformation libre (pièces de kits modulaires, déjà centrées). */
  propM(name: string, m: THREE.Matrix4): boolean {
    if (!propInfo(name)) return false;
    this.propList.push({ name, m });
    return true;
  }
  propSize(name: string): THREE.Vector3 | null { return propInfo(name)?.size ?? null; }

  private buildProps(): void {
    const by = new Map<string, THREE.Matrix4[]>();
    for (const p of this.propList) { let a = by.get(p.name); if (!a) by.set(p.name, (a = [])); a.push(p.m); }
    const tmp = new THREE.Matrix4();
    for (const [name, list] of by) {
      const info = propInfo(name)!;
      if (info.skinned) {
        // modèles animés (chars) : copies complètes, le squelette est nécessaire au rendu
        for (const m of list) { const o = Assets.clone('props/' + name); if (!o) continue; m.decompose(o.position, o.quaternion, o.scale); o.traverse((n) => { n.castShadow = true; n.receiveShadow = true; }); this.root.add(o); }
        continue;
      }
      for (const part of info.parts) {
        const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        list.forEach((m, i) => im.setMatrixAt(i, tmp.multiplyMatrices(m, part.local)));
        im.castShadow = true; im.receiveShadow = true;
        im.computeBoundingSphere();
        this.root.add(im);
      }
    }
    this.propList.length = 0;
  }

  // ---------- kit modulaire ----------

  floor(m: MatName, x: number, z: number, w: number, d: number, y = 0, thick = 1): void { this.box(m, x, y - thick, z, w, thick, d, { nav: false }); }

  /** Mur axial entre deux points (x1==x2 ou z1==z2). */
  wall(m: MatName, x1: number, z1: number, x2: number, z2: number, h = 4, th = 0.5, y = 0): void {
    const w = Math.abs(x2 - x1) + th, d = Math.abs(z2 - z1) + th;
    this.box(m, (x1 + x2) / 2, y, (z1 + z2) / 2, x1 === x2 ? th : w, h, z1 === z2 ? th : d);
    if (this.autoDetail && y === 0 && (x1 === x2) !== (z1 === z2)) detailWall(this, m, x1, z1, x2, z2, h, th);
  }

  /** Mur avec une ouverture de porte ; retourne le centre de l'ouverture. */
  wallDoor(m: MatName, x1: number, z1: number, x2: number, z2: number, h: number, at: number, gap = 2.4, doorH = 2.8, th = 0.5): THREE.Vector3 {
    const alongX = z1 === z2;
    const a = alongX ? Math.min(x1, x2) : Math.min(z1, z2), b = alongX ? Math.max(x1, x2) : Math.max(z1, z2);
    const g0 = at - gap / 2, g1 = at + gap / 2;
    if (alongX) {
      if (g0 > a) this.wall(m, a, z1, g0, z1, h, th);
      if (g1 < b) this.wall(m, g1, z1, b, z1, h, th);
      this.box(m, at, doorH, z1, gap, h - doorH, th);
      return new THREE.Vector3(at, 0, z1);
    }
    if (g0 > a) this.wall(m, x1, a, x1, g0, h, th);
    if (g1 < b) this.wall(m, x1, g1, x1, b, h, th);
    this.box(m, x1, doorH, at, th, h - doorH, gap);
    return new THREE.Vector3(x1, 0, at);
  }

  /** Porte coulissante verticale (fermée par défaut). */
  door(x: number, z: number, alongX: boolean, gap = 2.4, h = 2.8, color: MatName = 'darkmetal'): Door {
    const g = new THREE.Group();
    const w = alongX ? gap : 0.3, d = alongX ? 0.3 : gap;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    panel.position.y = h / 2; panel.castShadow = true;
    g.add(panel);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(alongX ? gap * 0.8 : 0.34, 0.12, alongX ? 0.34 : gap * 0.8), mat('glow_red'));
    strip.position.y = h * 0.6; g.add(strip);
    g.position.set(x, 0, z);
    this.root.add(g);
    const c = this.collider(x, 0, z, w, h, d, 'metal');
    const door = new Door(g, c, h);
    (door as any).strip = strip;
    this.doors.push(door);
    return door;
  }

  openDoor(d: Door): void {
    d.setOpen(true);
    const strip = (d as any).strip as THREE.Mesh | undefined;
    if (strip) strip.material = mat('glow_green');
    this.world.nav?.rebuild();
  }

  /** Enceinte rectangulaire avec ouvertures. Côtés : n = zMin, s = zMax, w = xMin, e = xMax. */
  enclosure(m: MatName, x0: number, z0: number, x1: number, z1: number, h: number, openings: { side: 'n' | 's' | 'e' | 'w'; at: number; gap?: number; h?: number }[] = [], th = 0.5): void {
    const side = (sd: 'n' | 's' | 'e' | 'w') => {
      const alongX = sd === 'n' || sd === 's';
      const fixed = sd === 'n' ? z0 : sd === 's' ? z1 : sd === 'w' ? x0 : x1;
      const a = alongX ? x0 : z0, b = alongX ? x1 : z1;
      const ops = openings.filter((o) => o.side === sd).sort((p, q) => p.at - q.at);
      let cur = a;
      const seg = (from: number, to: number) => { if (to - from < 0.05) return; if (alongX) this.wall(m, from, fixed, to, fixed, h, th); else this.wall(m, fixed, from, fixed, to, h, th); };
      for (const o of ops) {
        const gap = o.gap ?? 2.4, dh = o.h ?? 2.8;
        seg(cur, o.at - gap / 2);
        if (h > dh + 0.05) { if (alongX) this.box(m, o.at, dh, fixed, gap, h - dh, th); else this.box(m, fixed, dh, o.at, th, h - dh, gap); }
        cur = o.at + gap / 2;
      }
      seg(cur, b);
    };
    side('n'); side('s'); side('e'); side('w');
  }

  roof(m: MatName, x0: number, z0: number, x1: number, z1: number, y: number, th = 0.4): void {
    this.box(m, (x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0 + 0.5, th, z1 - z0 + 0.5, { nav: false });
    if (this.autoDetail) detailRoof(this, x0, z0, x1, z1, y);
  }

  crate(x: number, z: number, s = 1.2, y = 0, m: MatName = 'crate'): void {
    this.box(m, x, y, z, s, s, s);
    // cadre : patins, couvercle cerclé, cornières
    const N = { collide: false } as BoxOpts, t: MatName = m === 'crate' ? 'wood' : 'trim';
    for (const yy of [0, s - 0.07]) this.box(t, x, y + yy, z, s + 0.05, 0.07, s + 0.05, N);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box('trim', x + sx * (s / 2 - 0.02), y, z + sz * (s / 2 - 0.02), 0.07, s, 0.07, N);
    if (m !== 'crate') { this.box('paint_yellow', x, y + s * 0.42, z, s + 0.012, s * 0.1, s + 0.012, N); }
  }

  container(x: number, z: number, alongX: boolean, color: MatName = 'container_red', y = 0): void {
    const w = alongX ? 6 : 2.4, d = alongX ? 2.4 : 6;
    this.box(color, x, y, z, w, 2.6, d);
    const N = { collide: false } as BoxOpts;
    // cadre : montants d'angle, longerons, pièces de coin
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this.box('trim', x + sx * (w / 2 - 0.04), y, z + sz * (d / 2 - 0.04), 0.16, 2.6, 0.16, N);
      for (const yy of [0, 2.48]) this.box('darkmetal', x + sx * (w / 2 - 0.02), y + yy, z + sz * (d / 2 - 0.02), 0.22, 0.14, 0.22, N);
    }
    for (const yy of [0, 2.5]) { this.box('trim', x, y + yy, z, w + 0.05, 0.12, d + 0.05, N); }
    // portes : barres de fermeture et charnières sur une extrémité
    const e = alongX ? w / 2 + 0.02 : d / 2 + 0.02;
    for (const o of [-0.75, -0.3, 0.3, 0.75]) this.box('metal', alongX ? x + e : x + o, y + 0.2, alongX ? z + o : z + e, alongX ? 0.05 : 0.05, 2.2, alongX ? 0.05 : 0.05, N);
    this.box('trim', alongX ? x + e : x, y + 0.14, alongX ? z : z + e, alongX ? 0.03 : 0.06, 2.34, alongX ? 0.06 : 0.03, N);
    for (const o of [-0.52, 0.52]) this.box('darkmetal', alongX ? x + e + 0.02 : x + o, y + 1.15, alongX ? z + o : z + e + 0.02, alongX ? 0.06 : 0.34, 0.1, alongX ? 0.34 : 0.06, N);
  }

  barrier(x: number, z: number, alongX: boolean, len = 2.4): void {
    const w = alongX ? len : 0.5, d = alongX ? 0.5 : len;
    // modèle Concrete Road Barrier (Poly Haven, CC0) : la collision garde les dimensions de couverture d'origine
    const sz = this.propSize('ph_barrier');
    if (sz) {
      this.collider(x, 0, z, w, 0.9, d, 'concrete');
      const n = Math.max(1, Math.round(len / sz.x)), seg = len / n;
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * seg, flip = (Math.round(x * 3 + z * 5) + i) % 2 ? Math.PI : 0;
        this.propM('ph_barrier', new THREE.Matrix4().compose(new THREE.Vector3(alongX ? x + o : x, 0.45, alongX ? z : z + o),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (alongX ? 0 : Math.PI / 2) + flip), new THREE.Vector3((seg / sz.x) * 0.995, 0.9 / sz.y, 1)));
      }
      return;
    }
    this.box('concrete', x, 0, z, w, 0.9, d);
    this.box('concrete', x, 0, z, alongX ? len : 0.8, 0.3, alongX ? 0.8 : len, { collide: false });
  }

  sandbags(x: number, z: number, alongX: boolean, len = 3, h = 1.0): void {
    this.collider(x, 0, z, alongX ? len : 0.7, h, alongX ? 0.7 : len, 'dirt');
    const geo = new THREE.CapsuleGeometry(0.19, 0.5, 2, 6);
    const rows = Math.round(h / 0.32);
    for (let r = 0; r < rows; r++) {
      const n = Math.floor(len / 0.85);
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 0.85 + (r % 2 ? 0.4 : 0);
        this.deco(mat('sandbag'), geo, alongX ? x + o : x, 0.17 + r * 0.32, alongX ? z : z + o, 0, alongX ? 0 : Math.PI / 2, Math.PI / 2, 1, 1, 1.5);
      }
    }
  }

  barrelDeco(x: number, z: number, m: MatName = 'rust', y = 0): void {
    this.deco(mat(m), new THREE.CylinderGeometry(0.32, 0.32, 0.95, 10), x, y + 0.475, z);
    this.collider(x, y, z, 0.6, 0.95, 0.6, 'metal');
  }

  /** Épave de véhicule. type : car | truck | apc */
  vehicle(x: number, z: number, alongX: boolean, type: 'car' | 'truck' | 'apc' = 'car', color = 0x3a4048): void {
    const L = type === 'car' ? 4.2 : type === 'truck' ? 7 : 6, W = type === 'car' ? 1.9 : 2.5, H = type === 'car' ? 0.75 : type === 'truck' ? 1.2 : 1.5;
    // peinture mate légèrement éclaircie : lisible même dans l'ombre
    const pc = new THREE.Color(color).multiplyScalar(1.5);
    const paint = cmat(pc.getHex(), 0.62, 0.2);
    const ry = alongX ? 0 : Math.PI / 2;
    const P = (lx: number, lz: number): [number, number] => (alongX ? [x + lx, z + lz] : [x + lz, z + lx]);
    const bx = (geo: THREE.BufferGeometry, m: THREE.Material, lx: number, y: number, lz: number, rz = 0) => { const [px, pz] = P(lx, lz); this.deco(m, geo, px, y, pz, 0, ry, rz); };
    const B = (m: THREE.Material, lx: number, y: number, lz: number, sx: number, sy: number, sz: number, rz = 0) => bx(new THREE.BoxGeometry(sx, sy, sz), m, lx, y + sy / 2, lz, rz);
    const dark = mat('trim'), blk = mat('black'), glass = cmat(0x0c1218, 0.08, 0.7), steel = mat('darkmetal');
    const wheels = (xs: number[], r: number, wd: number) => { for (const lx of xs) for (const s of [-1, 1]) { const [px, pz] = P(lx, s * (W / 2 - wd / 2 + 0.04)); this.deco(blk, new THREE.CylinderGeometry(r, r, wd, 14), px, r, pz, Math.PI / 2, ry, 0); this.deco(steel, new THREE.CylinderGeometry(r * 0.5, r * 0.5, wd + 0.04, 8), px, r, pz, Math.PI / 2, ry, 0); } };
    if (type === 'car') {
      B(dark, 0, 0.28, 0, L - 0.3, 0.2, W - 0.2);
      B(paint, 0, 0.42, 0, L, 0.5, W);
      B(paint, 1.25, 0.9, 0, 1.5, 0.1, W - 0.1, -0.06); B(paint, -1.55, 0.9, 0, 1.0, 0.12, W - 0.1);
      B(paint, -0.25, 0.92, 0, L * 0.5, 0.56, W * 0.86); B(glass, -0.25, 1.0, 0, L * 0.5 + 0.03, 0.36, W * 0.88);
      B(paint, -0.25, 1.46, 0, L * 0.46, 0.06, W * 0.84);
      for (const e of [1, -1]) { B(dark, e * (L / 2 + 0.04), 0.36, 0, 0.14, 0.2, W + 0.04); for (const s of [-1, 1]) B(e > 0 ? mat('paint_white') : mat('paint_red'), e * (L / 2 + 0.01), 0.66, s * (W / 2 - 0.3), 0.04, 0.14, 0.36); }
      B(blk, L / 2 + 0.012, 0.6, 0, 0.03, 0.2, 0.9);
      wheels([-L / 2 + 0.8, L / 2 - 0.85], 0.36, 0.26);
    } else if (type === 'truck') {
      B(dark, 0, 0.55, 0, L, 0.22, W * 0.5);
      B(paint, -1, 0.77, 0, L - 2, 0.2, W);
      // cabine : capot, pare-brise, calandre, pare-chocs
      B(paint, L / 2 - 0.95, 0.72, 0, 1.9, 1.05, W - 0.06); B(paint, L / 2 - 1.1, 1.77, 0, 1.6, 0.95, W - 0.1);
      B(glass, L / 2 - 0.29, 1.9, 0, 0.04, 0.62, W - 0.36); for (const s of [-1, 1]) B(glass, L / 2 - 1.1, 1.92, s * (W / 2 - 0.045), 1.0, 0.56, 0.03);
      B(blk, L / 2 + 0.012, 0.95, 0, 0.04, 0.6, W * 0.6); B(dark, L / 2 + 0.08, 0.55, 0, 0.2, 0.26, W + 0.1);
      for (const s of [-1, 1]) { B(mat('paint_white'), L / 2 + 0.02, 1.05, s * (W / 2 - 0.28), 0.04, 0.2, 0.3); B(dark, L / 2 - 1.15, 2.2, s * (W / 2 + 0.16), 0.06, 0.34, 0.2); }
      // plateau bâché : ridelles, arceaux, bâche
      B(mat('fabric'), -1, 0.97, 0, L - 2.1, 1.75, W - 0.04);
      for (let i = 0; i < 4; i++) B(dark, -L / 2 + 0.25 + (i * (L - 2.5)) / 3, 0.97, 0, 0.07, 1.8, W + 0.03);
      B(paint, -1, 0.97, W / 2, L - 2.05, 0.5, 0.05); B(paint, -1, 0.97, -W / 2, L - 2.05, 0.5, 0.05); B(paint, -L / 2, 0.97, 0, 0.05, 0.6, W);
      bx(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 10), steel, 0.6, 0.62, W / 2 - 0.2, Math.PI / 2);
      bx(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), steel, L / 2 - 2.0, 2.3, -W / 2 + 0.1);
      wheels([L / 2 - 1.0, -L / 2 + 2.1, -L / 2 + 0.95], 0.5, 0.34);
    } else {
      B(paint, 0, 0.5, 0, L, 0.8, W); B(paint, -0.2, 1.3, 0, L * 0.82, 0.56, W * 0.84);
      // glacis avant, coffres latéraux, trappes
      B(paint, L / 2 - 0.5, 1.02, 0, 1.3, 0.1, W * 0.84, -0.5); B(dark, L / 2 + 0.03, 0.62, 0, 0.08, 0.3, W * 0.8);
      for (const s of [-1, 1]) { B(steel, -0.6, 1.2, s * (W / 2 - 0.04), 2.2, 0.36, 0.2); B(mat('paint_white'), L / 2 + 0.01, 0.98, s * (W / 2 - 0.3), 0.04, 0.14, 0.26); B(dark, 0.9, 0.9, s * (W / 2 + 0.02), 0.6, 0.06, 0.1); }
      B(steel, -1.6, 1.86, 0.5, 0.7, 0.05, 0.7); B(steel, -1.6, 1.86, -0.5, 0.7, 0.05, 0.7);
      // tourelle, canon, optique, antenne
      bx(new THREE.CylinderGeometry(0.72, 0.86, 0.5, 10), paint, 0.3, 2.11, 0);
      bx(new THREE.CylinderGeometry(0.075, 0.075, 2.5, 8), steel, 1.65, 2.14, 0, Math.PI / 2); bx(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 8), blk, 2.85, 2.14, 0, Math.PI / 2);
      B(steel, 0.75, 2.36, 0.42, 0.26, 0.2, 0.26); B(blk, -1.2, 1.86, -W / 2 + 0.3, 0.03, 2.2, 0.03);
      wheels([-L / 2 + 0.75, -L / 2 + 2.25, L / 2 - 2.25, L / 2 - 0.75].sort((p, q) => p - q), 0.52, 0.4);
    }
    const totalH = type === 'car' ? 1.75 : type === 'truck' ? 3.3 : 2.6;
    this.collider(x, 0, z, alongX ? L : W, type === 'car' ? 1.2 : totalH, alongX ? W : L, 'metal');
    if (type === 'car') this.collider(x - (alongX ? 0.2 : 0), 1.2, z - (alongX ? 0 : 0.2), alongX ? L * 0.5 : W * 0.9, 0.55, alongX ? W * 0.9 : L * 0.5, 'metal');
  }

  pipe(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, r = 0.15, m: MatName = 'rust'): void {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
    const len = a.distanceTo(b);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    // tuyauterie Modular Industrial Pipes 01 (Poly Haven, CC0) : tronçons droits à brides, répétés sur la longueur
    const sz = r >= 0.09 ? this.propSize('ph_pipes#pipe02') : null; // petits diamètres : cylindres simples
    if (sz) {
      const k = (r * 2) / Math.min(sz.x, sz.z), n = Math.max(1, Math.round(len / (sz.y * k))), seg = len / n;
      const dir = b.clone().sub(a).normalize(), sc = new THREE.Vector3(k, seg / sz.y, k);
      for (let i = 0; i < n; i++) this.propM('ph_pipes#pipe02', new THREE.Matrix4().compose(a.clone().addScaledVector(dir, (i + 0.5) * seg), q, sc));
      return;
    }
    const geo = new THREE.CylinderGeometry(r, r, len, 8);
    const e = new THREE.Euler().setFromQuaternion(q);
    const mid = a.add(b).multiplyScalar(0.5);
    this.deco(mat(m), geo, mid.x, mid.y, mid.z, e.x, e.y, e.z);
  }

  /** Lampe : bloc émissif + éventuelle vraie lumière ponctuelle (nombre limité). */
  lamp(x: number, y: number, z: number, color: 'white' | 'violet' | 'blue' | 'orange' | 'green' | 'red' = 'white', real = true, intensity = 30, dist = 20): void {
    const names: Record<string, MatName> = { white: 'glow_white', violet: 'glow_violet', blue: 'glow_blue', orange: 'glow_orange', green: 'glow_green', red: 'glow_red' };
    const hex: Record<string, number> = { white: 0xffe8c8, violet: 0x8a4aff, blue: 0x3a9aff, orange: 0xff7a2a, green: 0x3aff8a, red: 0xff2a2a };
    this.deco(mat(names[color]), new THREE.BoxGeometry(0.5, 0.1, 0.5), x, y, z);
    this.deco(mat('trim'), new THREE.BoxGeometry(0.66, 0.14, 0.66), x, y + 0.1, z);
    // lumière visible dans l'air et flaque au sol
    const gy = this.world.groundAt(x, z, y - 0.4), hgt = y - gy;
    if (gy > -50 && hgt > 1.6 && hgt < 9) { lightCone(this, x, y - 0.05, z, hgt - 0.05, Math.min(hgt * 0.55, 3.2), hex[color]); glowPatch(this, x, gy + 0.025, z, Math.min(hgt * 0.9, 5), hex[color]); }
    if (real && this.lightCount < this.maxLights) {
      this.lightCount++;
      const l = new THREE.PointLight(hex[color], intensity, dist, 1.8);
      l.position.set(x, y - 0.3, z);
      this.root.add(l);
    }
  }

  crystalDeco(x: number, y: number, z: number, s = 1, m: MatName = 'crystal'): void {
    const geo = new THREE.OctahedronGeometry(0.5, 0);
    this.deco(mat(m), geo, x, y + s * 0.9, z, 0, x * 1.3, 0.1, s * 0.7, s * 1.9, s * 0.7);
    this.deco(mat(m), geo, x + s * 0.45, y + s * 0.5, z + s * 0.2, 0.3, z, 0.5, s * 0.4, s * 1.1, s * 0.4);
    this.deco(mat(m), geo, x - s * 0.4, y + s * 0.4, z - s * 0.25, -0.4, x, -0.4, s * 0.35, s * 0.9, s * 0.35);
    this.collider(x, y, z, s * 0.9, s * 1.7, s * 0.9, 'crystal');
  }

  column(x: number, z: number, h = 6, r = 0.6, m: MatName = 'stone', broken = false): void {
    const hh = broken ? h * 0.45 : h;
    this.deco(mat(m), new THREE.CylinderGeometry(r * 0.85, r, hh, 10), x, hh / 2, z);
    this.box(m, x, 0, z, r * 2.6, 0.4, r * 2.6, { collide: false });
    if (!broken) this.box(m, x, h - 0.4, z, r * 2.6, 0.4, r * 2.6, { collide: false });
    this.collider(x, 0, z, r * 1.8, hh, r * 1.8, 'concrete');
  }

  stairs(m: MatName, x: number, z: number, dir: 'x+' | 'x-' | 'z+' | 'z-', width: number, steps: number, stepH = 0.3, stepD = 0.45, y = 0): void {
    for (let i = 0; i < steps; i++) {
      const off = (i + 0.5) * stepD, h = (i + 1) * stepH;
      const px = dir === 'x+' ? x + off : dir === 'x-' ? x - off : x, pz = dir === 'z+' ? z + off : dir === 'z-' ? z - off : z;
      const along = dir[0] === 'x';
      this.box(m, px, y, pz, along ? stepD : width, h, along ? width : stepD, { nav: i > 0 });
    }
  }

  platform(m: MatName, x: number, z: number, w: number, d: number, y: number, th = 0.3, rail = true): void {
    this.box(m, x, y - th, z, w, th, d, { nav: false });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box('darkmetal', x + sx * (w / 2 - 0.15), 0, z + sz * (d / 2 - 0.15), 0.25, y - th, 0.25);
    if (rail) for (const s of [-1, 1]) this.box('darkmetal', x, y + 0.9, z + s * (d / 2 - 0.04), w, 0.08, 0.08, { collide: false });
  }

  rubble(x: number, z: number, r = 2, m: MatName = 'concrete', n = 7): void {
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, rr = r * Math.sqrt((i + 0.5) / n);
      const s = 0.35 + ((i * 37) % 10) / 14;
      this.deco(mat(m), new THREE.DodecahedronGeometry(s * 0.6, 0), x + Math.cos(a) * rr, s * 0.3, z + Math.sin(a) * rr, i, i * 2, i * 3, 1, 0.7, 1);
    }
    this.collider(x, 0, z, r * 0.9, 0.38, r * 0.9, 'concrete', { see: false, shoot: false, nav: false });
  }

  /** Immeuble de décor avec façade. */
  building(x: number, z: number, w: number, d: number, h: number, m: MatName = 'facade'): void {
    this.box(m, x, 0, z, w, h, d);
    this.box('darkconcrete', x, h, z, w + 0.4, 0.5, d + 0.4, { collide: false });
    if (this.autoDetail) detailBuilding(this, x, z, w, d, h);
  }

  /** Console / terminal. Retourne la position d'interaction. */
  terminal(x: number, z: number, facing: 'x+' | 'x-' | 'z+' | 'z-' = 'z+'): THREE.Vector3 {
    const along = facing[0] === 'z';
    this.box('darkmetal', x, 0, z, along ? 1.3 : 0.6, 1.05, along ? 0.6 : 1.3);
    const g = new THREE.Group();
    const scr = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.06), mat('screen'));
    scr.position.set(0, 1.45, 0); scr.rotation.x = -0.25;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.05), mat('black'));
    frame.position.set(0, 1.45, -0.03); frame.rotation.x = -0.25;
    g.add(scr, frame);
    g.position.set(x, 0, z);
    g.rotation.y = facing === 'z+' ? 0 : facing === 'z-' ? Math.PI : facing === 'x+' ? Math.PI / 2 : -Math.PI / 2;
    this.root.add(g);
    const off = facing === 'z+' ? [0, 1] : facing === 'z-' ? [0, -1] : facing === 'x+' ? [1, 0] : [-1, 0];
    return new THREE.Vector3(x + off[0] * 0.9, 1.2, z + off[1] * 0.9);
  }

  machine(x: number, z: number, w = 2, d = 1.4, h = 2.4, glow: MatName = 'glow_blue'): void {
    this.box('darkmetal', x, 0, z, w, h, d);
    this.box(glow, x, h * 0.55, z, w + 0.04, 0.12, d + 0.04, { collide: false });
    this.box('metal', x, h, z, w * 0.7, 0.25, d * 0.7, { collide: false });
  }

  locker(x: number, z: number, alongX: boolean, n = 3): void {
    const w = alongX ? n * 0.6 : 0.55, d = alongX ? 0.55 : n * 0.6;
    this.box('metal', x, 0, z, w, 2, d);
  }

  table(x: number, z: number, w = 2, d = 1): void {
    this.box('darkmetal', x, 0.85, z, w, 0.08, d, { collide: false });
    this.collider(x, 0, z, w, 0.93, d, 'metal');
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box('black', x + sx * (w / 2 - 0.08), 0, z + sz * (d / 2 - 0.08), 0.07, 0.85, 0.07, { collide: false });
  }

  fence(x1: number, z1: number, x2: number, z2: number, h = 2.6): void {
    const alongX = z1 === z2;
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    this.box('grate', cx, 0.1, cz, alongX ? len : 0.06, h - 0.1, alongX ? 0.06 : len, { see: false, shoot: false });
    const n = Math.max(2, Math.round(len / 3) + 1);
    for (let i = 0; i < n; i++) { const t = i / (n - 1) - 0.5; this.box('darkmetal', alongX ? cx + t * len : cx, 0, alongX ? cz : cz + t * len, 0.12, h + 0.2, 0.12, { collide: false }); }
  }

  tent(x: number, z: number, w = 5, d = 4): void {
    this.box('fabric', x, 2.4, z, w, 0.12, d, { collide: false });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box('darkmetal', x + sx * (w / 2 - 0.1), 0, z + sz * (d / 2 - 0.1), 0.1, 2.4, 0.1, { collide: false });
    this.box('fabric', x, 0, z - d / 2, w, 2.4, 0.08, { shoot: false });
  }

  deadTree(x: number, z: number, h = 5): void {
    const m = cmat(0x1c1814, 0.95, 0);
    this.deco(m, new THREE.CylinderGeometry(0.12, 0.3, h, 6), x, h / 2, z, 0, 0, 0.05);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + x;
      this.deco(m, new THREE.CylinderGeometry(0.03, 0.09, h * 0.45, 5), x + Math.cos(a) * 0.6, h * (0.55 + i * 0.1), z + Math.sin(a) * 0.6, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    }
    this.collider(x, 0, z, 0.5, h, 0.5, 'dirt');
  }

  // ---------- entités dynamiques ----------

  interact(pos: THREE.Vector3, prompt: string, onUse: () => void, radius = 2.4): Interactable {
    const it = new Interactable(pos.clone(), prompt, onUse, radius);
    this.interactables.push(it);
    return it;
  }

  /** Objet destructible générique à partir d'un maillage. */
  destructible(mesh: THREE.Object3D, hp: number, cx: number, cy: number, cz: number, w: number, h: number, d: number, surf: Surface = 'metal'): Destructible {
    mesh.position.set(cx, cy, cz);
    this.root.add(mesh);
    const c = this.collider(cx, cy, cz, w, h, d, surf, { nav: true });
    const ds = new Destructible(hp, mesh, c, new THREE.Vector3(cx, cy + h / 2, cz));
    this.destructibles.push(ds);
    return ds;
  }

  /** Conduit d'énergie destructible (pilier lumineux). */
  conduit(x: number, z: number, hp: number, color: MatName = 'glow_orange'): Destructible {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.5, 10), mat('darkmetal'));
    base.position.y = 0.25;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 10), mat(color));
    core.position.y = 1.6;
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x222428, metalness: 0.8, roughness: 0.4, wireframe: true }));
    cage.position.y = 1.6;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.6, 0.35, 10), mat('darkmetal'));
    top.position.y = 2.85;
    g.add(base, core, cage, top);
    g.traverse((o) => { o.castShadow = true; });
    const d = this.destructible(g, hp, x, 0, z, 1.3, 3, 1.3, 'metal');
    this.updaters.push((_dt, t) => { if (d.alive) core.scale.x = core.scale.z = 1 + Math.sin(t * 6 + x) * 0.08; });
    return d;
  }

  /** Cristal destructible. */
  crystal(x: number, y: number, z: number, hp: number, s = 1.3, m: MatName = 'crystal'): Destructible {
    const g = new THREE.Group();
    const geo = new THREE.OctahedronGeometry(0.5, 0);
    const a = new THREE.Mesh(geo, mat(m)); a.scale.set(s * 0.8, s * 2.2, s * 0.8); a.position.y = s * 1.1;
    const b = new THREE.Mesh(geo, mat(m)); b.scale.set(s * 0.45, s * 1.2, s * 0.45); b.position.set(s * 0.5, s * 0.6, 0.2); b.rotation.z = -0.5;
    const c = new THREE.Mesh(geo, mat(m)); c.scale.set(s * 0.4, s * 1.0, s * 0.4); c.position.set(-s * 0.45, s * 0.5, -0.2); c.rotation.z = 0.5;
    g.add(a, b, c);
    const d = this.destructible(g, hp, x, y, z, s * 1.1, s * 2.2, s * 1.1, 'crystal');
    this.updaters.push((_dt, t) => { if (d.alive) { a.rotation.y = t * 0.6; g.position.y = y + Math.sin(t * 1.5 + x) * 0.08; } });
    return d;
  }

  /** Baril explosif. L'explosion est gérée par le callback fourni par le jeu. */
  explosiveBarrel(x: number, z: number, onExplode: (pos: THREE.Vector3) => void): Destructible {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 1.0, 12), cmat(0xa02a1a, 0.5, 0.5));
    body.position.y = 0.5;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 12), mat('hazard'));
    band.position.y = 0.6;
    g.add(body, band);
    body.castShadow = true;
    const d = this.destructible(g, 30, x, 0, z, 0.66, 1.0, 0.66, 'metal');
    d.playerOnly = false;
    d.onDestroyed = () => onExplode(new THREE.Vector3(x, 0.6, z));
    return d;
  }

  /** Portail de Fracture animé. Retourne le groupe (visuel uniquement). */
  portal(x: number, y: number, z: number, r = 2.2, color = 0x8a4aff, facingX = false): THREE.Group {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.09, 8, 28), new THREE.MeshStandardMaterial({ color: 0x1a1024, emissive: color, emissiveIntensity: 2.2, roughness: 0.3 }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 28), new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, c: { value: new THREE.Color(color) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float t; uniform vec3 c; varying vec2 vUv;
        void main(){ vec2 p=vUv-0.5; float r=length(p)*2.0; float a=atan(p.y,p.x);
          float s=sin(a*5.0+r*14.0-t*3.5)*0.5+0.5; float s2=sin(a*-3.0+r*9.0-t*2.0)*0.5+0.5;
          float core=smoothstep(1.0,0.0,r); vec3 col=c*(0.35+s*0.9+s2*0.5)*core*1.6+vec3(1.0)*pow(core,6.0)*0.8;
          gl_FragColor=vec4(col, core*0.92); }`,
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    }));
    g.add(ring, disc);
    g.position.set(x, y, z);
    if (facingX) g.rotation.y = Math.PI / 2;
    this.root.add(g);
    this.updaters.push((_dt, t) => { (disc.material as THREE.ShaderMaterial).uniforms.t.value = t; ring.rotation.z = t * 0.3; });
    return g;
  }

  /** Panneau lumineux avec texte (signalétique des stations). */
  sign(text: string, x: number, y: number, z: number, facing: 'x+' | 'x-' | 'z+' | 'z-' = 'z+', color = '#4ad8ff', w = 3): void {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(6,10,16,0.85)'; ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 504, 88);
    ctx.fillStyle = color; ctx.font = 'bold 44px "Bahnschrift","Segoe UI",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 50, 480);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.1875), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, fog: false }));
    m.position.set(x, y, z);
    m.rotation.y = facing === 'z+' ? 0 : facing === 'z-' ? Math.PI : facing === 'x+' ? Math.PI / 2 : -Math.PI / 2;
    this.root.add(m);
  }

  /** Marqueur lumineux vertical (objectifs, extraction). */
  beacon(x: number, z: number, color = 0x3aff8a, h = 14): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, h, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.position.set(x, h / 2, z);
    this.root.add(m);
    this.updaters.push((_dt, t) => { m.scale.x = m.scale.z = 1 + Math.sin(t * 3) * 0.15; });
    return m;
  }

  /** Caisse de munitions interactive (visuel). */
  ammoCrate(x: number, z: number): THREE.Vector3 {
    this.box('olive', x, 0, z, 1.1, 0.6, 0.7);
    this.box('hazard', x, 0.6, z, 1.12, 0.04, 0.72, { collide: false });
    this.box('glow_orange', x, 0.3, z + 0.36, 0.3, 0.1, 0.02, { collide: false });
    return new THREE.Vector3(x, 0.6, z);
  }

  spawnPickup(kind: Pickup['kind'], pos: THREE.Vector3): void {
    const color = kind === 'ammo' ? 0xffb04a : kind === 'health' ? 0x3aff8a : 0x4ad8ff;
    const g = new THREE.Group();
    const core = new THREE.Mesh(kind === 'ammo' ? new THREE.BoxGeometry(0.3, 0.2, 0.2) : new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 2 }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(0.9);
    g.add(core, halo);
    g.position.copy(pos); g.position.y += 0.45;
    this.root.add(g);
    this.pickups.push({ kind, pos: pos.clone(), mesh: g, life: 40 });
  }
}

interface PropInfo { skinned: boolean; parts: { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4 }[]; min: THREE.Vector3; max: THREE.Vector3; size: THREE.Vector3; h: number }
const propCache = new Map<string, PropInfo | null>();
/** Géométries et matériaux d'un décor, partagés entre toutes ses instances. */
function propInfo(name: string): PropInfo | null {
  if (propCache.has(name)) return propCache.get(name)!;
  // « kit#piece » : une pièce d'un kit modulaire (Poly Haven), recentrée sur sa boîte englobante
  const [file, piece] = name.split('#');
  const g = Assets.gltf('props/' + file);
  if (!g) { propCache.set(name, null); return null; }
  g.scene.updateMatrixWorld(true);
  let scene: THREE.Object3D = g.scene;
  if (piece) {
    let found: THREE.Object3D | null = null;
    g.scene.traverse((o) => { if (!found && o.name.endsWith(piece)) found = o; });
    if (!found) { propCache.set(name, null); return null; }
    scene = found;
  }
  const parts: PropInfo['parts'] = [];
  let skinned = false;
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mt of mats) {
      const ms = mt as THREE.MeshStandardMaterial;
      // aplats Quaternius : légère rugosité/métal pour réagir à l'éclairage d'environnement
      if (ms.isMeshStandardMaterial && !ms.userData.wbTuned && !ms.map) { ms.roughness = Math.min(ms.roughness, 0.85); ms.userData.wbTuned = true; }
      // verre à transmission : il ferait redessiner toute la scène une seconde fois ; simple transparence à la place
      const mp = mt as THREE.MeshPhysicalMaterial;
      if (mp.isMeshPhysicalMaterial && mp.transmission > 0) { mp.transmission = 0; mp.transparent = true; mp.opacity = 0.35; mp.depthWrite = false; }
      // tôle photogrammétrique : métal atténué, sinon elle ne reflète que le plafond sombre en intérieur
      if (ms.isMeshStandardMaterial && !ms.userData.wbTuned && ms.metalnessMap) { ms.metalness = 0.45; ms.userData.wbTuned = true; }
    }
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
    if (Array.isArray(m.material)) {
      m.geometry.groups.forEach((gr, gi) => {
        const sub = m.geometry.clone(); sub.clearGroups(); sub.setDrawRange(gr.start, gr.count);
        parts.push({ geometry: sub, material: (m.material as THREE.Material[])[gr.materialIndex ?? gi], local: m.matrixWorld.clone() });
      });
    } else parts.push({ geometry: m.geometry, material: m.material, local: m.matrixWorld.clone() });
  });
  // boîte calculée exactement comme le rendu instancié (géométrie × matrice locale de chaque partie)
  const box = new THREE.Box3(), pb = new THREE.Box3();
  for (const p of parts) { if (!p.geometry.boundingBox) p.geometry.computeBoundingBox(); pb.copy(p.geometry.boundingBox!).applyMatrix4(p.local); box.union(pb); }
  if (skinned) { box.setFromObject(scene); }
  if (piece) {
    const c = box.getCenter(new THREE.Vector3()), t = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z);
    for (const p of parts) p.local.premultiply(t);
    box.translate(c.negate());
  }
  const info: PropInfo = { skinned, parts, min: box.min.clone(), max: box.max.clone(), size: box.getSize(new THREE.Vector3()), h: Math.max(0.01, box.max.y - box.min.y) };
  propCache.set(name, info);
  return info;
}
