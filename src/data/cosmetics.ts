// Catalogue d'affichage des cosmétiques. Les PRIX ET LA POSSESSION sont décidés par le serveur
// (server/src/catalog.ts) ; les prix ci-dessous ne servent qu'en démonstration, quand aucun serveur n'est configuré.
// Règle d'équilibrage : un cosmétique ne change que des couleurs, textures ou images. Aucun champ de ce fichier
// n'est lu par le calcul des statistiques (rpg/Stats.ts) ni par le réseau de jeu.

export type CosKind = 'camo' | 'outfit' | 'emblem' | 'card' | 'badge';
export type CosSlot = 'camo' | 'outfit' | 'emblem' | 'card';

export interface CosItem { id: string; kind: CosKind; name: string; desc: string }
export interface CosProduct { sku: string; name: string; category: 'camo' | 'outfit' | 'emblem' | 'pack'; premium: boolean; demoPriceCents: number; items: string[]; desc: string }

export const COS_ITEMS: Record<string, CosItem> = {
  camo_cendre: { id: 'camo_cendre', kind: 'camo', name: 'Camouflage Cendre', desc: 'Gris de cendre et éclats de braise, en souvenir de l’opération Cendres. S’applique à toutes les armes.' },
  camo_glacier: { id: 'camo_glacier', kind: 'camo', name: 'Camouflage Glacier', desc: 'Motif numérique blanc et bleu glacier du massif de Valmorre. S’applique à toutes les armes.' },
  camo_fracture: { id: 'camo_fracture', kind: 'camo', name: 'Camouflage Fracture', desc: 'Violet profond parcouru de veines lumineuses. Premium. S’applique à toutes les armes.' },
  camo_fondateur: { id: 'camo_fondateur', kind: 'camo', name: 'Camouflage Fondateur', desc: 'Noir mat et filets dorés. Exclusif au Pack Fondateur.' },
  outfit_fondateur: { id: 'outfit_fondateur', kind: 'outfit', name: 'Tenue Fondateur', desc: 'Tenue d’opérateur bleu nuit à pièces dorées. En 4v4, la couleur d’équipe reste imposée sur la tenue et la visière.' },
  emblem_fondateur: { id: 'emblem_fondateur', kind: 'emblem', name: 'Emblème Fondateur', desc: 'Écu doré frappé du W de WARBOUND.' },
  card_fondateur: { id: 'card_fondateur', kind: 'card', name: 'Carte de visite Fondateur', desc: 'Bandeau doré « Fondateur WARBOUND ».' },
  badge_fondateur: { id: 'badge_fondateur', kind: 'badge', name: 'Badge Fondateur', desc: 'Badge permanent affiché dans les salons multijoueurs et sur votre profil.' },
};

export const COS_PRODUCTS: CosProduct[] = [
  { sku: 'camo_cendre', name: 'Camouflage Cendre', category: 'camo', premium: false, demoPriceCents: 199, items: ['camo_cendre'], desc: COS_ITEMS.camo_cendre.desc },
  { sku: 'camo_glacier', name: 'Camouflage Glacier', category: 'camo', premium: false, demoPriceCents: 199, items: ['camo_glacier'], desc: COS_ITEMS.camo_glacier.desc },
  { sku: 'camo_fracture', name: 'Camouflage Fracture', category: 'camo', premium: true, demoPriceCents: 499, items: ['camo_fracture'], desc: COS_ITEMS.camo_fracture.desc },
  { sku: 'pack_fondateur', name: 'Pack Fondateur', category: 'pack', premium: true, demoPriceCents: 999, items: ['outfit_fondateur', 'camo_fondateur', 'emblem_fondateur', 'badge_fondateur', 'card_fondateur'], desc: 'Soutenez le développement de WARBOUND. Contenu : tenue d’opérateur exclusive, camouflage d’arme exclusif, emblème, badge permanent et carte de visite. Aucun avantage de jeu.' },
];

export const SLOT_OF: Record<string, CosSlot | null> = Object.fromEntries(Object.values(COS_ITEMS).map((i) => [i.id, i.kind === 'badge' ? null : i.kind])) as Record<string, CosSlot | null>;

export function euros(cents: number): string { return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }); }
