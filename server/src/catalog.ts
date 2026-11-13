// Catalogue de la boutique : la SEULE source des prix. Le navigateur n'envoie jamais un prix, seulement un identifiant.
// Prix en centimes d'euro, TTC. Tous les objets sont purement cosmétiques (aucun effet sur le jeu).

export type ItemKind = 'camo' | 'outfit' | 'emblem' | 'card' | 'badge';
export interface Product { sku: string; name: string; priceCents: number; grants: { id: string; kind: ItemKind }[] }

export const PRODUCTS: Record<string, Product> = {
  camo_cendre: { sku: 'camo_cendre', name: 'Camouflage Cendre (toutes armes)', priceCents: 199, grants: [{ id: 'camo_cendre', kind: 'camo' }] },
  camo_glacier: { sku: 'camo_glacier', name: 'Camouflage Glacier (toutes armes)', priceCents: 199, grants: [{ id: 'camo_glacier', kind: 'camo' }] },
  camo_fracture: { sku: 'camo_fracture', name: 'Camouflage Fracture — premium (toutes armes)', priceCents: 499, grants: [{ id: 'camo_fracture', kind: 'camo' }] },
  pack_fondateur: {
    sku: 'pack_fondateur', name: 'Pack Fondateur WARBOUND', priceCents: 999,
    grants: [
      { id: 'outfit_fondateur', kind: 'outfit' }, { id: 'camo_fondateur', kind: 'camo' }, { id: 'emblem_fondateur', kind: 'emblem' },
      { id: 'badge_fondateur', kind: 'badge' }, { id: 'card_fondateur', kind: 'card' },
    ],
  },
};

/** Objet -> emplacement d'équipement (le badge est permanent, il ne s'équipe pas). */
export const ITEM_SLOT: Record<string, 'camo' | 'outfit' | 'emblem' | 'card' | null> = {};
for (const p of Object.values(PRODUCTS)) for (const g of p.grants) ITEM_SLOT[g.id] = g.kind === 'badge' ? null : g.kind;
