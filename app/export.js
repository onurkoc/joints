// @ts-check
/*
Export der Grafiken als eigenständiges SVG (ohne DOM, reine Funktionen).
Immer helles Schema auf weissem Grund, feste Farben, allgemeine Sans-Serif, kein Hover-Text.
Das Bild enthält Titel, Tunnelrichtung und eine Legende; beim Querschnitt zusätzlich
scheinbares Fallen, Seite und scheinbaren Abstand je Kluft sowie B und H.
*/
import { esc, fmtAngle, fmtApparentDip, fmtLength, fmtMetres } from './format.js';
import { stereonetContent } from './plots/stereonet.js';
import { sectionContent } from './plots/section.js';
import { n, EXPORT_COLORS, EXPORT_FONT, jointColor } from './plots/svg.js';
import { noteFor } from './ui/results.js';

/** @typedef {import('./model.js').Model} Model */

/**
 * @typedef {Object} Panel
 * @property {number} width
 * @property {number} height
 * @property {string} body
 */

/**
 * @typedef {Object} ExportImage
 * @property {string} svg vollständiges SVG-Dokument
 * @property {number} width
 * @property {number} height
 */

const MARGIN = 28;
const GAP = 40;
const CHAR = 6.8; // mittlere Zeichenbreite bei 12 px, für Spaltenbreiten der Legende

/**
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {string} content bereits maskiert
 * @param {{weight?: string, fill?: string}} [o]
 */
function text(x, y, size, content, o = {}) {
  const w = o.weight ? ` font-weight="${o.weight}"` : '';
  return `<text x="${n(x)}" y="${n(y)}" font-size="${size}"${w} fill="${o.fill ?? EXPORT_COLORS.text}">${content}</text>`;
}

/**
 * Kopf eines Bildes: Titel und Untertitel.
 * @param {string} title
 * @param {string} subtitle
 */
function head(title, subtitle) {
  return text(0, 18, 17, esc(title), { weight: '700' }) + text(0, 38, 12, esc(subtitle), { fill: EXPORT_COLORS.muted });
}

/** Höhe des Kopfes bis zur Grafik. */
const HEAD_H = 48;

/**
 * Panel Schmidtsches Netz mit Titel, Tunnelrichtung und Legende.
 * @param {Model} model
 * @param {number} contentWidth
 * @returns {Panel}
 */
function stereonetPanel(model, contentWidth) {
  const c = stereonetContent(model, contentWidth, 'export');
  const out = [];
  const A = model.azimuth;
  out.push(head('Stereonet – equal area, lower hemisphere',
    A === null ? 'Azimuth clockwise from north' : `Tunnel direction ${fmtAngle(A)}° · azimuth clockwise from north`));
  out.push(`<g transform="translate(0 ${HEAD_H})">${c.body}</g>`);
  let y = HEAD_H + c.height + 14;
  out.push(text(0, y + 12, 13, 'Joint sets', { weight: '700' }));
  y += 34;
  let maxChars = 0;
  for (const j of model.joints) {
    if (!j.netValid) continue;
    out.push(`<rect x="0" y="${n(y - 10)}" width="12" height="12" rx="2" fill="${jointColor(j.index)}"/>`);
    out.push(text(20, y, 12, esc(j.label)));
    maxChars = Math.max(maxChars, j.label.length);
    y += 20;
  }
  if (A !== null) {
    out.push(`<line x1="0" y1="${n(y - 4)}" x2="12" y2="${n(y - 4)}" stroke="${EXPORT_COLORS.tunnel}" stroke-width="2.5"/>`);
    out.push(text(20, y, 12, `Tunnel ${esc(fmtAngle(A))}°`, { fill: EXPORT_COLORS.tunnel, weight: '600' }));
    maxChars = Math.max(maxChars, `Tunnel ${fmtAngle(A)}°`.length);
    y += 20;
  }
  return { width: Math.max(c.width, 20 + maxChars * CHAR), height: y + 4, body: out.join('') };
}

/**
 * Panel Querschnitt mit Titel, B und H und Legende (scheinbares Fallen, Seite, Abstand je Kluft).
 * @param {Model} model
 * @param {number} contentWidth
 * @returns {Panel | null} null, wenn das Profil ungültig ist
 */
