// @ts-check
/*
Grafik 2: Tunnelquerschnitt senkrecht zur Tunnelachse (Blick in Tunnelrichtung) als SVG-Text.
Gleicher Massstab in beiden Richtungen. Alle Farben über CSS-Variablen (style.css).
*/
import { esc, fmtAzimuth3, fmtApparentDip, fmtMetres } from '../format.js';
import { n, pathData, tipAttr, jointColorVar } from './svg.js';

/** @typedef {import('../model.js').Model} Model */

const ML = 26; // Rand links/rechts für die Azimut-Beschriftung
const MT = 8;
const MB = 40; // unten: Massstabsbalken

/**
 * Schöne Länge (1, 2, 5 · 10^k) für den Massstabsbalken, höchstens `max`.
 * @param {number} max
 * @returns {number}
 */
export function niceLength(max) {
  const e = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [5, 2, 1]) if (m * e <= max) return m * e;
  return e;
}

/**
 * @param {Model} model
 * @param {number} width Breite in px
 * @returns {string} SVG-Element, oder ein Hinweis (HTML), wenn das Profil ungültig ist
 */
export function renderSection(model, width) {
  const prof = model.profile;
  if (!prof) {
    return '<p class="plot-msg">Invalid profile (width B, height H) – cross-section not drawn.</p>';
  }
  const w = Math.max(240, Math.floor(width));
  const { xmin, xmax, ymin, ymax } = prof.window;
  const s = (w - 2 * ML) / (xmax - xmin); // px je m, in beiden Richtungen
  const fw = (xmax - xmin) * s;
  const fh = (ymax - ymin) * s;
  const h = MT + fh + MB;
  /** @param {{x: number, y: number}} p */
  const px = (p) => ({ x: ML + (p.x - xmin) * s, y: MT + (ymax - p.y) * s });

  const out = [];
  out.push(`<svg class="section" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="${n(w)}" height="${n(h)}" role="img" aria-label="Cross-section of the tunnel with joint traces">`);
  out.push(`<defs><clipPath id="section-window"><rect x="${n(ML)}" y="${n(MT)}" width="${n(fw)}" height="${n(fh)}"/></clipPath></defs>`);
  out.push(`<rect class="frame" x="${n(ML)}" y="${n(MT)}" width="${n(fw)}" height="${n(fh)}"/>`);

  // Kluftspuren, je Schar eine Gruppe (Hover über die ganze Schar)
  out.push('<g clip-path="url(#section-window)">');
  for (const j of model.joints) {
    if (j.traces.length === 0) continue;
    const d = j.traces
      .map((t) => {
        const a = px({ x: t.x1, y: t.y1 });
        const b = px({ x: t.x2, y: t.y2 });
        return `M${n(a.x)} ${n(a.y)}L${n(b.x)} ${n(b.y)}`;
      })
      .join('');
    const lines = [j.label];
    if (j.dipApparent) lines.push(`Apparent dip: ${fmtApparentDip(j.dipApparent.value)} (${j.dipApparent.text})`);
    if (j.spacingApparent !== null) lines.push(`Apparent spacing: ${fmtMetres(j.spacingApparent)} m`);
    out.push(`<g class="set" style="--c:${jointColorVar(j.index)}" ${tipAttr(lines)}>`);
    out.push(`<path class="trace" d="${d}"/>`);
    out.push(`<path class="hit" d="${d}"/>`);
    out.push('</g>');
  }
  out.push('</g>');

  // Hufeisenprofil über den Spuren, Innenfläche leicht getönt
  out.push(`<path class="profile" d="${pathData(prof.outline.map(px), true)}"/>`);

  // Seiten: Azimut A − 90° links, A + 90° rechts
  if (model.azimuth !== null) {
    const midY = MT + fh / 2;
    out.push(`<text class="side" transform="translate(${n(ML - 8)} ${n(midY)}) rotate(-90)" text-anchor="middle">left (${fmtAzimuth3(model.azimuth - 90)}°)</text>`);
    out.push(`<text class="side" transform="translate(${n(ML + fw + 8)} ${n(midY)}) rotate(90)" text-anchor="middle">right (${fmtAzimuth3(model.azimuth + 90)}°)</text>`);
  }

  // Massstabsbalken in m
  const len = niceLength((xmax - xmin) / 5);
  const bx = ML;
  const by = MT + fh + 20;
  const bl = len * s;
  out.push('<g class="scalebar">');
  out.push(`<path d="M${n(bx)} ${n(by - 4)}V${n(by + 4)}M${n(bx)} ${n(by)}H${n(bx + bl)}M${n(bx + bl)} ${n(by - 4)}V${n(by + 4)}"/>`);
  out.push(`<text x="${n(bx + bl + 8)}" y="${n(by + 4)}">${esc(String(len))} m</text>`);
  out.push('</g>');

  out.push('</svg>');
  return out.join('');
}
