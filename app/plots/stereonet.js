// @ts-check
/*
Grafik 1: Schmidtsches Netz (flächentreu, untere Halbkugel, Nord oben) als SVG-Text.
Bildschirm: Farben über CSS-Variablen (style.css). Export: feste Farben (siehe svg.js).
*/
import { esc, fmtAngle, fmtOrientation } from '../format.js';
import { n, pathData, sty, groupAttrs, haloText } from './svg.js';

/** @typedef {import('../model.js').Model} Model */
/** @typedef {import('./svg.js').Mode} Mode */

const MARGIN = 30;
const ARROW_LEN = 14;
const ARROW_HALF = 5;

/**
 * Inhalt des Netzes ohne <svg>-Hülle.
 * @param {Model} model
 * @param {number} width Breite in px
 * @param {Mode} mode
 * @returns {{width: number, height: number, body: string}}
 */
export function stereonetContent(model, width, mode) {
  const screen = mode === 'screen';
  const w = Math.max(240, Math.floor(width));
  const R = (w - 2 * MARGIN) / 2;
  const h = 2 * R + 2 * MARGIN;
  const cx = MARGIN + R;
  const cy = MARGIN + R;
  /** @param {{x: number, y: number}} p */
  const px = (p) => ({ x: cx + p.x * R, y: cy - p.y * R });
  /** @param {Array<{x: number, y: number}>} pts */
  const path = (pts) => pathData(pts.map(px));

  const out = [];

  // 10°-Raster: Meridiane und Kleinkreise in einem Pfad
  const gridD = [...model.grid.meridians, ...model.grid.smallCircles].map((c) => path(c.points)).join('');
  out.push(`<path ${sty(mode, 'grid')} d="${gridD}"/>`);
  out.push(`<circle ${sty(mode, 'rim')} cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}"/>`);

  // Himmelsrichtungen
  const card = sty(mode, 'cardinal');
  out.push(`<text ${card} x="${n(cx)}" y="${n(cy - R - 10)}" dy="0.35em" text-anchor="middle">N</text>`);
  out.push(`<text ${card} x="${n(cx)}" y="${n(cy + R + 10)}" dy="0.35em" text-anchor="middle">S</text>`);
  out.push(`<text ${card} x="${n(cx + R + 10)}" y="${n(cy)}" dy="0.35em" text-anchor="start">E</text>`);
  out.push(`<text ${card} x="${n(cx - R - 10)}" y="${n(cy)}" dy="0.35em" text-anchor="end">W</text>`);

  // Tunnellinie: von A + 180° nach A, Pfeilspitze bei A
  if (model.tunnel && model.azimuth !== null) {
    const [head, tail] = model.tunnel; // head = Richtung A, tail = A + 180°
    const P = px(head);
    const T = px(tail);
    const d = { x: (P.x - cx) / R, y: (P.y - cy) / R }; // Einheitsrichtung im Bild
    const perp = { x: -d.y, y: d.x };
    const base = { x: P.x - d.x * ARROW_LEN, y: P.y - d.y * ARROW_LEN };
    const l = { x: base.x + perp.x * ARROW_HALF, y: base.y + perp.y * ARROW_HALF };
    const r = { x: base.x - perp.x * ARROW_HALF, y: base.y - perp.y * ARROW_HALF };
    out.push(screen ? '<g class="tunnel">' : '<g>');
    out.push(`<line ${sty(mode, 'tunnel-line')} x1="${n(T.x)}" y1="${n(T.y)}" x2="${n(base.x)}" y2="${n(base.y)}"/>`);
    out.push(`<path ${sty(mode, 'tunnel-head')} d="M${n(P.x)} ${n(P.y)}L${n(l.x)} ${n(l.y)}L${n(r.x)} ${n(r.y)}Z"/>`);
    // Beschriftung entlang der Linie am Anfang (A + 180°), in Tunnelrichtung lesbar;
    // die Pfeilspitze bleibt frei (dort liegen oft die Pole)
    const flip = d.x < -1e-9;
    let rot = (Math.atan2(d.y, d.x) * 180) / Math.PI;
    if (flip) rot += 180;
    const Q = { x: T.x + d.x * 10, y: T.y + d.y * 10 };
    out.push(haloText(mode, 'tunnel-label', 0,
      `transform="translate(${n(Q.x)} ${n(Q.y)}) rotate(${n(rot)})" y="-5" text-anchor="${flip ? 'end' : 'start'}"`,
      `Tunnel ${esc(fmtAngle(model.azimuth))}°`));
    out.push('</g>');
  }

  // Klüfte: Grosskreis, Pol, Beschriftung
  for (const j of model.joints) {
    if (!j.netValid || !j.circle || !j.pole) continue;
    const tip = [j.name.trim() || `Joint ${j.index + 1}`, `Dip direction/dip: ${fmtOrientation(j.dipDirection, j.dip)}`];
    const pp = px(j.pole);
    const left = pp.x >= cx; // Beschriftung zur Netzmitte hin, damit sie im Bild bleibt
    out.push(`<g ${groupAttrs(mode, 'joint', j.index, tip)}>`);
    out.push(`<path ${sty(mode, 'gc', j.index)} d="${path(j.circle)}"/>`);
    if (screen) out.push(`<path class="hit" d="${path(j.circle)}"/>`);
    out.push(`<circle ${sty(mode, 'pole', j.index)} cx="${n(pp.x)}" cy="${n(pp.y)}" r="5"/>`);
    if (screen) out.push(`<circle class="hit-pole" cx="${n(pp.x)}" cy="${n(pp.y)}" r="11"/>`);
    out.push(haloText(mode, 'plabel', j.index,
      `x="${n(pp.x + (left ? -9 : 9))}" y="${n(pp.y + 4)}" text-anchor="${left ? 'end' : 'start'}"`,
      esc(j.label)));
    out.push('</g>');
  }

  return { width: w, height: h, body: out.join('') };
}

/**
 * @param {Model} model
 * @param {number} width Breite in px
 * @returns {string} SVG-Element für die Seite
 */
export function renderStereonet(model, width) {
  const c = stereonetContent(model, width, 'screen');
  return `<svg class="net" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(c.width)} ${n(c.height)}" width="${n(c.width)}" height="${n(c.height)}" role="img" aria-label="Stereonet, equal area, lower hemisphere">${c.body}</svg>`;
}
