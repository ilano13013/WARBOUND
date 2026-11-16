// Boutique WARBOUND : 100 % cosmétique. Catalogue, détail avec aperçu 3D, confirmation d'achat (Stripe Checkout),
// inventaire, équipement, historique des achats et compte. Sans serveur configuré : démonstration (aperçu et essai local).
import type { UI } from './UI';
import { esc } from './UI';
import { COS_ITEMS, COS_PRODUCTS, SLOT_OF, euros, type CosProduct, type CosSlot } from '../data/cosmetics';
import { cosmeticImage } from '../render/Cosmetics';
import { Preview } from './Preview3D';

type Tab = 'shop' | 'inv' | 'hist' | 'acct';
const CATS: { id: CosProduct['category'] | 'all'; label: string }[] = [
  { id: 'all', label: 'Tout' }, { id: 'camo', label: 'Camouflages d’armes' }, { id: 'outfit', label: 'Tenues' }, { id: 'emblem', label: 'Emblèmes et cartes' }, { id: 'pack', label: 'Packs' },
];
const STATUS: Record<string, string> = { paid: 'Payé', refunded: 'Remboursé', disputed: 'Contesté' };

export class Shop {
  private tab: Tab = 'shop';
  private cat: CosProduct['category'] | 'all' = 'all';
  private sel: CosProduct | null = null;
  private preview: Preview | null = null;
  private status = '';
  private recovery = '';

  constructor(private ui: UI) {}

  private get g() { return this.ui.g; }
  private get acc() { return this.g.account; }

  private price(p: CosProduct): string {
    const c = this.acc.catalog?.products.find((x) => x.sku === p.sku);
    return euros(c ? c.priceCents : p.demoPriceCents);
  }
  private owns(id: string): boolean { return !!this.acc.me?.owned.includes(id); }
  private ownsAll(p: CosProduct): boolean { return p.items.every((i) => this.owns(i)); }

  async open(msg = ''): Promise<void> {
    this.status = msg;
    this.render();
    if (this.acc.online) {
      await Promise.all([this.acc.loadCatalog(), this.acc.ensure(this.g.profile!.name)]);
      if (msg.startsWith('Paiement reçu')) setTimeout(() => void this.acc.refresh().then(() => this.ui.current === 'shop' && this.render()), 4000);
      if (this.ui.current === 'shop') this.render();
    }
  }

  close(): void { this.preview?.dispose(); this.preview = null; this.g.weapons.rebuild(true); this.ui.showMenu(); }

  private mode(): string {
    if (!this.acc.online) return 'Démonstration : aucun serveur de boutique configuré. Vous pouvez prévisualiser et essayer les objets ; rien n’est vendu ni conservé.';
    if (this.acc.error && !this.acc.me) return `Serveur indisponible : ${this.acc.error}`;
    if (!this.acc.catalog?.payments) return 'Achats désactivés : les paiements ne sont pas encore activés. Les objets peuvent être prévisualisés et essayés.';
    return this.acc.catalog.testMode ? 'MODE TEST STRIPE : aucun paiement réel. Utilisez une carte de test Stripe.' : '';
  }

  render(): void {
    this.preview?.dispose(); this.preview = null;
    const tabs = ([['shop', 'Boutique'], ['inv', 'Inventaire'], ['hist', 'Historique des achats'], ['acct', 'Compte']] as [Tab, string][])
      .map(([id, l]) => `<button class="btn small ${this.tab === id ? 'primary' : ''}" data-a="tab" data-v="${id}">${l}</button>`).join(' ');
    let body = '';
    if (this.tab === 'shop') body = this.sel ? this.detailHtml(this.sel) : this.gridHtml();
    else if (this.tab === 'inv') body = this.invHtml();
    else if (this.tab === 'hist') body = this.histHtml();
    else body = this.acctHtml();
    const mode = this.mode();
    this.ui.show('shop', 'overlay', `<div class="panel"><div class="panel-head"><h2>Boutique</h2><span class="sub">100 % cosmétique — aucun avantage en jeu</span><span class="spacer"></span><button class="btn small" data-a="close">Fermer</button></div>
      <div class="panel-body col scroll"><div class="row" style="gap:6px;flex-wrap:wrap">${tabs}</div>${mode ? `<div class="shop-note">${esc(mode)}</div>` : ''}${body}</div>
      <div class="panel-foot"><span class="legal-links"><a data-a="legal" data-v="cgv">CGV</a> · <a data-a="legal" data-v="mentions">Mentions légales</a> · <a data-a="legal" data-v="privacy">Confidentialité</a></span><span class="label" id="shop-status" style="text-transform:none;letter-spacing:.03em">${esc(this.status)}</span></div></div>`, this.handlers());
    const cv = document.getElementById('shop-preview') as HTMLCanvasElement | null;
    if (cv && this.sel) {
      this.preview = new Preview(cv);
      const camo = this.sel.items.find((i) => COS_ITEMS[i].kind === 'camo');
      if (this.sel.items.includes('outfit_fondateur')) this.preview.showOperator('outfit_fondateur');
      else this.preview.showWeapon(camo || null);
    }
  }

