// Minuterie réseau indépendante de l'affichage : un Web Worker envoie un battement régulier.
// Les navigateurs suspendent requestAnimationFrame et ralentissent fortement les minuteries d'un onglet masqué,
// mais continuent de livrer les messages d'un Worker : la partie (et l'autorité de l'hôte) continue de tourner.
const SRC = `let t=null;onmessage=(e)=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data);};`;

export class Ticker {
  private w: Worker | null = null;
  private last = 0;
  constructor(private fn: (dt: number) => void) {}

  start(ms: number): void {
    if (!this.w) {
      try {
        this.w = new Worker(URL.createObjectURL(new Blob([SRC], { type: 'text/javascript' })));
        this.w.onmessage = () => { const now = performance.now(); const dt = Math.min(0.5, (now - this.last) / 1000); this.last = now; this.fn(dt); };
      } catch { this.w = null; return; }
    }
    this.last = performance.now();
    this.w.postMessage(ms);
  }

  stop(): void { this.w?.postMessage(0); }
  dispose(): void { this.w?.terminate(); this.w = null; }
}
