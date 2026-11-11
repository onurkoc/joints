// @ts-check
import { toRad } from './angles.js';

/** @typedef {import('./types.js').Vec3} Vec3 */
/** @typedef {import('./types.js').Point} Point */

/**
 * Linie (Richtung t, Eintauchen p) -> Punkt im Schmidtschen Netz (flächentreu,
 * untere Halbkugel, Nord oben). r = R·√2·sin((90°−p)/2), x = r·sin t, y = r·cos t.
 * @param {number} trend Richtung t in Grad
 * @param {number} plunge Eintauchen p in Grad (0…90)
 * @param {number} [R] Netzradius
 * @returns {Point}
 */
export function projectLine(trend, plunge, R = 1) {
  const r = R * Math.SQRT2 * Math.sin(toRad(90 - plunge) / 2);
  const t = toRad(trend);
  return { x: r * Math.sin(t), y: r * Math.cos(t) };
}

/**
 * Einheitsvektor -> Punkt im Netz. Gleiche Abbildung wie projectLine, aber ohne Umweg
 * über Winkel: x = R·vx/√(1−vz). Vektoren mit z > 0 werden durch den Ursprung
 * auf die untere Halbkugel gespiegelt (Linien sind richtungslos).
 * @param {Vec3} v Einheitsvektor
 * @param {number} [R] Netzradius
 * @returns {Point}
 */
export function projectVector(v, R = 1) {
  const s = v.z > 0 ? -1 : 1;
  const k = R / Math.sqrt(1 - s * v.z);
  return { x: s * v.x * k, y: s * v.y * k };
}

/**
 * Grosskreis einer Kluft als Punktfolge im Netz (für SVG-Pfad).
 * Beginnt und endet exakt auf dem Netzrand (Streichrichtung und Gegenrichtung).
 * Punkt i liegt bei Parameter φ = 180°·i/steps zwischen Streichrichtung (φ = 0°)
 * und deren Gegenrichtung (φ = 180°); bei φ = 90° liegt die Fallinie.
 * @param {number} dipDirection Fallrichtung in Grad
 * @param {number} dip Fallen in Grad
 * @param {number} [R] Netzradius
 * @param {number} [steps] Anzahl Segmente (gerade Zahl, damit die Fallinie ein Stützpunkt ist)
 * @returns {Point[]} steps + 1 Punkte
 */
export function greatCircle(dipDirection, dip, R = 1, steps = 90) {
  const d = toRad(dipDirection);
  const a = toRad(dip);
  // Streichrichtung (horizontal, in der Kluftfläche) und Fallinie (in der Kluftfläche, nach unten)
  const sx = -Math.cos(d);
  const sy = Math.sin(d);
  const dx = Math.sin(d) * Math.cos(a);
  const dy = Math.cos(d) * Math.cos(a);
  const dz = -Math.sin(a);
  /** @type {Point[]} */
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    let c = Math.cos((Math.PI * i) / steps);
    let sn = Math.sin((Math.PI * i) / steps);
    if (i === 0) { c = 1; sn = 0; }
    if (i === steps) { c = -1; sn = 0; }
    pts.push(projectVector({ x: c * sx + sn * dx, y: c * sy + sn * dy, z: sn * dz }, R));
  }
  return pts;
}

/**
 * Tunnelrichtung A als horizontale Linie: die zwei Randpunkte im Netz
 * (Richtung A und Richtung A + 180°).
 * @param {number} azimuth Tunnelrichtung A in Grad
 * @param {number} [R] Netzradius
 * @returns {[Point, Point]}
 */
export function tunnelLine(azimuth, R = 1) {
  return [projectLine(azimuth, 0, R), projectLine(azimuth + 180, 0, R)];
}