  private card(p: CosProduct): string {
    const owned = this.ownsAll(p);
    const img = p.category === 'pack' ? `<img src="${cosmeticImage('emblem_fondateur')}" alt="">` : `<span class="swatch ${p.sku}"></span>`;
    return `<div class="shop-card" data-a="sel" data-v="${p.sku}">${img}<b>${esc(p.name)}</b><span class="label">${p.premium ? 'Premium' : 'Standard'}</span><span class="price">${owned ? 'Possédé' : this.price(p)}</span></div>`;
  }

  private gridHtml(): string {
    const cats = CATS.map((c) => `<button class="btn small ${this.cat === c.id ? 'primary' : ''}" data-a="cat" data-v="${c.id}">${c.label}</button>`).join(' ');
    const list = COS_PRODUCTS.filter((p) => this.cat === 'all' || p.category === this.cat || (this.cat === 'outfit' || this.cat === 'emblem') && p.category === 'pack');
    return `<div class="row" style="gap:6px;flex-wrap:wrap">${cats}</div><div class="shop-grid">${list.map((p) => this.card(p)).join('') || '<span class="label">Aucun objet dans cette catégorie pour le moment.</span>'}</div>`;
  }

  private detailHtml(p: CosProduct): string {
    const canBuy = this.acc.online && !!this.acc.catalog?.payments && !!this.acc.me;
    const owned = this.ownsAll(p);
    const items = p.items.map((i) => { const it = COS_ITEMS[i]; const img = it.kind === 'emblem' || it.kind === 'card' ? `<img class="cos-img ${it.kind}" src="${cosmeticImage(i)}" alt="">` : ''; return `<div class="kv"><span>${esc(it.name)}${img}</span><span>${this.owns(i) ? '<span class="good">possédé</span>' : ''}</span></div>`; }).join('');
    return `<div class="row" style="gap:18px;flex-wrap:wrap;align-items:flex-start">
      <canvas id="shop-preview" class="shop-preview"></canvas>
      <div class="col grow" style="min-width:260px">
        <button class="btn small" data-a="back">← Retour au catalogue</button>
        <h2 style="font-size:26px">${esc(p.name)}</h2>
        <p class="brief">${esc(p.desc)}</p>
        <div class="label">Contenu</div>${items}
        <div class="kv"><span>Prix</span><span class="price">${this.price(p)}</span></div>
        <p class="label" style="text-transform:none;letter-spacing:.03em">Prix final. TVA non applicable, art. 293 B du CGI.</p>
        <p class="label" style="text-transform:none;letter-spacing:.03em">Objet purement cosmétique : il ne modifie ni les dégâts, ni la précision, ni la cadence, ni la vitesse, ni les zones de touche. En 4v4, la couleur d’équipe reste imposée.</p>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          ${owned ? '<span class="good">Vous possédez cet objet</span>' : `<button class="btn primary" data-a="buy" ${canBuy ? '' : 'disabled'}>Acheter — ${this.price(p)}</button>`}
          ${p.items.filter((i) => SLOT_OF[i]).map((i) => this.owns(i) ? `<button class="btn" data-a="equip" data-v="${i}">${this.acc.me?.equipped[SLOT_OF[i]!] === i ? 'Équipé' : 'Équiper ' + esc(COS_ITEMS[i].name)}</button>` : `<button class="btn" data-a="trial" data-v="${i}">${this.acc.trial[SLOT_OF[i]!] === i ? 'Essai en cours' : 'Essayer ' + esc(COS_ITEMS[i].name)}</button>`).join('')}
        </div>
        ${!owned && !canBuy ? '<p class="label" style="text-transform:none;letter-spacing:.03em">L’achat n’est pas disponible sur cette version : voir l’encadré en haut de la page.</p>' : ''}
        <p class="label" style="text-transform:none;letter-spacing:.03em">L’essai est local et temporaire : il n’est visible que par vous, hors des parties en ligne, et disparaît au rechargement de la page.</p>
      </div></div>`;
  }