function sectionPanel(model, contentWidth) {
  const c = sectionContent(model, contentWidth, 'export');
  if (!c || !model.profile) return null;
  const { width: B, height: H } = model.profile;
  const A = model.azimuth;
  const out = [];
  out.push(head(A === null ? 'Cross-section – looking in tunnel direction' : `Cross-section – looking in tunnel direction (${fmtAngle(A)}°)`,
    `Horseshoe profile: B = ${fmtLength(B)} m, H = ${fmtLength(H)} m`));
  out.push(`<g transform="translate(0 ${HEAD_H})">${c.body}</g>`);
  let y = HEAD_H + c.height + 14;
  out.push(text(0, y + 12, 13, 'Joint sets', { weight: '700' }));
  y += 34;

  const rows = model.joints.filter((j) => j.netValid).map((j) => ({
    j,
    col2: j.dipApparent ? `apparent dip ${fmtApparentDip(j.dipApparent.value)} (${j.dipApparent.text})` : noteFor(j),
    col3: j.spacingApparent !== null ? `apparent spacing ${fmtMetres(j.spacingApparent)} m` : '',
    col4: j.dipApparent && j.truncated ? noteFor(j) : '',
  }));
  const x2 = 20 + Math.max(0, ...rows.map((r) => r.j.label.length)) * CHAR + 24;
  const x3 = x2 + Math.max(0, ...rows.map((r) => (r.j.dipApparent ? r.col2.length : 0))) * CHAR + 24;
  const x4 = x3 + Math.max(0, ...rows.map((r) => r.col3.length)) * CHAR + 24;
  let maxX = 20;
  for (const r of rows) {
    out.push(`<rect x="0" y="${n(y - 10)}" width="12" height="12" rx="2" fill="${jointColor(r.j.index)}"/>`);
    out.push(text(20, y, 12, esc(r.j.label)));
    out.push(text(x2, y, 12, esc(r.col2)));
    maxX = Math.max(maxX, x2 + r.col2.length * CHAR);
    if (r.col3) {
      out.push(text(x3, y, 12, esc(r.col3)));
      maxX = Math.max(maxX, x3 + r.col3.length * CHAR);
    }
    if (r.col4) {
      out.push(text(x4, y, 12, esc(r.col4), { fill: EXPORT_COLORS.muted }));
      maxX = Math.max(maxX, x4 + r.col4.length * CHAR);
    }
    y += 20;
  }
  const conv = 'Azimuth clockwise from north. tan β = tan α · sin(dip direction − A)';
  out.push(text(0, y + 8, 11, esc(conv), { fill: EXPORT_COLORS.muted }));
  maxX = Math.max(maxX, conv.length * 5.9);
  return { width: Math.max(c.width, maxX), height: y + 16, body: out.join('') };
}

/**
 * SVG-Dokument um fertige Panels.
 * @param {Panel[]} panels
 * @returns {ExportImage}
 */
function compose(panels) {
  let x = MARGIN;
  const bodies = [];
  for (const p of panels) {
    bodies.push(`<g transform="translate(${n(x)} ${MARGIN})">${p.body}</g>`);
    x += p.width + GAP;
  }
  const width = Math.ceil(x - GAP + MARGIN);
  const height = Math.ceil(2 * MARGIN + Math.max(...panels.map((p) => p.height)));
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${EXPORT_FONT}">`
    + `<rect width="${width}" height="${height}" fill="${EXPORT_COLORS.white}"/>`
    + bodies.join('')
    + '</svg>';
  return { svg, width, height };
}

/**
 * @param {Model} model
 * @returns {ExportImage}
 */
export function exportStereonet(model) {
  return compose([stereonetPanel(model, 560)]);
}

/**
 * @param {Model} model
 * @returns {ExportImage | null} null, wenn das Profil ungültig ist
 */
export function exportSection(model) {
  const p = sectionPanel(model, 720);
  return p ? compose([p]) : null;
}

/**
 * Netz links, Querschnitt rechts in einem Bild.
 * @param {Model} model
 * @returns {ExportImage | null} null, wenn das Profil ungültig ist
 */
export function exportBoth(model) {
  const s = sectionPanel(model, 640);
  if (!s) return null;
  return compose([stereonetPanel(model, 500), s]);
}
