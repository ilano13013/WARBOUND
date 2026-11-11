// Icônes vectorielles des compétences (trait, couleur héritée). Remplacent les emoji de la 1.0.
const P: Record<string, string> = {
  ember: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 2 4 1-2 1-4 1-7z"/><path d="M12 14c1 1 2 2 2 3a2 2 0 0 1-4 0c0-1 1-2 2-3z"/>',
  dash: '<path d="M4 6l6 6-6 6M11 6l6 6-6 6M18 6v12"/>',
  aegis: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M12 7v10M8 11h8"/>',
  inferno: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
  armor: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 8l4 2.2v4.6L12 17l-4-2.2v-4.6z"/>',
  shockwave: '<circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/>',
  fortress: '<path d="M3 20h18M5 20v-6a7 7 0 0 1 14 0v6"/><path d="M9 20v-4h6v4M12 7V4"/>',
  colossus: '<path d="M6 21V9l-2-2V3h4v2h2V3h4v2h2V3h4v4l-2 2v12z"/><path d="M10 21v-5h4v5"/>',
  pulse: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/>',
  meddrone: '<rect x="8" y="9" width="8" height="6" rx="2"/><path d="M3 7h5M16 7h5M5.5 7v2M18.5 7v2M12 11v2M11 12h2"/>',
  regenfield: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/><path d="M5 18c2-1 3-3 3-5"/>',
  rebirth: '<path d="M12 21V11"/><path d="M12 11C9 5 4 6 3 9c3 0 6 1 9 2zM12 11c3-6 8-5 9-2-3 0-6 1-9 2z"/><circle cx="12" cy="6" r="2"/>',
  cloak: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20L20 4"/>',
  blink: '<path d="M3 12h4M8 12h3"/><path d="M14 6l6 6-6 6"/><circle cx="5" cy="12" r="1"/>',
  mark: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1.5"/>',
  execute: '<path d="M12 3c-4 0-7 3-7 7 0 2 1 4 3 5v3h8v-3c2-1 3-3 3-5 0-4-3-7-7-7z"/><circle cx="9.5" cy="10.5" r="1.5"/><circle cx="14.5" cy="10.5" r="1.5"/><path d="M10 18v3M14 18v3"/>',
  chain: '<path d="M13 2L5 13h6l-2 9 9-12h-6z"/>',
  gravity: '<path d="M12 12m-1 0a1 1 0 1 0 2 0a3 3 0 1 0-6 0a5 5 0 1 0 10 0a7 7 0 1 0-14 0a9 9 0 1 0 18 0"/>',
  overcharge: '<circle cx="12" cy="12" r="9"/><path d="M13 5l-5 8h4l-1 6 5-8h-4z"/>',
  storm: '<path d="M6 14a4 4 0 0 1 0-8 6 6 0 0 1 11.5 1A3.5 3.5 0 0 1 17 14z"/><path d="M12 14l-2 4h3l-2 4"/>',
  scout: '<circle cx="12" cy="12" r="9"/><path d="M12 12L18 6"/><path d="M12 7a5 5 0 1 0 5 5"/><circle cx="16" cy="15" r="1"/>',
  trap: '<path d="M3 16h18"/><path d="M5 16l2-6 2 6 2-6 2 6 2-6 2 6 2-6"/><path d="M3 20h18"/>',
  companion: '<path d="M4 7l3 2 2-5 3 4 3-4 2 5 3-2-1 8c-1 4-4 6-7 6s-6-2-7-6z"/><circle cx="9.5" cy="12" r="1"/><circle cx="14.5" cy="12" r="1"/>',
  hunt: '<circle cx="7" cy="9" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="9" r="2"/><path d="M8 18c0-3 2-6 4-6s4 3 4 6c0 2-2 2-4 2s-4 0-4-2z"/>',
  grenade: '<circle cx="12" cy="14" r="6"/><path d="M10 8V5h4v3M14 5l3-2M9 14h6M12 11v6"/>',
};
export function icon(id: string, size = 28): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[id] || P.mark}</svg>`;
}