  private invHtml(): string {
    const me = this.acc.me;
    if (!me) return `<p class="brief">${this.acc.online ? 'Connexion au compte…' : 'Démonstration : aucun objet possédé. Les objets essayés apparaissent ci-dessous.'}</p>${this.trialList()}`;
    const rows = me.owned.map((id) => { const it = COS_ITEMS[id]; if (!it) return ''; const slot = SLOT_OF[id]; const on = slot && me.equipped[slot] === id; return `<div class="kv"><span>${esc(it.name)}${it.kind === 'emblem' || it.kind === 'card' ? `<img class="cos-img ${it.kind}" src="${cosmeticImage(id)}" alt="">` : ''}</span><span>${slot ? `<button class="btn small ${on ? 'primary' : ''}" data-a="${on ? 'unequip' : 'equip'}" data-v="${id}">${on ? 'Retirer' : 'Équiper'}</button>` : '<span class="good">permanent</span>'}</span></div>`; }).join('');
    return `${me.badge ? `<div class="kv"><span>Badge</span><span><em class="badge">${esc(me.badge)}</em></span></div>` : ''}<div class="label">Objets possédés (${me.owned.length})</div>${rows || '<span class="label">Aucun objet pour le moment.</span>'}${me.revoked.length ? `<p class="label" style="text-transform:none;letter-spacing:.03em">${me.revoked.length} objet(s) retiré(s) après remboursement ou contestation.</p>` : ''}${this.trialList()}`;
  }

  private trialList(): string {
    const t = Object.entries(this.acc.trial).filter(([, v]) => v);
    return t.length ? `<div class="label">Essais en cours</div>${t.map(([s, id]) => `<div class="kv"><span>${esc(COS_ITEMS[id!].name)}</span><button class="btn small" data-a="untrial" data-v="${s}">Arrêter l’essai</button></div>`).join('')}` : '';
  }

  private histHtml(): string {
    const me = this.acc.me;
    if (!me) return '<p class="brief">Aucun achat (démonstration ou compte non connecté).</p>';
    if (!me.purchases.length) return '<p class="brief">Aucun achat pour le moment.</p>';
    return `<table class="board"><tr><th>Date</th><th>Produit</th><th>Montant</th><th>État</th></tr>${me.purchases.map((p) => `<tr><td>${new Date(p.created_at).toLocaleString('fr-FR')}</td><td>${esc(COS_PRODUCTS.find((x) => x.sku === p.sku)?.name || p.sku)}${p.livemode ? '' : ' <span class="label">(test)</span>'}</td><td>${euros(p.amount_cents)}</td><td>${STATUS[p.status] || esc(p.status)}</td></tr>`).join('')}</table>`;
  }

  private acctHtml(): string {
    const me = this.acc.me;
    if (!this.acc.online) return '<p class="brief">Les comptes en ligne ne sont pas disponibles sur cette version (aucun serveur configuré). Le jeu solo et le duel par codes n’en ont pas besoin.</p>';
    return `<p class="brief">Votre compte est créé automatiquement, sans adresse e-mail ni mot de passe. Il conserve vos achats sur le serveur. Pour le retrouver sur un autre appareil ou après avoir effacé les données du navigateur, gardez un code de récupération.</p>
      ${me ? `<div class="kv"><span>Identifiant du compte</span><span>${esc(me.id)}</span></div>` : ''}
      <button class="btn" data-a="recovery" ${me ? '' : 'disabled'}>Créer un code de récupération</button>
      ${this.recovery ? `<div class="kv"><span>Votre code (affiché une seule fois)</span><span><b style="letter-spacing:.15em">${esc(this.recovery)}</b></span></div>` : ''}
      <div class="label">Retrouver un compte</div>
      <div class="row" style="gap:8px"><input id="recover-code" class="code-input" style="width:260px;font-size:16px" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false"><button class="btn" data-a="recover">Récupérer</button></div>`;
  }

