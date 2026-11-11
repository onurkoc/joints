// @ts-check
import { toRad } from './angles.js';
import { projectVector } from './stereonet.js';

/** @typedef {import('./types.js').Point} Point */

/**
 * @typedef {Object} GridCurve
 * @property {number} angle Parameter der Kurve in Grad (siehe netGrid)
 * @property {Point[]} points Punktfolge im Netz; Anfang und Ende liegen auf dem Netzrand
 */

/**
 * Netzraster eines Schmidtschen Netzes mit horizontaler Nord-Süd-Achse
 * (untere Halbkugel, Nord oben).
 *
 * Meridiane (Grosskreise): Ebenen, die die Nord-Süd-Achse enthalten. Angle ψ = Neigung
 * der Ebene gegen die Horizontale, ψ < 90° fällt nach Osten, ψ > 90° nach Westen.
 * ψ = 90° ist die senkrechte Ebene, im Netz der Nord-Süd-Durchmesser.
 *
 * Kleinkreise: Kegel um die Nord-Süd-Achse. Angle γ = Öffnungswinkel zum Nordende der
 * Achse (γ > 90° entspricht dem Südende). γ = 90° ist die senkrechte Ost-West-Ebene,
 * im Netz der Ost-West-Durchmesser.
 *
 * Beide Scharen laufen in Schritten `step` von `step` bis 180° − `step`.
 * @param {number} [R] Netzradius
 * @param {number} [step] Rasterschritt in Grad (Teiler von 180)
 * @param {number} [steps] Anzahl Segmente je Kurve
 * @returns {{meridians: GridCurve[], smallCircles: GridCurve[]}}
 */
export function netGrid(R = 1, step = 10, steps = 90) {
  const n = Math.round(180 / step);
  /** @type {GridCurve[]} */
  const meridians = [];
  /** @type {GridCurve[]} */
  const smallCircles = [];
  for (let k = 1; k < n; k++) {
    const a = k * step;
    const r = toRad(a);
    /** @type {Point[]} */
    const m = [];
    /** @type {Point[]} */
    const s = [];
    for (let i = 0; i <= steps; i++) {
      let c = Math.cos((Math.PI * i) / steps);
      let sn = Math.sin((Math.PI * i) / steps);
      if (i === 0) { c = 1; sn = 0; }
      if (i === steps) { c = -1; sn = 0; }
      // Meridian: v = cosθ·N + sinθ·u, u = (cos ψ, 0, −sin ψ)
      m.push(projectVector({ x: sn * Math.cos(r), y: c, z: -sn * Math.sin(r) }, R));
      // Kleinkreis: v = cos γ·N + sin γ·(cos λ·E − sin λ·z)
      s.push(projectVector({ x: Math.sin(r) * c, y: Math.cos(r), z: -Math.sin(r) * sn }, R));
    }
    meridians.push({ angle: a, points: m });
    smallCircles.push({ angle: a, points: s });
  }
  return { meridians, smallCircles };
}
