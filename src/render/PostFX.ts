// Shaders du ciel et du post-traitement : atmosphère (occlusion ambiante, rayons du soleil, brume au sol) et étalonnage final.
import * as THREE from 'three';

/** Ciel : dégradé, nuages éclairés par le soleil, halo solaire et faille. `envMode` = capture pour les reflets (sans disque solaire). */
export const SKY_FRAGMENT = /* glsl */ `
uniform vec3 top; uniform vec3 hor; uniform float rift; uniform float t; uniform float storm; uniform float envMode;
uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vDir;
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=n(p)*a; p=p*2.03+vec2(17.0,9.0); a*=0.5; } return v; }
void main(){
  vec3 d=normalize(vDir); float y=clamp(d.y,0.0,1.0);
  vec3 sd=normalize(sunDir); float s=max(dot(d,sd),0.0);
  // dégradé : zénith sombre, horizon lumineux, réchauffé côté soleil
  vec3 col=mix(hor,top,pow(y,0.42));
  col+=sunCol*hor*pow(s,3.0)*0.9*(1.0-y*0.7);
  col+=sunCol*(pow(s,24.0)*0.35+pow(s,6.0)*0.12);
  // nuages en deux couches, dessous sombre et bords argentés face au soleil
  // dénominateur borné : sous l'horizon (d.y = -0,18) la division par zéro produisait des valeurs invalides que le bloom étalait en rectangles noirs
  vec2 cp=d.xz/max(d.y+0.18,0.06);
  float c1=fbm(cp*0.9+vec2(t*0.006,0.0)), c2=fbm(cp*2.3-vec2(0.0,t*0.01)+c1);
  float cov=smoothstep(0.62-storm*0.34,0.9-storm*0.2,c1*0.65+c2*0.45);
  float thick=smoothstep(0.45,0.95,c2);
  vec3 cloudDark=mix(top,hor,0.35)*(0.55-storm*0.2);
  vec3 cloudLit=hor*1.15+sunCol*(0.25+0.9*pow(s,4.0));
  vec3 cloud=mix(cloudLit,cloudDark,thick*(0.55+0.45*(1.0-s)));
  col=mix(col,cloud,cov*smoothstep(0.0,0.22,d.y)*0.92);
  if(envMode<0.5) col+=sunCol*pow(s,900.0)*6.0*(1.0-cov*0.85);
  if(rift>0.0){ float a=atan(d.z,d.x); float w=sin(d.y*11.0+t*0.4)*0.05+sin(d.y*23.0-t*0.7)*0.02;
    float c=abs(a+1.42+w); float core=smoothstep(0.05,0.0,c)*smoothstep(0.02,0.25,d.y);
    float halo=smoothstep(0.5,0.0,c)*smoothstep(0.0,0.3,d.y)*0.35;
    col+=rift*(vec3(0.75,0.5,1.0)*core*2.4+vec3(0.35,0.15,0.8)*halo*(0.7+0.3*sin(t*1.3))); }
  // sous l'horizon : brume puis sol sombre (sert aussi aux reflets)
  col=mix(hor*mix(0.6,0.22,smoothstep(0.0,-0.5,d.y)),col,smoothstep(-0.1,0.02,d.y));
  col=clamp(col,0.0,40.0);
  gl_FragColor=vec4(col,1.0);
}`;

/** Occlusion ambiante depuis la profondeur, rayons du soleil en espace écran, brume au sol et halo de diffusion. */
export const ATMOSPHERE_SHADER = {
  name: 'AtmosphereShader',
  defines: { AO_TAPS: 8, RAY_TAPS: 18 } as Record<string, number>,
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() },
    near: { value: 0.1 }, far: { value: 600 }, aspect: { value: 1.78 }, projScale: { value: 1 },
    sunView: { value: new THREE.Vector3(0, 1, 0) }, sunUV: { value: new THREE.Vector2(0.5, 0.5) }, sunVis: { value: 0 },
    sunCol: { value: new THREE.Color(1, 1, 1) }, fogCol: { value: new THREE.Color(0.2, 0.2, 0.25) },
    mist: { value: 0.35 }, aoStr: { value: 1 }, zone: { value: 1 }, time: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform mat4 projInv; uniform mat4 camWorld;
