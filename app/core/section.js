// @ts-check
import { toRad, toDeg } from './angles.js';
import { jointNormal } from './joint.js';

/** @typedef {import('./types.js').Point} Point */
/** @typedef {import('./types.js').Rect} Rect */

/** Unterhalb dieses sin θ gilt die Kluft als parallel zum Schnitt. */
export const PARALLEL_LIMIT = 0.02;

/**
 * Querschnitt-Bildachsen für Tunnelrichtung A (Blick in Tunnelrichtung):
 * rechts = Azimut A + 90° -> (cos A, −sin A, 0), oben = z.
 * @param {number} A Tunnelrichtung in Grad
 */
function sectionAxes(A) {
  const a = toRad(A);
  return {
    axis: { x: Math.sin(a), y: Math.cos(a), z: 0 },
    right: { x: Math.cos(a), y: -Math.sin(a), z: 0 },
  };
}

/**
 * @typedef {Object} ApparentDip
 * @property {number} beta Scheinbares Fallen mit Vorzeichen, −90…90. β > 0: Spur fällt nach rechts.
 * @property {number} magnitude Betrag |β|
 * @property {'rechts'|'links'|null} side Seite, zu der die Spur fällt; null bei horizontaler
 *   (β = 0) oder senkrechter (|β| = 90) Spur, dort ist keine Seite definiert.
 */

/**
 * Scheinbares Fallen im Querschnitt (Formelweg): tan β = tan α · sin(Fallrichtung − A).
 * Berechnet als atan2(sin α · sin(δ − A), cos α), numerisch stabil bei α = 90°.
 * @param {number} dipDirection Fallrichtung δ in Grad
 * @param {number} dip Fallen α in Grad
 * @param {number} A Tunnelrichtung in Grad
 * @returns {ApparentDip}
 */
export function apparentDip(dipDirection, dip, A) {
  const a = toRad(dip);
  const rel = toRad(dipDirection - A);
  const beta = toDeg(Math.atan2(Math.sin(a) * Math.sin(rel), Math.cos(a))) + 0;
  const magnitude = Math.abs(beta);
  /** @type {'rechts'|'links'|null} */
  let side = null;
  if (magnitude > 1e-9 && Math.abs(90 - magnitude) > 1e-9) side = beta > 0 ? 'rechts' : 'links';
  return { beta, magnitude, side };
}

/**
 * @typedef {Object} ApparentSpacing
 * @property {number} sinTheta sin θ, θ = Winkel zwischen Kluftnormale und Tunnelachse
 * @property {boolean} parallel true bei sin θ < 0.02: Kluft praktisch parallel zum Schnitt
 * @property {number|null} spacing Scheinbarer Abstand s' = s / sin θ in m; null wenn parallel
 */

/**
 * Scheinbarer Abstand im Querschnitt: s' = s / sin θ.
 * sin θ = √(cos²α + sin²α·sin²(δ − A)), identisch zu √(1 − (n·a)²).
 * @param {number} dipDirection Fallrichtung δ in Grad
 * @param {number} dip Fallen α in Grad
 * @param {number} A Tunnelrichtung in Grad
 * @param {number} spacing wahrer Abstand s in m (> 0)
 * @returns {ApparentSpacing}
 */
export function apparentSpacing(dipDirection, dip, A, spacing) {
  const a = toRad(dip);
  const rel = toRad(dipDirection - A);
  const sinTheta = Math.hypot(Math.cos(a), Math.sin(a) * Math.sin(rel));
  const parallel = sinTheta < PARALLEL_LIMIT;
  return { sinTheta, parallel, spacing: parallel ? null : spacing / sinTheta };
}

/**
 * Richtung der Kluftspur im Querschnitt aus dem Kreuzprodukt
 * (Kluftnormale × Schnittnormale), in Bildkoordinaten (rechts, oben).
 * Einheitsvektor, orientiert mit x > 0 (bei x ≈ 0: y > 0).
 * Gibt null zurück, wenn Normale und Tunnelachse kollinear sind (exakt parallel).
 * @param {number} dipDirection Fallrichtung in Grad
 * @param {number} dip Fallen in Grad
 * @param {number} A Tunnelrichtung in Grad
 * @returns {Point|null}
 */
