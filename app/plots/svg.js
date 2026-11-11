// @ts-check
// Hilfen für SVG-Text. Die Grafiken werden als Zeichenketten gebaut (keine DOM-Zugriffe).
import { esc } from '../format.js';

/**
 * Zahl für SVG, 2 Nachkommastellen.
 * @param {number} v
 * @returns {string}
 */
export function n(v) {
  return (Math.round(v * 100) / 100).toString();
}

/**
 * Pfaddaten einer Punktfolge in Bildkoordinaten.
 * @param {Array<{x: number, y: number}>} pts
 * @param {boolean} [close]
 * @returns {string}
 */
export function pathData(pts, close = false) {
  if (pts.length === 0) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${n(p.x)} ${n(p.y)}`).join('') + (close ? 'Z' : '');
}

/**
 * Attribut für den Hover-Text (Zeilen durch Zeilenumbruch getrennt).
 * @param {string[]} lines
 * @returns {string}
 */
export function tipAttr(lines) {
  return `data-tip="${esc(lines.join('\n')).replace(/\n/g, '&#10;')}"`;
}

/**
 * CSS-Variable der Kluftfarbe (Reihenfolge: grün, rot, blau, orange, türkis).
 * @param {number} index
 * @returns {string}
 */
export function jointColorVar(index) {
  return `var(--joint${(index % 5) + 1})`;
}
