// Rendu : scène principale, scène d'arme (viewmodel), post-traitement, ciel, éclairage et préréglages de qualité.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { ATMOSPHERE_SHADER, GRADE_SHADER, SANITIZE_SHADER, SKY_FRAGMENT } from './PostFX';
import type { Ambience } from '../world/Level';
import type { Settings } from '../save/Save';
import { SURFACE, setSurfaceDetail } from './Materials';
import { Weather } from './Weather';

/**
 * Interrupteurs de diagnostic graphique, par l'adresse : ?fx=off (aucun post-traitement) ou une liste parmi
 * noatmo, nobloom, nograde, nomsaa, noenv, nosurf, noweather (ex. ?fx=nobloom,noatmo). Sans effet en usage normal.
 */
export const DIAG: Set<string> = new Set((typeof location !== 'undefined' ? new URLSearchParams(location.search).get('fx') || '' : '').split(',').filter(Boolean));

export class Renderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(100, 1, 0.08, 600);
  vmScene = new THREE.Scene();
  vmCamera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
  sun = new THREE.DirectionalLight(0xffffff, 2);
  hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
  vmHemi = new THREE.HemisphereLight(0xffffff, 0x333340, 1.3);
  vmSun = new THREE.DirectionalLight(0xffffff, 1.6);
  /** Contre-jour sur l'arme : détache la silhouette du décor. */
  vmRim = new THREE.DirectionalLight(0xffffff, 1.2);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private quality: Settings['quality'] = 'medium';
  private scale = 1;
  private sunOffset = new THREE.Vector3(30, 50, 20);
  private pmrem: THREE.PMREMGenerator;
  private envScene = new THREE.Scene();
  private envRT: THREE.WebGLRenderTarget | null = null;
  private atmo: ShaderPass | null = null;
  private grade: ShaderPass | null = null;
  private amb: Ambience | null = null;
  private indoorSky = new THREE.Color(0xc4d0dc); private indoorGround = new THREE.Color(0x77736c);
  private weather = new Weather(this.scene);
  private envBase = 0.5;
  private baseHemi = 1; private baseSun = 2; private zoneLight = 1; private zoneTarget = 1;
  private fogBase = 0.012; private fogTarget = 0.012;
  drawVm = true;
  info = { calls: 0, tris: 0 };

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;

    this.scene.fog = new THREE.FogExp2(0x202630, 0.012);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;

    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(0x101828) }, hor: { value: new THREE.Color(0x404858) }, rift: { value: 0 }, t: { value: 0 }, storm: { value: 0 }, envMode: { value: 0 }, sunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3) }, sunCol: { value: new THREE.Color(0xffffff) } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    // environnement de réflexion : capturé depuis le ciel de chaque niveau (voir bakeEnvironment)
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this.skyMat));
    this.vmScene.add(this.vmHemi, this.vmSun, this.vmRim);
    this.vmSun.position.set(0.6, 1.2, 0.8);
    this.vmRim.position.set(-0.7, 0.9, -1);
    this.scene.add(this.camera);
    window.addEventListener('resize', () => this.resize());
  }

  applySettings(s: Settings): void {
    const changed = s.quality !== this.quality || s.renderScale !== this.scale || (!this.composer && s.quality !== 'low');
    this.quality = s.quality; this.scale = s.renderScale;
    const q = s.quality;
    setSurfaceDetail(q !== 'low' && !DIAG.has('nosurf'));
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) { this.sun.shadow.mapSize.set(size, size); this.sun.shadow.map?.dispose(); (this.sun.shadow as any).map = null; }
    const ext = q === 'high' ? 55 : 38;
    const cam = this.sun.shadow.camera;
    cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext; cam.near = 1; cam.far = 160;
    cam.updateProjectionMatrix();
    if (changed) { this.buildComposer(); if (this.amb) this.weather.set(DIAG.has('noweather') ? undefined : this.amb.weather, q === 'low' ? 0.4 : q === 'high' ? 1 : 0.7); }
    this.resize();
  }

  private buildComposer(): void {
    this.composer?.dispose();
    this.composer = null; this.bloom = null; this.atmo = null; this.grade = null;
    if (this.quality === 'low' || DIAG.has('off')) return;
    const D = DIAG;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const depth = new THREE.DepthTexture(size.x, size.y);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: D.has('nomsaa') ? 0 : this.quality === 'high' ? 4 : 2, depthTexture: depth });
    const comp = new EffectComposer(this.renderer, rt);
    comp.addPass(new RenderPass(this.scene, this.camera));
    if (!D.has('noatmo')) {
      // atmosphère : occlusion ambiante, rayons du soleil et brume au sol, calculés depuis la profondeur de la scène
      const atmo = new ShaderPass(ATMOSPHERE_SHADER);
      atmo.material.defines.AO_TAPS = this.quality === 'high' ? 12 : 8;
      atmo.material.defines.RAY_TAPS = this.quality === 'high' ? 28 : 18;
      const self = this;
      atmo.render = function (renderer, writeBuffer, readBuffer, dt, mask) {
        this.uniforms.tDepth.value = readBuffer.depthTexture;
        self.updateAtmosphere(this.uniforms);
        ShaderPass.prototype.render.call(this, renderer, writeBuffer, readBuffer, dt, mask);
      };
      comp.addPass(atmo); this.atmo = atmo;
    }
    const vm = new RenderPass(this.vmScene, this.vmCamera);
    vm.clear = false; vm.clearDepth = true;
    comp.addPass(vm);
    this.vmPass = vm;
    // aucune valeur invalide ou infinie ne doit atteindre le bloom (voir SANITIZE_SHADER)
    comp.addPass(new ShaderPass(SANITIZE_SHADER));
    if (!D.has('nobloom')) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), this.quality === 'high' ? 0.34 : 0.3, 0.55, 1.0);
      comp.addPass(this.bloom);
    }
    comp.addPass(new OutputPass());
    if (!D.has('nograde')) { this.grade = new ShaderPass(GRADE_SHADER); comp.addPass(this.grade); }
    this.composer = comp;
    if (this.amb) this.applyGrade(this.amb);
  }

  private updateAtmosphere(u: Record<string, THREE.IUniform>): void {
    const cam = this.camera;
    u.projInv.value.copy(cam.projectionMatrixInverse);
    u.camWorld.value.copy(cam.matrixWorld);
    u.near.value = cam.near; u.far.value = cam.far; u.aspect.value = cam.aspect; u.projScale.value = cam.projectionMatrix.elements[5] * 0.5;
    const d = this.tmpV.copy(this.sunOffset).normalize();
    const sv = this.tmpV2.copy(d).transformDirection(cam.matrixWorldInverse);
    u.sunView.value.copy(sv);
    const p = this.tmpV3.copy(d).multiplyScalar(400).add(cam.position).project(cam);
    u.sunUV.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
    // les rayons s'estompent quand le soleil sort largement de l'écran ou passe derrière la caméra
    const off = Math.max(Math.abs(p.x), Math.abs(p.y));
    u.sunVis.value = sv.z < 0 ? Math.max(0, Math.min(1, (2.2 - off) / 1.2)) * this.zoneLight : 0;
    u.zone.value = this.zoneLight;
    u.time.value = this.skyMat.uniforms.t.value;
  }
  private tmpV = new THREE.Vector3(); private tmpV2 = new THREE.Vector3(); private tmpV3 = new THREE.Vector3();

  private applyGrade(a: Ambience): void {
    if (this.atmo) {
      const u = this.atmo.uniforms;
      u.sunCol.value.setHex(a.sun).multiplyScalar(a.rays ?? 0.55);
      // brume : entre la couleur du brouillard et celle de l'horizon, pour rester lumineuse
      u.fogCol.value.setHex(a.fog).lerp(new THREE.Color(a.skyHorizon), 0.45);
      u.mist.value = a.mist ?? 0.35;
      u.aoStr.value = a.ao ?? 1;
    }
    if (this.grade) {
      const u = this.grade.uniforms;
      u.shadowTint.value.setHex(a.gradeShadow ?? 0x8496b0);
      u.lightTint.value.setHex(a.gradeLight ?? 0xfff0dc);
      u.contrast.value = a.contrast ?? 1.08; u.saturation.value = a.saturation ?? 0.9;
    }
  }

  /** Capture le ciel du niveau dans une carte d'environnement : les reflets (sol mouillé, métal, arme) suivent l'ambiance. */
  private bakeEnvironment(): void {
    const old = this.envRT;
    const rt = this.renderer.getRenderTarget();
    this.skyMat.uniforms.envMode.value = 1;
    this.envRT = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 100);
    this.skyMat.uniforms.envMode.value = 0;
    this.renderer.setRenderTarget(rt);
    if (DIAG.has('noenv')) { this.scene.environment = null; this.vmScene.environment = null; } else { this.scene.environment = this.envRT.texture; this.vmScene.environment = this.envRT.texture; }
    old?.dispose();
  }

  private vmPass: RenderPass | null = null;

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2) * this.scale * (this.quality === 'low' ? 0.85 : 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = w / h; this.vmCamera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
  }

  setAmbience(a: Ambience): void {
    this.skyMat.uniforms.top.value.setHex(a.skyTop);
    this.skyMat.uniforms.hor.value.setHex(a.skyHorizon);
    this.skyMat.uniforms.rift.value = a.rift ? 1 : 0;
    this.skyMat.uniforms.sunCol.value.setHex(a.sun).multiplyScalar(Math.min(1, a.sunIntensity / 2));
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.setHex(a.fog); fog.density = a.fogDensity;
    this.fogBase = this.fogTarget = a.fogDensity;
    this.sun.color.setHex(a.sun); this.baseSun = a.sunIntensity;
    this.sunOffset.set(...a.sunDir).normalize().multiplyScalar(70);
    this.skyMat.uniforms.sunDir.value.copy(this.sunOffset).normalize();
    this.hemi.color.setHex(a.hemiSky); this.hemi.groundColor.setHex(a.hemiGround); this.baseHemi = a.hemiIntensity;
    this.vmHemi.color.setHex(a.hemiSky).lerp(new THREE.Color(0xffffff), 0.5);
    this.vmSun.color.setHex(a.sun).lerp(new THREE.Color(0xffffff), 0.3);
    this.vmRim.color.setHex(a.skyHorizon).lerp(new THREE.Color(0xffffff), 0.35);
    this.zoneLight = this.zoneTarget = 1;
    this.scene.background = null;
    this.amb = a;
    this.skyMat.uniforms.storm.value = a.storm ?? 0.35;
    SURFACE.wet.value = a.wet ?? 0;
    this.envBase = a.env ?? 1.2;
    this.renderer.toneMappingExposure = a.exposure ?? 1.0;
    this.applyGrade(a);
    this.bakeEnvironment();
    this.weather.set(DIAG.has('noweather') ? undefined : a.weather, this.quality === 'low' ? 0.4 : this.quality === 'high' ? 1 : 0.7);
  }

  setRift(v: number): void { this.skyMat.uniforms.rift.value = v; }

  /** Module la luminosité selon la zone (intérieurs sombres, etc.). */
  setZone(light: number, fogDensity?: number): void { this.zoneTarget = light; this.fogTarget = fogDensity ?? this.fogBase; }

  render(dt: number, time: number): void {
    this.zoneLight += (this.zoneTarget - this.zoneLight) * Math.min(1, dt * 2.5);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.density += (this.fogTarget - fog.density) * Math.min(1, dt * 2);
    // intérieurs : l'ambiance du ciel s'efface au profit d'un éclairage artificiel neutre
    const indoor = 1 - this.zoneLight;
    this.hemi.intensity = this.baseHemi * (0.5 + 0.5 * this.zoneLight) + indoor * 0.9;
    if (this.amb) { this.hemi.color.setHex(this.amb.hemiSky).lerp(this.indoorSky, indoor); this.hemi.groundColor.setHex(this.amb.hemiGround).lerp(this.indoorGround, indoor); }
    this.sun.intensity = this.baseSun * (0.25 + 0.75 * this.zoneLight);
    this.scene.environmentIntensity = this.envBase * (0.12 + 0.88 * this.zoneLight);
    this.vmScene.environmentIntensity = 1.1 + 1.3 * this.zoneLight;
    this.vmHemi.intensity = 1.0 + 0.9 * this.zoneLight;
    this.vmSun.intensity = 0.8 + 2.2 * this.zoneLight;
    this.vmRim.intensity = 0.5 + 0.9 * this.zoneLight;
    // le soleil de la scène éclaire l'arme depuis sa vraie direction (repère caméra), jamais par-dessous
    const sv = this.tmpV.copy(this.sunOffset).normalize().transformDirection(this.camera.matrixWorldInverse);
    this.vmSun.position.set(sv.x, Math.max(sv.y, 0.25), sv.z).lerp(this.tmpV2.set(0.5, 1, 0.6), 1 - this.zoneLight * 0.85);
    this.skyMat.uniforms.t.value = time;
    if (this.grade) this.grade.uniforms.time.value = time;
    this.weather.update(this.camera.position, time, this.zoneLight, this.renderer.domElement.height);
    this.sky.position.copy(this.camera.position);
    this.sky.scale.setScalar(500);
    // la caméra d'ombre suit le joueur
    const cp = this.camera.position;
    this.sun.target.position.set(Math.round(cp.x), 0, Math.round(cp.z));
    this.sun.position.copy(this.sun.target.position).add(this.sunOffset);
    this.renderer.info.reset();
    if (this.composer) {
      if (this.vmPass) this.vmPass.enabled = this.drawVm;
      this.composer.render(dt);
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      if (this.drawVm) { this.renderer.clearDepth(); this.renderer.render(this.vmScene, this.vmCamera); }
    }
    this.info.calls = this.renderer.info.render.calls;
    this.info.tris = this.renderer.info.render.triangles;
  }
}
