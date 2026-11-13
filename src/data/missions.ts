// Définition des opérations de la campagne, des textes de narration et des documents à découvrir.

export interface MissionDef {
  id: string;
  num: number;
  name: string;
  location: string;
  briefing: string[];
  objectives: string[];
  xp: number;
  level: number; // niveau conseillé
  requires: string | null;
  boss?: string;
  bossLoot?: string;
  theme: number;
  duration: string;
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'op1', num: 1, name: 'CENDRES', location: 'Complexe de recherche HELIX — Site Cendres',
    briefing: [
      'Il y a onze jours, le Site Cendres a cessé d’émettre. HELIX y menait ses expériences de fusion entre technologie militaire et énergie de la Fracture.',
      'Les drones de reconnaissance montrent des soldats HELIX encore debout… mais plus tout à fait humains. Nous les appelons les Corrompus.',
      'Infiltrez le complexe, rétablissez l’alimentation, récupérez les données du laboratoire et détruisez les conduits qui nourrissent la contamination.',
    ],
    objectives: ['Atteindre le complexe', 'Neutraliser les Corrompus', 'Réactiver l’alimentation', 'Récupérer les données', 'Détruire les conduits', 'Vaincre le Gardien d’Helix', 'Extraire les données'],
    xp: 1500, level: 1, requires: null, boss: 'Le Gardien d’Helix', bossLoot: 'boss_guardian', theme: 0, duration: '15–20 min',
  },
  {
    id: 'op2', num: 2, name: 'VILLE MORTE', location: 'Varsen — district central',
    briefing: [
      'Les données de Cendres sont formelles : HELIX a ouvert un portail sous la ville de Varsen. Quatre cent mille habitants. L’évacuation a échoué.',
      'Un signal de détresse émet depuis le métro : le Dr Lena Marek, ancienne chercheuse HELIX, et une poignée de survivants.',
      'Sécurisez la zone d’insertion, traversez les rues, tenez la position le temps de l’évacuation, puis détruisez le portail qui déverse l’Essaim.',
    ],
    objectives: ['Sécuriser la zone d’insertion', 'Traverser les rues', 'Localiser les survivants', 'Défendre la position', 'Détruire le portail', 'Atteindre l’extraction'],
    xp: 2000, level: 4, requires: 'op1', theme: 1, duration: '12–18 min',
  },
  {
    id: 'op3', num: 3, name: 'TEMPLE DU VOILE', location: 'Structure inconnue — Fracture de Kessler',
    briefing: [
      'Le Dr Marek a parlé. HELIX n’agissait pas seul : l’Ordre du Voile, une secte de mages, guide le directeur Voss depuis le début.',
      'Un temple a traversé la Fracture de Kessler. Il renferme la Clé du Voile, un artefact capable de sceller une Fracture… ou de l’ouvrir à jamais.',
      'Traversez les ruines, brisez les protections et prenez la Clé avant Voss. L’Archonte de l’Ordre vous attend.',
    ],
    objectives: ['Traverser les ruines', 'Activer les trois sceaux', 'Éliminer les gardiens', 'Détruire les cristaux protecteurs', 'Vaincre l’Archonte du Voile', 'Récupérer la Clé du Voile'],
    xp: 2800, level: 8, requires: 'op2', boss: 'L’Archonte du Voile', bossLoot: 'boss_archon', theme: 2, duration: '15–20 min',
  },
  {
    id: 'op4', num: 4, name: 'POINT ZÉRO', location: 'Épicentre de la Fracture — Installation HELIX Prime',
    briefing: [
      'Nous avons la Clé. Voss, lui, a déjà franchi le seuil : au cœur de Point Zéro, il fusionne avec la Fracture pour devenir ce que l’Ordre appelle le Souverain.',
      'Trois stabilisateurs maintiennent la Fracture ouverte. Coupez-les, traversez la zone altérée et atteignez le noyau.',
      'C’est la dernière opération, Warbound. Scellez la Fracture. Quoi qu’il en coûte.',
    ],
    objectives: ['Franchir les défenses HELIX', 'Désactiver trois stabilisateurs', 'Traverser la zone altérée', 'Survivre à la contre-attaque', 'Entrer dans le noyau', 'Vaincre le Souverain Fracturé', 'Stabiliser la Fracture'],
    xp: 4000, level: 12, requires: 'op3', boss: 'Le Souverain Fracturé', bossLoot: 'boss_sovereign', theme: 3, duration: '20–25 min',
  },
  {
    id: 'op5', num: 5, name: 'LIGNE DE CRÊTE', location: 'Barrage hydroélectrique de Valmorre — massif alpin',
    briefing: [
      'Point Zéro est scellée. Mais le colonel Halvard, dernier officier d’HELIX, a replié ses unités d’élite sur le barrage de Valmorre.',
      'La centrale alimente un relais qui émet la signature de la Fracture : Halvard y a branché un fragment de la Clé pour rouvrir une brèche.',
      'Remontez la vallée sous le feu de ses tireurs d’élite, fermez les vannes de la centrale, puis prenez la crête et coupez le relais.',
    ],
    objectives: ['Atteindre le poste de contrôle', 'Neutraliser les tireurs d’élite', 'Entrer dans la salle des turbines', 'Fermer les trois vannes', 'Tenir pendant la purge', 'Monter sur la crête', 'Prendre la crête', 'Couper le relais Souverain', 'Rejoindre l’extraction'],
    xp: 4500, level: 14, requires: 'op4', theme: 4, duration: '15–20 min',
  },
];

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