  private confirmBuy(p: CosProduct): void {
    this.preview?.dispose(); this.preview = null;
    this.ui.show('shop', 'overlay', `<div class="panel narrow"><div class="panel-head"><h2>Confirmer l’achat</h2></div>
      <div class="panel-body col">
        <div class="kv"><span>${esc(p.name)}</span><span class="price">${this.price(p)}</span></div>
        <p class="brief">Le paiement a lieu sur la page sécurisée de Stripe. WARBOUND ne voit ni ne conserve vos données de carte. L’objet est ajouté à votre compte dès que Stripe confirme le paiement.</p>
        <label class="chk"><input type="checkbox" id="c-age"> J’ai 18 ans ou plus, ou j’ai l’accord d’un parent ou tuteur pour cet achat.</label>
        <label class="chk"><input type="checkbox" id="c-wd"> Je demande la livraison immédiate de ce contenu numérique et je reconnais perdre mon droit de rétractation une fois l’objet livré.</label>
        <p class="label" style="text-transform:none;letter-spacing:.03em">Prix final, TVA non applicable (art. 293 B du CGI). Lire les <a data-a="legal" data-v="cgv">conditions générales de vente</a> et la <a data-a="legal" data-v="privacy">politique de confidentialité</a>.</p>
      </div>
      <div class="panel-foot"><button class="btn primary" data-a="pay">Payer ${this.price(p)} avec Stripe</button><button class="btn" data-a="cancel">Annuler</button></div></div>`, {
      pay: () => {
        const age = (document.getElementById('c-age') as HTMLInputElement).checked, wd = (document.getElementById('c-wd') as HTMLInputElement).checked;
        if (!age || !wd) { this.ui.hud.toast('COCHEZ LES DEUX CASES POUR CONTINUER', '#ff8a6a'); return; }
        void this.acc.checkout(p.sku).then((url) => { location.href = url; }, (e) => { this.status = (e as Error).message; this.render(); });
      },
      cancel: () => this.render(),
      legal: (v) => this.ui.showLegal(v as 'cgv' | 'privacy', () => this.confirmBuy(p)),
    });
  }

  private handlers(): Record<string, (v: string) => void> {
    const run = (p: Promise<unknown>) => { void p.then(() => this.render(), (e) => { this.status = (e as Error).message; this.render(); }); };
    return {
      close: () => this.close(),
      legal: (v) => this.ui.showLegal(v as 'cgv' | 'mentions' | 'privacy', () => this.render()),
      tab: (v) => { this.tab = v as Tab; this.sel = null; this.render(); },
      cat: (v) => { this.cat = v as CosProduct['category'] | 'all'; this.render(); },
      sel: (v) => { this.sel = COS_PRODUCTS.find((p) => p.sku === v) || null; this.render(); },
      back: () => { this.sel = null; this.render(); },
      buy: () => { if (this.sel) this.confirmBuy(this.sel); },
      trial: (v) => { const s = SLOT_OF[v] as CosSlot; this.acc.trial[s] = this.acc.trial[s] === v ? undefined : v; this.status = this.acc.trial[s] ? `Essai : ${COS_ITEMS[v].name}` : ''; this.render(); },
      untrial: (v) => { delete this.acc.trial[v as CosSlot]; this.render(); },
      equip: (v) => { const s = SLOT_OF[v]; if (s) run(this.acc.equip(s, v)); },
      unequip: (v) => { const s = SLOT_OF[v]; if (s) run(this.acc.equip(s, null)); },
      recovery: () => { void this.acc.recoveryCode().then((c) => { this.recovery = c; this.render(); }, (e) => { this.status = (e as Error).message; this.render(); }); },
      recover: () => { const c = (document.getElementById('recover-code') as HTMLInputElement | null)?.value || ''; run(this.acc.recover(c).then(() => { this.status = 'Compte récupéré.'; })); },
    };
  }
}
