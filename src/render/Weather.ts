// Particules d'ambiance autour de la caméra : cendres, pluie, poussières arcaniques, braises.
// Un volume de particules qui se répète autour du joueur ; un seul appel de rendu, animé dans le shader.
import * as THREE from 'three';

export type WeatherKind = 'ash' | 'rain' | 'motes' | 'embers';

const CFG: Record<WeatherKind, { n: number; color: number; size: number; vel: [number, number, number]; sway: number; alpha: number; streak: number; add: boolean }> = {
  ash: { n: 1400, color: 0xc8b8a8, size: 0.05, vel: [0.5, -0.7, 0.25], sway: 0.6, alpha: 0.55, streak: 0, add: false },
  rain: { n: 2600, color: 0xa8b8d8, size: 0, vel: [1.2, -19, 0.6], sway: 0, alpha: 0.3, streak: 0.55, add: true },
  motes: { n: 900, color: 0xa070ff, size: 0.045, vel: [0.1, 0.25, 0.05], sway: 0.9, alpha: 0.8, streak: 0, add: true },
  embers: { n: 1100, color: 0xff6a2a, size: 0.04, vel: [0.3, 0.9, -0.2], sway: 1.2, alpha: 0.9, streak: 0, add: true },
};

export class Weather {
  private obj: THREE.Object3D | null = null;
  private mat: THREE.ShaderMaterial | null = null;
  private base = 1;
  constructor(private scene: THREE.Scene) {}

  set(kind: WeatherKind | undefined, quality: number): void {
    if (this.obj) { this.scene.remove(this.obj); (this.obj as any).geometry.dispose(); this.mat!.dispose(); this.obj = null; this.mat = null; }
    if (!kind || quality <= 0) return;
    const c = CFG[kind], n = Math.round(c.n * quality), line = c.streak > 0;
    const pos = new Float32Array(n * (line ? 6 : 3)), end = new Float32Array(n * (line ? 2 : 1));
    for (let i = 0; i < n; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random();
      if (line) { pos.set([x, y, z, x, y, z], i * 6); end[i * 2 + 1] = 1; } else pos.set([x, y, z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('end', new THREE.BufferAttribute(end, 1));
    this.base = c.alpha;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { cam: { value: new THREE.Vector3() }, t: { value: 0 }, vel: { value: new THREE.Vector3(...c.vel) }, box: { value: new THREE.Vector3(34, 18, 34) }, color: { value: new THREE.Color(c.color) }, size: { value: c.size }, sway: { value: c.sway }, streak: { value: c.streak }, alpha: { value: c.alpha }, px: { value: 600 } },
      vertexShader: `uniform vec3 cam; uniform float t; uniform vec3 vel; uniform vec3 box; uniform float size; uniform float sway; uniform float streak; uniform float px; attribute float end; varying float vA;
        void main(){ vec3 seed=position; vec3 p=seed*box+vel*t;
          p.x+=sin(t*0.7+seed.y*40.0)*sway; p.z+=cos(t*0.5+seed.x*40.0)*sway;
          p=mod(p-cam,box)-box*0.5; p.y+=3.0;
          float edge=1.0-smoothstep(0.38,0.5,max(abs(p.x)/box.x,abs(p.z)/box.z));
          p+=cam; p+=normalize(vel)*streak*end;
          vec4 mv=viewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
          gl_PointSize=max(1.0,size*px/max(-mv.z,0.5)*(0.6+seed.z*0.8));
          vA=edge*smoothstep(0.6,2.0,-mv.z)*(0.5+0.5*fract(seed.x*91.7)); }`,
      fragmentShader: `uniform vec3 color; uniform float alpha; uniform float streak; varying float vA;
        void main(){ float a=vA*alpha; if(streak<=0.0){ vec2 c=gl_PointCoord-0.5; a*=(1.0-smoothstep(0.1,0.5,length(c))); } gl_FragColor=vec4(color*(streak>0.0?1.0:1.6),a); }`,
      transparent: true, depthWrite: false, blending: c.add ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.obj = line ? new THREE.LineSegments(g, this.mat) : new THREE.Points(g, this.mat);
    this.obj.frustumCulled = false; this.obj.renderOrder = 5;
    this.scene.add(this.obj);
  }

  update(cam: THREE.Vector3, time: number, zone: number, pixelH: number): void {
    if (!this.mat) return;
    const u = this.mat.uniforms;
    u.cam.value.copy(cam); u.t.value = time; u.px.value = pixelH;
    // à l'intérieur, les intempéries s'effacent
    u.alpha.value = this.base * Math.max(0, Math.min(1, (zone - 0.55) / 0.35));
    this.obj!.visible = u.alpha.value > 0.01;
  }
}