export interface LoreDef { id: string; title: string; kind: 'Journal audio' | 'Terminal' | 'Document'; text: string }

export const LORE: Record<string, LoreDef> = {
  op5_log1: { id: 'op5_log1', kind: 'Journal audio', title: 'Sergent-chef Varga — perchoir 3', text: '« Halvard veut qu’on tire et qu’on bouge. Un tir, deux au plus, puis on change de rocher. Le reflet de la lunette nous trahit, alors on ne reste jamais assez longtemps pour qu’ils le voient deux fois. Il pleut depuis six jours. Le barrage chante, la nuit. Je n’aime pas ce chant. »' },
  op5_term1: { id: 'op5_term1', kind: 'Terminal', title: 'Centrale de Valmorre — consignes', text: 'PROTOCOLE DE PURGE\n1. Fermer les vannes des trois groupes.\n2. Attendre la vidange des conduites forcées (40 s).\n3. Ne pas rester sur les passerelles pendant la purge.\n\nNote manuscrite : « Le relais de la crête ne doit JAMAIS manquer de courant. Ordre du colonel. »' },
  op5_doc1: { id: 'op5_doc1', kind: 'Document', title: 'Ordre du colonel Halvard', text: 'À toutes les unités,\n\nVoss a échoué parce qu’il voulait devenir la porte. Nous ne ferons pas cette erreur : nous ne la franchirons pas, nous la louerons. Dix-sept Fractures, dix-sept gouvernements prêts à payer pour qu’on les referme, ou qu’on les ouvre chez leurs voisins.\n\nTenez la crête.\n\n— Col. E. Halvard' },
  op1_log1: { id: 'op1_log1', kind: 'Journal audio', title: 'Sergent Kovac — dernier rapport', text: '« …ils ne dorment plus. Les gars de l’aile est restent debout dans le noir à fixer le mur du labo. Hier, Dietrich a arraché sa plaque d’identité en disant que ce nom n’était plus le sien. Le directeur Voss dit que c’est une “acclimatation”. Moi je dis qu’on devrait brûler cet endroit. »' },
  op1_term1: { id: 'op1_term1', kind: 'Terminal', title: 'Projet SOUVERAIN — note interne', text: 'DE : Dir. A. Voss\nÀ : Équipe Fusion\n\nLes sujets de la série 4 conservent leurs réflexes de combat après exposition. La cohésion mentale se dégrade, mais l’obéissance au signal du noyau est totale. C’est un progrès.\n\nNos partenaires du Voile ont raison : la Fracture ne détruit pas. Elle réécrit. Préparez le caisson Souverain pour un sujet volontaire. Ce sera moi.' },
  op1_doc1: { id: 'op1_doc1', kind: 'Document', title: 'Bon de transfert — Varsen', text: 'HELIX LOGISTIQUE\nDestination : Varsen, station de métro Kellner, niveau -4.\nContenu : 12 émetteurs de résonance, 1 ancre dimensionnelle.\nMention manuscrite : « La ville ne doit pas être prévenue. Ordre direct de V. »' },
  op2_log1: { id: 'op2_log1', kind: 'Journal audio', title: 'Message d’une habitante', text: '« Si quelqu’un trouve ça… on est descendus dans le métro quand le ciel s’est fendu. Les soldats avec l’hélice sur l’épaule nous ont dit de rester calmes. Puis ils ont scellé les grilles. De l’extérieur. Je crois qu’ils voulaient qu’on soit là quand ça s’ouvrirait. »' },
  op2_term1: { id: 'op2_term1', kind: 'Terminal', title: 'Dr Lena Marek — notes personnelles', text: 'J’ai signé pour étudier une source d’énergie. Pas pour nourrir une porte.\n\nL’Essaim n’est pas une armée. C’est un système immunitaire. La Fracture est une plaie entre deux mondes, et ces créatures viennent la “nettoyer” — nous compris.\n\nVoss le sait. L’Ordre du Voile lui a promis qu’un être assez fort pourrait commander à l’Essaim au lieu de le subir. Il leur faut la Clé du temple de Kessler pour achever le rituel.' },
  op2_doc1: { id: 'op2_doc1', kind: 'Document', title: 'Tract de l’Ordre du Voile', text: 'LE VOILE SE LÈVE.\n\nVous appelez cela une catastrophe. Nous l’appelons une naissance. Le vieux monde était un monde sourd : la Fracture lui rend l’ouïe.\n\nNe fuyez pas. Ne combattez pas. Ceux qui acceptent le changement seront les premiers citoyens de ce qui vient.' },
  op3_log1: { id: 'op3_log1', kind: 'Journal audio', title: 'Éclaireur Aegis — équipe Lanterne', text: '« Lanterne-2 au commandement. Le temple n’a pas été construit, il a… poussé. Les murs réagissent quand on parle. On a trouvé des gravures : une silhouette couronnée debout dans une plaie du ciel. Et autour, des milliers de petites formes à genoux. On ne reste pas. Répétez : on ne reste p— »' },
  op3_term1: { id: 'op3_term1', kind: 'Document', title: 'Inscription traduite', text: '« Quand la plaie s’ouvrira entre les mondes, un Souverain s’y tiendra. S’il porte la Clé, la plaie deviendra une porte et il en sera le gardien éternel. Si la Clé est tournée contre lui, la plaie se refermera et le Souverain avec elle. »\n\n— Traduction automatique, fiabilité 71 %' },
  op3_doc1: { id: 'op3_doc1', kind: 'Journal audio', title: 'L’Archonte — sermon gravé', text: '« Voss croit qu’il nous utilise. Laissons-le croire. Le Souverain n’est qu’une serrure faite chair ; peu importe quelle main la tourne. Quand la porte sera ouverte, ce n’est pas lui que l’autre côté viendra saluer. »' },
  op4_log1: { id: 'op4_log1', kind: 'Journal audio', title: 'Voss — avant le caisson', text: '« On me traitera de monstre. Qu’ils regardent leurs cartes : dix-sept Fractures, et elles s’élargissent. Dans trois ans, il n’y aura plus de nations à défendre. J’ai choisi de devenir quelque chose qui peut tenir la porte. Si le prix est mon nom, mon visage, cette ville… alors c’est un prix modeste. »' },
  op4_term1: { id: 'op4_term1', kind: 'Terminal', title: 'Journal du noyau — dernière entrée', text: 'CYCLE 4471 — Le sujet V. ne répond plus à son nom.\nCYCLE 4475 — Le sujet émet le signal du noyau au lieu de le recevoir.\nCYCLE 4480 — Les stabilisateurs ne retiennent plus la Fracture. C’est le sujet qui la retient. Ou l’inverse.\nCYCLE 4481 — Quelque chose a répondu de l’autre côté.' },
  op4_doc1: { id: 'op4_doc1', kind: 'Document', title: 'Lettre non envoyée', text: 'Lena,\n\nTu avais raison de partir. Je garde ta lettre de démission dans ma poche ; c’est la dernière chose honnête qu’on m’ait écrite.\n\nSi tu lis ceci, c’est que la Coalition est arrivée jusqu’ici. Dis-leur de viser juste. Je ne suis pas certain que ce qui restera de moi les laissera une seconde chance.\n\n— Aldric' },
};