uniform float near; uniform float far; uniform float aspect; uniform float projScale;
uniform vec3 sunView; uniform vec2 sunUV; uniform float sunVis; uniform vec3 sunCol; uniform vec3 fogCol;
uniform float mist; uniform float aoStr; uniform float zone; uniform float time;
varying vec2 vUv;
vec3 viewPos(vec2 uv){ float d=texture2D(tDepth,uv).x; vec4 v=projInv*vec4(uv*2.0-1.0,d*2.0-1.0,1.0); return v.xyz/v.w; }
float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); }
void main(){
  vec4 src=texture2D(tDiffuse,vUv);
  vec3 col=src.rgb;
  float depth=texture2D(tDepth,vUv).x;
  bool sky=depth>=0.99999;
  vec3 p=viewPos(vUv);
  float dist=length(p);
  vec3 vd=p/max(dist,0.0001);
  float sunward=max(dot(vd,sunView),0.0);
  float noise=ign(gl_FragCoord.xy);
  if(!sky){
    // --- occlusion ambiante (hémisphère orienté par la normale reconstruite)
    vec3 nc=cross(dFdx(p),dFdy(p)); vec3 nrm=nc/max(length(nc),1e-9);
    float rad=0.75;
    float pr=min(rad*projScale/max(-p.z,0.3),0.09);
    float ang=noise*6.2831853, occ=0.0;
    for(int i=0;i<AO_TAPS;i++){
      float f=(float(i)+0.5)/float(AO_TAPS);
      float a=ang+float(i)*2.3999632;
      vec2 o=vec2(cos(a),sin(a))*sqrt(f)*pr; o.x/=aspect;
      vec3 v=viewPos(vUv+o)-p;
      float vv=dot(v,v);
      occ+=max(dot(v,nrm)-0.03-0.004*dist,0.0)/(vv+0.02)*step(vv,rad*rad*2.5);
    }
    float ao=clamp(1.0-occ*(1.15*aoStr/float(AO_TAPS)),0.0,1.0);
    ao=mix(1.0,ao,exp(-dist*0.025));
    // la lumière directe forte perce l'occlusion
    float lum=dot(col,vec3(0.3,0.6,0.1));
    col*=mix(ao,1.0,clamp(lum*0.55,0.0,0.7));
    // --- brume au sol : dense près du sol, colorée par le soleil
    float wy=(camWorld*vec4(p,1.0)).y;
    float m=mist*zone*zone*(1.0-exp(-dist*0.03))*exp(-max(wy,0.0)*0.38);
    vec3 mistCol=fogCol+sunCol*(0.06+0.45*pow(sunward,4.0));
    col=mix(col,mistCol,clamp(m,0.0,0.6));
    // --- halo de diffusion vers le soleil sur les lointains
    col+=sunCol*pow(sunward,10.0)*(1.0-exp(-dist*0.012))*0.14*zone;
  }
  // --- rayons du soleil : le ciel proche du soleil diffuse le long de la direction écran → soleil
  if(sunVis>0.001){
    vec2 dl=sunUV-vUv;
    vec2 st=dl/float(RAY_TAPS)*0.92;
    vec2 uv=vUv+st*noise;
    float acc=0.0, w=1.0;
    for(int i=0;i<RAY_TAPS;i++){
      vec2 q=(uv-sunUV)*vec2(aspect,1.0);
      float near_=exp(-dot(q,q)*3.2);
      float open=step(0.99999,texture2D(tDepth,clamp(uv,0.001,0.999)).x);
      acc+=open*near_*w; w*=0.965; uv+=st;
    }
    acc/=float(RAY_TAPS);
    vec2 q0=dl*vec2(aspect,1.0);
    col+=sunCol*acc*sunVis*(0.5+0.5*exp(-dot(q0,q0)*1.5))*1.05;
  }
  // garde-fou : aucune valeur invalide ou démesurée ne doit atteindre le bloom
  if(any(isnan(col))||any(isinf(col))) col=vec3(0.0);
  col=clamp(col,0.0,60.0);
  gl_FragColor=vec4(col,src.a);
}`,
};

/** Étalonnage en espace écran : netteté, contraste, teinte des ombres et des hautes lumières, vignettage, grain. */
export const GRADE_SHADER = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null }, shadowTint: { value: new THREE.Color(0.52, 0.59, 0.69) }, lightTint: { value: new THREE.Color(1, 0.94, 0.86) },
    contrast: { value: 1.08 }, saturation: { value: 0.92 }, vignette: { value: 0.42 }, grain: { value: 0.035 }, sharpen: { value: 0.35 }, time: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform vec3 shadowTint; uniform vec3 lightTint;
uniform float contrast; uniform float saturation; uniform float vignette; uniform float grain; uniform float sharpen; uniform float time;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 px=1.0/vec2(textureSize(tDiffuse,0));
  vec2 c=vUv-0.5; float r2=dot(c,c);
  // légère aberration chromatique sur les bords
  vec2 ca=c*r2*0.004;
  vec3 col=vec3(texture2D(tDiffuse,vUv+ca).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-ca).b);
  vec3 blur=(texture2D(tDiffuse,vUv+vec2(px.x,0.0)).rgb+texture2D(tDiffuse,vUv-vec2(px.x,0.0)).rgb+texture2D(tDiffuse,vUv+vec2(0.0,px.y)).rgb+texture2D(tDiffuse,vUv-vec2(0.0,px.y)).rgb)*0.25;
  col=max(col+(col-blur)*sharpen,0.0);
  float l=dot(col,vec3(0.2126,0.7152,0.0722));
  // teinte séparée, discrète : ombres froides, hautes lumières chaudes
  vec3 st=mix(vec3(1.0),shadowTint/max(max(shadowTint.r,shadowTint.g),shadowTint.b),0.55);
  vec3 lt=mix(vec3(1.0),lightTint/max(max(lightTint.r,lightTint.g),lightTint.b),0.6);
  col*=mix(st,lt,smoothstep(0.05,0.6,l));
  col=mix(vec3(l),col,saturation);
  col=(col-0.36)*contrast+0.36;
  col=max(col,0.0);
  // pied de courbe adouci : noirs denses sans écrasement total
  col=mix(col,col*col*(3.0-2.0*clamp(col,0.0,1.0)),0.18);
  col*=1.0-vignette*smoothstep(0.12,0.62,r2);
  col+=(h(gl_FragCoord.xy+fract(time)*91.7)-0.5)*grain*(1.0-l*0.6);
  gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
}`,
};
