// @ts-check
/*
Grafik 1: Schmidtsches Netz (flächentreu, untere Halbkugel, Nord oben) als SVG-Text.
Bildschirm: Farben über CSS-Variablen (style.css). Export: feste Farben (siehe svg.js).
Reihenfolge der Ebenen: Raster, Tunnellinie, Grosskreise und Pole, zuletzt alle Beschriftungen
(mit Halo), damit keine Linie einen Text durchstreicht.
*/
import { esc, fmtAngle, fmtOrientation } from '../format.js';
import { n, pathData, sty, groupAttrs, haloText, jointColorVar } from './svg.js';
import { placeLabels, estimateWidth, rotatedTextBox } from './labels.js';

/** @typedef {import('../model.js').Model} Model */
/** @typedef {import('./svg.js').Mode} Mode */

const MARGIN = 30;
const ARROW_LEN = 14;
const ARROW_HALF = 5;

/**
 * Geometrie des Netzes und Platz aller Beschriftungen (rein rechnerisch, ohne SVG-Text).
 * @param {Model} model
 * @param {number} width Breite in px
 */
export function netLayout(model, width) {
  const w = Math.max(240, Math.floor(width));
  const R = (w - 2 * MARGIN) / 2;
  const h = 2 * R + 2 * MARGIN;
  const cx = MARGIN + R;
  const cy = MARGIN + R;
  /** @param {{x: number, y: number}} p */
  const px = (p) => ({ x: cx + p.x * R, y: cy - p.y * R });

  /** Tunnellinie samt Beschriftung */
  let tunnel = null;
  /** @type {import('./labels.js').Box[]} */
  const obstacles = [];
  if (model.tunnel && model.azimuth !== null) {
    const [head, tail] = model.tunnel; // head = Richtung A, tail = A + 180°
    const P = px(head);
    const T = px(tail);
    const d = { x: (P.x - cx) / R, y: (P.y - cy) / R }; // Einheitsrichtung im Bild
    const perp = { x: -d.y, y: d.x };
    const base = { x: P.x - d.x * ARROW_LEN, y: P.y - d.y * ARROW_LEN };
    const l = { x: base.x + perp.x * ARROW_HALF, y: base.y + perp.y * ARROW_HALF };
    const r = { x: base.x - perp.x * ARROW_HALF, y: base.y - perp.y * ARROW_HALF };
    // Beschriftung entlang der Linie am Anfang (A + 180°), in Tunnelrichtung lesbar;
    // die Pfeilspitze bleibt frei (dort liegen oft die Pole)
    const flip = d.x < -1e-9;
    let rot = (Math.atan2(d.y, d.x) * 180) / Math.PI;
    if (flip) rot += 180;
    const Q = { x: T.x + d.x * 10, y: T.y + d.y * 10 };
    const anchor = /** @type {'start'|'end'} */ (flip ? 'end' : 'start');
    const text = `Tunnel ${fmtAngle(model.azimuth)}°`;
    const box = rotatedTextBox(Q.x, Q.y, rot, -5, estimateWidth(text), anchor);
    obstacles.push(box);
    tunnel = { P, T, base, l, r, Q, rot, anchor, text, box };
  }

  // Klüfte mit gültiger Lage; Pol-Beschriftungen: links, rechts, oben, unten
  const drawn = model.joints.filter((j) => j.netValid && j.circle && j.pole);
  const poles = drawn.map((j) => px(/** @type {{x: number, y: number}} */ (j.pole)));
  const requests = drawn.map((j, i) => ({ id: j.index, x: poles[i].x, y: poles[i].y, text: j.label }));
  const placed = placeLabels(requests, { cx, cy, R, obstacles });
  return { w, h, R, cx, cy, px, tunnel, drawn, poles, placed };
}

/**
 * Inhalt des Netzes ohne <svg>-Hülle.
 * @param {Model} model
 * @param {number} width Breite in px
 * @param {Mode} mode
 * @returns {{width: number, height: number, body: string}}
 */
export function stereonetContent(model, width, mode) {
  const screen = mode === 'screen';
  const L = netLayout(model, width);
  const { w, h, R, cx, cy, px } = L;
  /** @param {Array<{x: number, y: number}>} pts */
  const path = (pts) => pathData(pts.map(px));

  const out = [];
  /** Beschriftungen, zuletzt gezeichnet */
  const labels = [];

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
  const tn = L.tunnel;
  if (tn) {
    out.push(screen ? '<g class="tunnel">' : '<g>');
    out.push(`<line ${sty(mode, 'tunnel-line')} x1="${n(tn.T.x)}" y1="${n(tn.T.y)}" x2="${n(tn.base.x)}" y2="${n(tn.base.y)}"/>`);
    out.push(`<path ${sty(mode, 'tunnel-head')} d="M${n(tn.P.x)} ${n(tn.P.y)}L${n(tn.l.x)} ${n(tn.l.y)}L${n(tn.r.x)} ${n(tn.r.y)}Z"/>`);
    out.push('</g>');
    labels.push(haloText(mode, 'tunnel-label', 0,
      `transform="translate(${n(tn.Q.x)} ${n(tn.Q.y)}) rotate(${n(tn.rot)})" y="-5" text-anchor="${tn.anchor}"`,
      esc(tn.text)));
  }

  // Klüfte: Grosskreis und Pol
  L.drawn.forEach((j, i) => {
    const tip = [j.name.trim() || `Joint ${j.index + 1}`, `Dip direction/dip: ${fmtOrientation(j.dipDirection, j.dip)}`];
    const pp = L.poles[i];
    const circle = path(/** @type {Array<{x: number, y: number}>} */ (j.circle));
    out.push(`<g ${groupAttrs(mode, 'joint', j.index, tip)}>`);
    out.push(`<path ${sty(mode, 'gc', j.index)} d="${circle}"/>`);
    if (screen) out.push(`<path class="hit" d="${circle}"/>`);
    out.push(`<circle ${sty(mode, 'pole', j.index)} cx="${n(pp.x)}" cy="${n(pp.y)}" r="5"/>`);
    if (screen) out.push(`<circle class="hit-pole" cx="${n(pp.x)}" cy="${n(pp.y)}" r="11"/>`);
    out.push('</g>');
    const p = L.placed[i];
    const style = screen ? ` style="--c:${jointColorVar(j.index)}"` : '';
    labels.push(haloText(mode, 'plabel', j.index,
      `x="${n(p.x)}" y="${n(p.y)}" text-anchor="${p.anchor}"${style}`, esc(j.label)));
  });
  out.push(screen ? `<g class="labels">${labels.join('')}</g>` : `<g>${labels.join('')}</g>`);

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
