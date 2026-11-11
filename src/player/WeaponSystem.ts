// Système d'armes en vue subjective : viewmodel animé, tir hitscan, recul, dispersion, munitions, visée ADS.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { weaponStats, equippedItem, type WStats } from '../rpg/Stats';
import { buildWeaponModel, type WeaponModel } from './WeaponModels';
import { softTexture } from '../render/Materials';

export interface WeaponState { st: WStats; ammo: number; reserve: number; model: WeaponModel; hits: number; shots: number }

const VM_SCALE = 0.78;
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _e = new THREE.Euler();

export class WeaponSystem {
  slots: WeaponState[] = [];
  cur = 0;
  root = new THREE.Group();
  adsK = 0; zoomNow = 1; mobility = 1; spreadNow = 1; scopeOverlay = false;
  reloading = 0; reloadDur = 1; private reloadStage = 0;
  private swapT = 0; private swapTo = -1; private lowerT = 0;
  private fireT = 0; private bloom = 0; private sprintOut = 0;
  private kickZ = 0; private kickR = 0; private swayX = 0; private swayY = 0; private sprintK = 0; private boltT = 0;
  private flash: THREE.Group; private flashT = 0;
  private burstHeld = false;
  private pose = new THREE.Vector3(); private rot = new THREE.Vector3();

