// Documents légaux affichés dans le jeu, lus directement depuis docs/legal/*.md (une seule source à tenir à jour).
import mentions from '../../docs/legal/MENTIONS-LEGALES.md?raw';
import cgv from '../../docs/legal/CGV.md?raw';
import privacy from '../../docs/legal/CONFIDENTIALITE.md?raw';
import { esc } from './UI';

export type LegalDoc = 'mentions' | 'cgv' | 'privacy';
export const LEGAL: Record<LegalDoc, { title: string; md: string }> = {
  mentions: { title: 'Mentions légales', md: mentions },
  cgv: { title: 'Conditions générales de vente', md: cgv },
  privacy: { title: 'Politique de confidentialité', md: privacy },
};

/** Conversion Markdown -> HTML limitée à ce qu'utilisent ces documents (titres, listes, tableaux, gras, italique, citations). */
export function mdToHtml(md: string): string {
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>');
  const out: string[] = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,3} /.test(l)) { const n = l.match(/^#+/)![0].length; out.push(`<h${n + 1}>${inline(l.slice(n + 1))}</h${n + 1}>`); continue; }
    if (l.startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) { if (!/^\|\s*-/.test(lines[i])) rows.push(lines[i]); i++; }
      i--;
      out.push(`<table class="board">${rows.map((r, k) => `<tr>${r.split('|').slice(1, -1).map((c) => `<${k ? 'td' : 'th'}>${inline(c.trim())}</${k ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table>`);
      continue;
    }
    if (l.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(`<li>${inline(lines[i].slice(2))}</li>`); i++; }
      i--;
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (l.startsWith('> ')) { out.push(`<blockquote>${inline(l.slice(2))}</blockquote>`); continue; }
    if (l.trim()) out.push(`<p>${inline(l)}</p>`);
  }
  return out.join('');
}
