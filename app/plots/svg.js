// @ts-check
/*
Hilfen für SVG-Text. Die Grafiken werden als Zeichenketten gebaut (keine DOM-Zugriffe).
Zwei Darstellungsarten (mode):
- 'screen': Klassen, die style.css mit CSS-Variablen füllt (Theme, Hover).
- 'export': eigenständiges SVG mit festen Farben als Präsentationsattribute, helles
  Schema, ohne Klassen, CSS-Variablen, Hover-Elemente oder Texteffekte, die andere
  Programme nicht kennen.
*/
import { esc } from '../format.js';

/** @typedef {'screen'|'export'} Mode */

/** Feste Farben des Exports (helles Schema, entsprechen den Werten in style.css). */
export const EXPORT_COLORS = {
  text: '#1c1b19',
  muted: '#5f5c55',
  net: '#cdc9c0',
  netRim: '#6f6b63',
  frame: '#8a867d',
  white: '#ffffff',
  profileFill: '#5f5c55',
  joints: ['#2f9e44', '#d9363e', '#2563eb', '#e8730c', '#0d9488'],
  tunnel: '#7c3aed',
};

/** Allgemeine Sans-Serif für den Export. */
export const EXPORT_FONT = 'Arial, Helvetica, sans-serif';

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

/**
 * Feste Kluftfarbe des Exports.
 * @param {number} index
 * @returns {string}
 */
export function jointColor(index) {
  return EXPORT_COLORS.joints[index % 5];
}

/**
 * Stil eines Elements: Klasse (screen) oder Präsentationsattribute (export).
 * Die Kluftfarbe kommt im Bildschirm von der Gruppe (--c), im Export aus `j`.
 * @param {Mode} mode
 * @param {string} kind
 * @param {number} [j] Kluftindex
 * @returns {string}
 */
export function sty(mode, kind, j = 0) {
  if (mode === 'screen') return kind.startsWith('scalebar-') ? '' : `class="${kind}"`;
  const C = EXPORT_COLORS;
  const jc = jointColor(j);
  switch (kind) {
    case 'grid': return `fill="none" stroke="${C.net}" stroke-width="1"`;
    case 'rim': return `fill="none" stroke="${C.netRim}" stroke-width="1.5"`;
    case 'cardinal': return `font-size="13" font-weight="700" fill="${C.text}"`;
    case 'tunnel-line': return `stroke="${C.tunnel}" stroke-width="2.5"`;
    case 'tunnel-head': return `fill="${C.tunnel}" stroke="${C.tunnel}" stroke-width="1" stroke-linejoin="round"`;
    case 'tunnel-label': return `font-size="12" font-weight="600" fill="${C.tunnel}"`;
    case 'gc': return `fill="none" stroke="${jc}" stroke-width="2"`;
    case 'pole': return `fill="${jc}" stroke="${C.white}" stroke-width="1.5"`;
    case 'plabel': return `font-size="12" font-weight="600" fill="${jc}"`;
    case 'frame': return `fill="${C.white}" stroke="${C.frame}" stroke-width="1"`;
    case 'trace': return `fill="none" stroke="${jc}" stroke-width="1.5"`;
    case 'profile': return `fill="${C.profileFill}" fill-opacity="0.13" stroke="${C.text}" stroke-width="3.5" stroke-linejoin="round"`;
    case 'side': return `font-size="12" font-weight="600" fill="${C.muted}"`;
    case 'scalebar-path': return `fill="none" stroke="${C.text}" stroke-width="1.5"`;
    case 'scalebar-text': return `font-size="12" fill="${C.text}"`;
    default: return '';
  }
}

/**
 * Attribute der Kluftgruppe: Bildschirm mit Klasse, Farbvariable und Hover-Text, Export ohne alles.
 * @param {Mode} mode
 * @param {string} kind 'joint' | 'set'
 * @param {number} j
 * @param {string[]} tip
 * @returns {string}
 */
export function groupAttrs(mode, kind, j, tip) {
  if (mode === 'export') return '';
  return `class="${kind}" style="--c:${jointColorVar(j)}" ${tipAttr(tip)}`;
}

/**
 * Text mit hellem Rand für bessere Lesbarkeit. Bildschirm: CSS (paint-order). Export:
 * eine weisse Kopie darunter (paint-order kennen nicht alle Programme).
 * @param {Mode} mode
 * @param {string} kind
 * @param {number} j
 * @param {string} attrs Position, Ausrichtung, Transformation
 * @param {string} content bereits maskierter Text
 * @returns {string}
 */
export function haloText(mode, kind, j, attrs, content) {
  const main = `<text ${sty(mode, kind, j)} ${attrs}>${content}</text>`;
  if (mode === 'screen') return main;
  const bold = kind === 'cardinal' ? '700' : '600';
  const halo = `<text ${attrs} font-size="12" font-weight="${bold}" fill="${EXPORT_COLORS.white}" stroke="${EXPORT_COLORS.white}" stroke-width="3" stroke-linejoin="round">${content}</text>`;
  return halo + main;
}