  constructor(private g: Game) {
    g.r.vmScene.add(this.root);
    this.flash = new THREE.Group();
    const fm = new THREE.MeshBasicMaterial({ map: softTexture(), color: 0xffc070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), fm);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.1), fm); p2.rotation.y = Math.PI / 2;
    const p3 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.1), fm); p3.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    this.flash.add(p1, p2, p3);
    this.flash.visible = false;
  }

  get w(): WeaponState { return this.slots[this.cur]; }

  /** Reconstruit les armes depuis l'équipement du profil. keepAmmo conserve les munitions en cours. */
  rebuild(keepAmmo = false): void {
    const p = this.g.profile!;
    const old = this.slots;
    for (const s of old) s.model.group.removeFromParent();
    this.slots = [];
    (['primary', 'secondary'] as const).forEach((slot, i) => {
      const item = equippedItem(p, slot);
      if (!item) return;
      const st = weaponStats(item, this.g.player.mods, p.classId);
      const model = buildWeaponModel(st.def, item.attach || {});
      model.group.visible = false;
      model.group.scale.setScalar(VM_SCALE);
      this.root.add(model.group);
      const prev = keepAmmo ? old.find((o) => o.st.item.uid === item.uid) : null;
      this.slots[i] = { st, ammo: prev ? Math.min(prev.ammo, st.mag) : st.mag, reserve: prev ? prev.reserve : st.def.reserve, model, hits: 0, shots: 0 };
    });
    this.cur = Math.min(this.cur, this.slots.length - 1);
    if (this.cur < 0) this.cur = 0;
    this.reloading = 0; this.swapT = 0; this.swapTo = -1; this.adsK = 0; this.fireT = 0;
    this.attachFlash();
    this.updateVisibility();
  }

  private attachFlash(): void { if (this.w) this.w.model.muzzle.add(this.flash); }
  private updateVisibility(): void { this.slots.forEach((s, i) => { s.model.group.visible = i === this.cur; }); }

  refill(frac = 1): void { for (const s of this.slots) s.reserve = Math.min(s.st.def.reserve, s.reserve + Math.ceil(s.st.def.reserve * frac)); }
  addMags(n: number): void { for (const s of this.slots) s.reserve = Math.min(s.st.def.reserve, s.reserve + s.st.mag * n); }
  lower(t: number): void { this.lowerT = Math.max(this.lowerT, t); }

  switchTo(i: number): void {
    if (i === this.cur || !this.slots[i] || this.swapT > 0) return;
    this.swapTo = i; this.swapT = 0.4; this.reloading = 0;
    this.g.audio.swap();
  }

  startReload(): void {
    const w = this.w; const p = this.g.player;
    if (!w || this.reloading > 0 || this.swapT > 0 || w.ammo >= w.st.mag || w.reserve <= 0 || p.has('colossus')) return;
    this.reloadDur = w.st.reload;
    this.reloading = this.reloadDur; this.reloadStage = 0;
  }

  private finishReload(): void {
    const w = this.w;
    const need = w.st.mag - w.ammo, take = Math.min(need, w.reserve);
    w.ammo += take; w.reserve -= take;
  }

  /** Recharge instantanément l'arme courante (talents). */
  instantReload(): void { const w = this.w; if (!w) return; this.reloading = 0; w.ammo = w.st.mag; }

  update(dt: number): void {
    const g = this.g, p = g.player, inp = g.input, w = this.w;
    if (!w) return;
    const playing = g.canAct;
    // changement d'arme
    if (playing) {
      if (inp.pressed('weapon1')) this.switchTo(0);
      if (inp.pressed('weapon2')) this.switchTo(1);
      if (inp.wheel !== 0 && this.slots.length > 1) this.switchTo((this.cur + 1) % this.slots.length);
      if (inp.pressed('reload')) this.startReload();
    }
    if (this.swapT > 0) {
      this.swapT -= dt;
      if (this.swapTo >= 0 && this.swapT <= 0.2) { this.cur = this.swapTo; this.swapTo = -1; this.attachFlash(); this.updateVisibility(); g.ui.hud.weaponChanged(); }
    }
    const cw = this.w, st = cw.st;
    this.mobility = st.mobility;
    if (this.lowerT > 0) this.lowerT -= dt;
    if (this.fireT > 0) this.fireT -= dt;
    if (this.boltT > 0) this.boltT -= dt;
    // sortie de sprint
    const so = p.tactical ? 0.28 : 0.17;
    if (p.sprinting) this.sprintOut = so; else if (this.sprintOut > 0) this.sprintOut -= dt;
    // rechargement
    if (this.reloading > 0) {
      const before = 1 - this.reloading / this.reloadDur;
      this.reloading -= dt;
      const k = 1 - Math.max(0, this.reloading) / this.reloadDur;
      if (before < 0.12 && k >= 0.12) g.audio.reload(0);
      if (before < 0.62 && k >= 0.62) g.audio.reload(1);
      if (before < 0.88 && k >= 0.88) g.audio.reload(2);
      if (this.reloading <= 0) { this.reloading = 0; this.finishReload(); }
    }
    // visée
    const wantAds = playing && inp.ads && this.reloading <= 0 && this.swapT <= 0 && !p.sprinting && this.lowerT <= 0 && !p.dead;
    const adsSpeed = 1 / Math.max(0.08, st.adsTime);
    this.adsK += Math.sign((wantAds ? 1 : 0) - this.adsK) * Math.min(Math.abs((wantAds ? 1 : 0) - this.adsK), adsSpeed * dt);
    const ease = this.adsK * this.adsK * (3 - 2 * this.adsK);
    this.zoomNow = 1 + (st.adsZoom - 1) * ease;
    this.scopeOverlay = st.scoped && this.adsK > 0.85;
    // dispersion
    this.bloom = Math.max(0, this.bloom - dt * 5);
    let spread = st.hipSpread * (1 - ease) + st.adsSpread * ease;
    const moveK = Math.min(1, p.speedNow / 5.5);
    spread *= 1 + moveK * (0.5 * (1 - ease) + 0.5);
    if (!p.grounded) spread = spread * 2 + 1.2;
    if (p.sliding) spread *= 1.25;
    if (p.crouching && !p.sliding) spread *= 0.75;
    if (this.sprintOut > 0) spread += 1.5;
    spread += this.bloom * (1 - ease * 0.75);
    this.spreadNow = spread;

    // tir
    if (playing && !p.dead) {
      const trigger = st.def.auto ? inp.fire : inp.firePressed || (this.burstHeld && false);
      if (trigger && this.fireT <= 0 && this.reloading <= 0 && this.swapT <= 0 && this.lowerT <= 0) {
        if (p.sprinting) { p.noSprintT = 0.35; }
        else if (this.sprintOut <= 0) {
          if (cw.ammo > 0 || p.has('colossus')) this.fire(cw, spread);
          else { if (inp.firePressed) g.audio.dry(); if (cw.reserve > 0) this.startReload(); else if (inp.firePressed) g.ui.hud.toast('PLUS DE MUNITIONS', '#ff5a4a'); }
        }
      }
      if (cw.ammo === 0 && cw.reserve > 0 && this.reloading <= 0 && this.fireT <= 0 && !p.has('colossus')) this.startReload();
    }
    this.animate(dt, ease);
  }

  private fire(w: WeaponState, spread: number): void {
    const g = this.g, p = g.player, st = w.st, cam = g.r.camera;
    let rpm = st.rpm;
    if (p.has('inferno')) rpm *= 1.35;
    this.fireT = 60 / rpm;
    const free = p.has('inferno') || p.has('colossus') || (st.legend === 'bottomless' && Math.random() < 0.25);
    if (!free) w.ammo--;
    w.shots++;
    p.lastShot = g.time;
    p.noSprintT = 0.25;
    if (g.mission) g.mission.stats.shots++;
    g.profile!.stats.shots++;
    // direction avec dispersion
    cam.getWorldDirection(_d);
    _o.copy(cam.position);
    const sr = THREE.MathUtils.degToRad(spread) * Math.sqrt(Math.random()), sa = Math.random() * Math.PI * 2;
    _r.crossVectors(_d, _u.set(0, 1, 0)).normalize();
    _u.crossVectors(_r, _d);
    _d.addScaledVector(_r, Math.cos(sa) * Math.tan(sr)).addScaledVector(_u, Math.sin(sa) * Math.tan(sr)).normalize();

    // bonus de dégâts
    let mult = 1 + p.mod('dmg');
    let cloakShot = false;
    if (p.has('cloak')) { mult *= 2 + p.mod('cloakDmg'); p.clearBuff('cloak'); p.cloaked = false; cloakShot = true; g.ui.hud.toast('EMBUSCADE', '#c08aff'); }
    if (p.has('ember')) mult *= 1.1;
    if (p.has('overcharge')) mult *= 1.3;
    if (p.has('adrenaline')) mult *= 1 + p.mod('pulseDmg');
    if (p.has('slidecharge')) mult *= 1.3;
    if (p.killStacks > 0) mult *= 1 + 0.04 * p.killStacks;
    if (p.legends.has('overflow') && p.energy >= p.maxEnergy - 0.5) mult *= 1.12;
    if (p.has('fortressIn')) mult *= 1 + p.mod('fortressDmg');

    const hit = g.combat.playerHitscan(_o, _d, 300);
    // origine visuelle du traceur : la bouche du canon
    w.model.muzzle.getWorldPosition(_m);
    _m.applyMatrix4(cam.matrixWorld);
    const end = hit ? hit.point : _r.copy(_o).addScaledVector(_d, 120);
    const tcol = p.has('ember') || p.has('inferno') ? 0xff7a2a : p.has('overcharge') ? 0x6ad8ff : cloakShot ? 0xc08aff : 0xffe2a8;
    if (this.adsK < 0.9 || !st.scoped) g.fx.tracer(_m, end, tcol, st.def.family === 'sniper' ? 0.05 : 0.022, st.def.family === 'sniper' ? 0.16 : 0.06);
    else g.fx.tracer(_r.copy(_o).addScaledVector(_d, 2), end, tcol, 0.05, 0.16);

    if (hit) {
      if (hit.enemy) {
        const dist = hit.t;
        const fall = dist <= st.rangeStart ? 1 : dist >= st.rangeEnd ? st.minDmg : 1 - (1 - st.minDmg) * ((dist - st.rangeStart) / (st.rangeEnd - st.rangeStart));
        let dmg = st.damage * fall * mult;
        if (hit.head) { dmg *= st.headMult * (1 + p.mod('headDmg') + (p.has('hunt') ? 0.5 : 0)); }
        w.hits++;
        if (g.mission) { g.mission.stats.hits++; if (hit.head) g.mission.stats.headshots++; }
        g.profile!.stats.hits++; if (hit.head) g.profile!.stats.headshots++;
        const e = hit.enemy;
        const dealt = e.takeDamage(dmg, { source: 'player', type: 'bullet', head: hit.head, point: hit.point, dir: _d, weaponUid: st.item.uid, legend: st.legend, silent: st.silent });
        if (dealt >= 0) {
          if (p.has('ember') || p.has('inferno') || (st.burn && Math.random() < st.burn)) e.applyBurn(10 * (1 + p.mod('burnDmg')) * (1 + p.mod('skillPower')), 3);
          if (p.has('overcharge') && w.hits % 4 === 0) g.combat.chain(e, 22 * (1 + p.mod('skillPower')), 2, 8, 0x6ad8ff);
          if (st.chain && w.hits % st.chain === 0) g.combat.chain(e, 28, 3, 8, 0x6ad8ff);
          if (st.legend === 'voltaic' && w.hits % 6 === 0) g.combat.chain(e, 35, 3, 9, 0xb0e8ff);
          if (st.energyOnHit) p.addEnergy(st.energyOnHit);
        }
      } else if (hit.collider) {
        const surf = hit.collider.surf;
        g.fx.impact(hit.point, hit.normal!, surf);
        g.audio.impact(surf, hit.point);
        if (hit.collider.owner) {
          hit.collider.owner.takeDamage(st.damage * mult, { source: 'player', type: 'bullet', point: hit.point, dir: _d });
          g.ui.hud.hitmarker(false, false);
          g.audio.hitmarker(false, false);
        }
      }
    }
    // bruit : alerte les ennemis
    g.combat.noise(p.pos, st.silent ? 7 : 55);

    // recul réel + visuel
    let rv = st.recoilV, rh = st.recoilH;
    const ease = this.adsK;
    rv *= 1 - ease * 0.25;
    if (p.crouching) { rv *= 0.85; rh *= 0.85; }
    if (p.has('colossus')) { rv *= 0.35; rh *= 0.35; }
    if (st.def.id === 'bastion') { const k = Math.max(0.45, 1 - w.shots * 0.0 - this.bloom * 0.25); rv *= k; }
    p.kick(rv, (Math.random() * 2 - 1) * rh);
    this.bloom = Math.min(3.2, this.bloom + (st.def.auto ? 0.42 : 1.2) * (st.hipSpread / 2.4));
    this.kickZ += 0.028 + st.recoilV * 0.016;
    this.kickR += 0.018 + st.recoilV * 0.012;
    if (!g.settings.reduceMotion) p.shakeAmt = Math.min(0.5, p.shakeAmt + st.recoilV * 0.035);
    if (st.def.id === 'frostbite') this.boltT = 0.95;
    // flash de bouche
    this.flash.visible = true; this.flashT = st.silent ? 0.025 : 0.045;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar((st.silent ? 0.35 : 0.8 + st.recoilV * 0.25) * (0.8 + Math.random() * 0.5));
    if (!st.silent) g.fx.flash(_r.copy(_o).addScaledVector(_d, 0.8), tcol, 16, 0.05, 12);
    g.audio.gunshot(st.def.sound, st.silent);
    g.ui.hud.fired();
  }

  private animate(dt: number, ease: number): void {
    const g = this.g, p = g.player, w = this.w, st = w.st;
    const pistol = st.def.family === 'pistol';
    const reduce = g.settings.reduceMotion;
    // ressorts de recul
    this.kickZ += (0 - this.kickZ) * Math.min(1, dt * 16);
    this.kickR += (0 - this.kickR) * Math.min(1, dt * 14);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    // balancement
    const tx = THREE.MathUtils.clamp(-g.input.mouseDX * 0.0006, -0.03, 0.03), ty = THREE.MathUtils.clamp(g.input.mouseDY * 0.0006, -0.03, 0.03);
    this.swayX += (tx - this.swayX) * Math.min(1, dt * 8); this.swayY += (ty - this.swayY) * Math.min(1, dt * 8);
    const sprintT = p.sprinting && this.reloading <= 0 ? 1 : 0;
    this.sprintK += (sprintT - this.sprintK) * Math.min(1, dt * 10);

    const hipX = pistol ? 0.15 : 0.18, hipY = pistol ? -0.16 : -0.19, hipZ = pistol ? -0.42 : -0.4;
    const adsY = -w.model.sightY * VM_SCALE, adsZ = pistol ? -0.36 : -0.26;
    const pos = this.pose.set(hipX + (0 - hipX) * ease, hipY + (adsY - hipY) * ease, hipZ + (adsZ - hipZ) * ease);
    const rot = this.rot.set(0, 0, 0);
    const bobK = (reduce ? 0.3 : 1) * p.bobLevel * (1 - ease * 0.85);
    pos.x += Math.cos(p.bobPhase) * 0.007 * bobK + this.swayX * (1 - ease * 0.7);
    pos.y += Math.sin(p.bobPhase * 2) * 0.006 * bobK + this.swayY * (1 - ease * 0.7) - THREE.MathUtils.clamp(p.vel.y * 0.004, -0.03, 0.03) - p.landDip * 0.12;
    rot.z += this.swayX * 1.5; rot.y += this.swayX * 0.8; rot.x += this.swayY * 0.8;
    // sprint : arme inclinée, ou levée en sprint tactique
    if (this.sprintK > 0.001) {
      const k = this.sprintK, tac = p.tactical ? 1 : 0;
      pos.x += -0.05 * k; pos.y += (tac ? 0.05 : -0.05) * k; pos.z += 0.05 * k;
      rot.y += (tac ? 0.25 : 0.65) * k; rot.x += (tac ? 0.95 : -0.22) * k; rot.z += (tac ? -0.3 : 0.12) * k;
      pos.y += Math.sin(p.bobPhase * 2) * 0.014 * k; pos.x += Math.cos(p.bobPhase) * 0.02 * k;
    }
    if (p.sliding) { rot.z += 0.32; pos.y -= 0.03; pos.x += 0.02; }
    // recul visuel
    pos.z += this.kickZ * (1 - ease * 0.35); rot.x += this.kickR * (1 - ease * 0.5); pos.y += this.kickR * 0.04;
    // rechargement
    if (w.model.mag) w.model.mag.visible = true;
    if (this.reloading > 0) {
      const k = 1 - this.reloading / this.reloadDur;
      const inK = Math.min(1, k / 0.15), outK = Math.min(1, (1 - k) / 0.14);
      const a = Math.min(inK, outK);
      pos.y -= 0.05 * a; pos.x -= 0.02 * a; rot.z += 0.55 * a; rot.x += 0.35 * a; rot.y -= 0.2 * a;
      if (w.model.mag) w.model.mag.visible = !(k > 0.2 && k < 0.6);
      if (k > 0.6 && k < 0.7) pos.y += 0.012;
      if (k > 0.86 && k < 0.94) pos.z += 0.02;
    }
    // culasse (fusil à verrou)
    if (this.boltT > 0 && this.reloading <= 0) {
      const k = 1 - this.boltT / 0.95;
      const a = Math.sin(Math.min(1, Math.max(0, (k - 0.2) / 0.7)) * Math.PI);
      rot.z -= 0.35 * a * (1 - ease * 0.6); pos.y -= 0.03 * a * (1 - ease * 0.6); pos.x += 0.02 * a;
      if (k > 0.35 && k - dt / 0.95 <= 0.35) g.audio.reload(0);
      if (k > 0.7 && k - dt / 0.95 <= 0.7) g.audio.reload(2);
    }
    // changement d'arme / abaissement
    let low = 0;
    if (this.swapT > 0) low = this.swapT > 0.2 ? 1 - (this.swapT - 0.2) / 0.2 : this.swapT / 0.2;
    if (this.lowerT > 0) low = Math.max(low, Math.min(1, this.lowerT / 0.12));
    if (p.dead) low = 1;
    pos.y -= 0.28 * low; rot.x -= 0.7 * low;
    const m = w.model.group;
    m.position.copy(pos);
    _e.set(rot.x, rot.y, rot.z, 'YXZ');
    m.quaternion.setFromEuler(_e);
    // lunette : masque l'arme quand la surimpression est affichée
    m.visible = !this.scopeOverlay;
    this.g.r.drawVm = true;
  }
}
