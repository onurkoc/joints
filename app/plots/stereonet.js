// @ts-check
/*
Grafik 1: Schmidtsches Netz (flächentreu, untere Halbkugel, Nord oben) als SVG-Text.
Alle Farben über CSS-Variablen (style.css).
*/
import { esc, fmtAngle } from '../format.js';
import { n, pathData, tipAttr, jointColorVar } from './svg.js';

/** @typedef {import('../model.js').Model} Model */

const MARGIN = 30;
const ARROW_LEN = 14;
const ARROW_HALF = 5;

/**
 * @param {Model} model
 * @param {number} width Breite in px
 * @returns {string} SVG-Element
 */
export function renderStereonet(model, width) {
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
  out.push(`<svg class="net" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="${n(w)}" height="${n(h)}" role="img" aria-label="Stereonet, equal area, lower hemisphere">`);

  // 10°-Raster: Meridiane und Kleinkreise in einem Pfad
  const gridD = [...model.grid.meridians, ...model.grid.smallCircles].map((c) => path(c.points)).join('');
  out.push(`<path class="grid" d="${gridD}"/>`);
  out.push(`<circle class="rim" cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}"/>`);

  // Himmelsrichtungen
  out.push(`<text class="cardinal" x="${n(cx)}" y="${n(cy - R - 10)}" text-anchor="middle">N</text>`);
  out.push(`<text class="cardinal" x="${n(cx)}" y="${n(cy + R + 10)}" text-anchor="middle">S</text>`);
  out.push(`<text class="cardinal" x="${n(cx + R + 10)}" y="${n(cy)}" text-anchor="start">E</text>`);
  out.push(`<text class="cardinal" x="${n(cx - R - 10)}" y="${n(cy)}" text-anchor="end">W</text>`);

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
    out.push('<g class="tunnel">');
    out.push(`<line class="tunnel-line" x1="${n(T.x)}" y1="${n(T.y)}" x2="${n(base.x)}" y2="${n(base.y)}"/>`);
    out.push(`<path class="tunnel-head" d="M${n(P.x)} ${n(P.y)}L${n(l.x)} ${n(l.y)}L${n(r.x)} ${n(r.y)}Z"/>`);
    // Beschriftung entlang der Linie am Anfang (A + 180°), in Tunnelrichtung lesbar;
    // die Pfeilspitze bleibt frei (dort liegen oft die Pole)
    const flip = d.x < -1e-9;
    let rot = (Math.atan2(d.y, d.x) * 180) / Math.PI;
    if (flip) rot += 180;
    const Q = { x: T.x + d.x * 10, y: T.y + d.y * 10 };
    out.push(`<text class="tunnel-label" transform="translate(${n(Q.x)} ${n(Q.y)}) rotate(${n(rot)})" y="-5" text-anchor="${flip ? 'end' : 'start'}">Tunnel ${esc(fmtAngle(model.azimuth))}°</text>`);
    out.push('</g>');
  }

  // Klüfte: Grosskreis, Pol, Beschriftung
  for (const j of model.joints) {
    if (!j.netValid || !j.circle || !j.pole) continue;
    const tip = tipAttr([j.name.trim() || `Joint ${j.index + 1}`, `Dip direction / dip: ${fmtAngle(j.dipDirection)}° / ${fmtAngle(j.dip)}°`]);
    const pp = px(j.pole);
    const left = pp.x >= cx; // Beschriftung zur Netzmitte hin, damit sie im Bild bleibt
    out.push(`<g class="joint" style="--c:${jointColorVar(j.index)}" ${tip}>`);
    out.push(`<path class="gc" d="${path(j.circle)}"/>`);
    out.push(`<path class="hit" d="${path(j.circle)}"/>`);
    out.push(`<circle class="pole" cx="${n(pp.x)}" cy="${n(pp.y)}" r="5"/>`);
    out.push(`<circle class="hit-pole" cx="${n(pp.x)}" cy="${n(pp.y)}" r="11"/>`);
    out.push(`<text class="plabel" x="${n(pp.x + (left ? -9 : 9))}" y="${n(pp.y + 4)}" text-anchor="${left ? 'end' : 'start'}">${esc(j.label)}</text>`);
    out.push('</g>');
  }

  out.push('</svg>');
  return out.join('');
}
