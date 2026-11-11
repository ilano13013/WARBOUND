// Rendu : scène principale, scène d'arme (viewmodel), post-traitement, ciel, éclairage et préréglages de qualité.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Ambience } from '../world/Level';
import type { Settings } from '../save/Save';

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
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private quality: Settings['quality'] = 'medium';
  private scale = 1;
  private sunOffset = new THREE.Vector3(30, 50, 20);
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
      uniforms: { top: { value: new THREE.Color(0x101828) }, hor: { value: new THREE.Color(0x404858) }, rift: { value: 0 }, t: { value: 0 }, sunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3) }, sunCol: { value: new THREE.Color(0xffffff) } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform float rift; uniform float t; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vDir;
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){ vec3 d=normalize(vDir); float y=clamp(d.y,0.0,1.0);
          vec3 col=mix(hor,top,pow(y,0.55));
          float cl=n(d.xz/(d.y+0.25)*1.6+t*0.01)*0.6+n(d.xz/(d.y+0.25)*4.0-t*0.015)*0.4;
          col=mix(col,hor*1.25,smoothstep(0.5,0.9,cl)*0.35*smoothstep(0.0,0.3,d.y));
          float s=max(dot(d,normalize(sunDir)),0.0); col+=sunCol*(pow(s,350.0)*2.0+pow(s,12.0)*0.18);
          if(rift>0.0){ float a=atan(d.z,d.x); float w=sin(d.y*11.0+t*0.4)*0.05+sin(d.y*23.0-t*0.7)*0.02;
            float c=abs(a+1.42+w); float core=smoothstep(0.05,0.0,c)*smoothstep(0.02,0.25,d.y);
            float halo=smoothstep(0.5,0.0,c)*smoothstep(0.0,0.3,d.y)*0.35;
            col+=rift*(vec3(0.75,0.5,1.0)*core*2.4+vec3(0.35,0.15,0.8)*halo*(0.7+0.3*sin(t*1.3))); }
          col=mix(hor*0.6,col,smoothstep(-0.12,0.02,d.y));
          gl_FragColor=vec4(col,1.0); }`,
      side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    // environnement de réflexion pour les matériaux PBR métalliques
    const pm = new THREE.PMREMGenerator(this.renderer);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environment = env; this.scene.environmentIntensity = 0.3;
    this.vmScene.environment = env; this.vmScene.environmentIntensity = 0.7;
    this.vmScene.add(this.vmHemi, this.vmSun);
    this.vmSun.position.set(0.6, 1.2, 0.8);
    this.scene.add(this.camera);
    window.addEventListener('resize', () => this.resize());
  }

  applySettings(s: Settings): void {
    const changed = s.quality !== this.quality || s.renderScale !== this.scale || (!this.composer && s.quality !== 'low');
    this.quality = s.quality; this.scale = s.renderScale;
    const q = s.quality;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) { this.sun.shadow.mapSize.set(size, size); this.sun.shadow.map?.dispose(); (this.sun.shadow as any).map = null; }
    const ext = q === 'high' ? 55 : 38;
    const cam = this.sun.shadow.camera;
    cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext; cam.near = 1; cam.far = 160;
    cam.updateProjectionMatrix();
    if (changed) this.buildComposer();
    this.resize();
  }

  private buildComposer(): void {
    this.composer?.dispose();
    this.composer = null; this.bloom = null;
    if (this.quality === 'low') return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.quality === 'high' ? 4 : 2 });
    const comp = new EffectComposer(this.renderer, rt);
    comp.addPass(new RenderPass(this.scene, this.camera));
    const vm = new RenderPass(this.vmScene, this.vmCamera);
    vm.clear = false; vm.clearDepth = true;
    comp.addPass(vm);
    this.vmPass = vm;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), this.quality === 'high' ? 0.5 : 0.42, 0.7, 0.9);
    comp.addPass(this.bloom);
    comp.addPass(new OutputPass());
    this.composer = comp;
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
    this.vmSun.color.setHex(a.sun).lerp(new THREE.Color(0xffffff), 0.4);
    this.zoneLight = this.zoneTarget = 1;
    this.scene.background = null;
  }

  setRift(v: number): void { this.skyMat.uniforms.rift.value = v; }

  /** Module la luminosité selon la zone (intérieurs sombres, etc.). */
  setZone(light: number, fogDensity?: number): void { this.zoneTarget = light; this.fogTarget = fogDensity ?? this.fogBase; }

  render(dt: number, time: number): void {
    this.zoneLight += (this.zoneTarget - this.zoneLight) * Math.min(1, dt * 2.5);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.density += (this.fogTarget - fog.density) * Math.min(1, dt * 2);
    this.hemi.intensity = this.baseHemi * (0.42 + 0.58 * this.zoneLight);
    this.sun.intensity = this.baseSun * (0.25 + 0.75 * this.zoneLight);
    this.scene.environmentIntensity = 0.08 + 0.24 * this.zoneLight;
    this.vmScene.environmentIntensity = 0.35 + 0.4 * this.zoneLight;
    this.vmHemi.intensity = 0.7 + 0.7 * this.zoneLight;
    this.vmSun.intensity = 0.6 + 1.0 * this.zoneLight;
    this.skyMat.uniforms.t.value = time;
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