export function traceDirection(dipDirection, dip, A) {
  const n = jointNormal(dipDirection, dip);
  const { axis, right } = sectionAxes(A);
  // c = n × axis
  const c = {
    x: n.y * axis.z - n.z * axis.y,
    y: n.z * axis.x - n.x * axis.z,
    z: n.x * axis.y - n.y * axis.x,
  };
  let x = c.x * right.x + c.y * right.y + c.z * right.z;
  let y = c.z; // Bildachse oben = z
  const len = Math.hypot(x, y);
  if (len < 1e-12) return null;
  x /= len;
  y /= len;
  if (x < -1e-15 || (Math.abs(x) <= 1e-15 && y < 0)) { x = -x; y = -y; }
  return { x: x + 0, y: y + 0 };
}

/**
 * Liang–Barsky: Gerade P + t·d auf Rechteck zuschneiden.
 * @param {Point} P
 * @param {Point} d Einheitsvektor
 * @param {Rect} r
 * @returns {import('./types.js').Segment|null}
 */
function clipLine(P, d, r) {
  let t0 = -Infinity;
  let t1 = Infinity;
  /** @type {Array<[number, number, number, number]>} */
  const axes = [[P.x, d.x, r.xmin, r.xmax], [P.y, d.y, r.ymin, r.ymax]];
  for (const [p, dd, lo, hi] of axes) {
    if (Math.abs(dd) < 1e-15) {
      if (p < lo || p > hi) return null;
    } else {
      let a = (lo - p) / dd;
      let b = (hi - p) / dd;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
  }
  if (!(t1 - t0 > 1e-12)) return null;
  return { x1: P.x + t0 * d.x, y1: P.y + t0 * d.y, x2: P.x + t1 * d.x, y2: P.y + t1 * d.y };
}

/**
 * @typedef {Object} TraceSet
 * @property {boolean} parallel Kluft praktisch parallel zum Schnitt: keine Spuren, Hinweis anzeigen
 * @property {number} sinTheta
 * @property {number|null} apparentSpacing s' in m, null wenn parallel
 * @property {boolean} truncated true, wenn mehr als maxLines Spuren nötig wären (dann segments = [])
 * @property {Array<import('./types.js').Segment & {k: number}>} segments Zugeschnittene Spuren;
 *   k = Nummer der Spur (0 = Spur durch den Mittelpunkt), |k|·s = Normalabstand der Kluftfläche;
 *   das Vorzeichen von k ist nur eine Zählrichtung ohne fachliche Bedeutung
 */

/**
 * Spurenschar im Querschnitt: parallele Geraden im Abstand s', eine (k = 0) durch `center`.
 * Richtung aus dem Kreuzprodukt (traceDirection). Auf `window` zugeschnitten.
 * @param {number} dipDirection Fallrichtung in Grad
 * @param {number} dip Fallen in Grad
 * @param {number} A Tunnelrichtung in Grad
 * @param {number} spacing wahrer Abstand s in m (> 0)
 * @param {Point} center Profilmitte (0, H/2)
 * @param {Rect} window Bildfenster
 * @param {number} [maxLines] Obergrenze der Spurenzahl (Schutz vor sehr kleinem Abstand)
 * @returns {TraceSet}
 */
export function traceSet(dipDirection, dip, A, spacing, center, window, maxLines = 2000) {
  const sp = apparentSpacing(dipDirection, dip, A, spacing);
  const dir = traceDirection(dipDirection, dip, A);
  if (sp.parallel || !dir || sp.spacing === null) {
    return { parallel: true, sinTheta: sp.sinTheta, apparentSpacing: null, truncated: false, segments: [] };
  }
  const sPrime = sp.spacing;
  const m = { x: -dir.y, y: dir.x }; // Normale der Spur in der Schnittebene
  const offs = [
    [window.xmin, window.ymin], [window.xmax, window.ymin],
    [window.xmin, window.ymax], [window.xmax, window.ymax],
  ].map(([x, y]) => (x - center.x) * m.x + (y - center.y) * m.y);
  const kmin = Math.ceil(Math.min(...offs) / sPrime - 1e-9);
  const kmax = Math.floor(Math.max(...offs) / sPrime + 1e-9);
  if (kmax - kmin + 1 > maxLines) {
    return { parallel: false, sinTheta: sp.sinTheta, apparentSpacing: sPrime, truncated: true, segments: [] };
  }
  /** @type {TraceSet['segments']} */
  const segments = [];
  for (let k = kmin; k <= kmax; k++) {
    const P = { x: center.x + k * sPrime * m.x, y: center.y + k * sPrime * m.y };
    const seg = clipLine(P, dir, window);
    if (seg) segments.push({ ...seg, k });
  }
  return { parallel: false, sinTheta: sp.sinTheta, apparentSpacing: sPrime, truncated: false, segments };
}
