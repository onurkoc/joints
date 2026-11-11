// @ts-check
import { toRad, normAzimuth } from './angles.js';

/** @typedef {import('./types.js').Vec3} Vec3 */
/** @typedef {import('./types.js').Line} Line */

/**
 * Einheitsnormale der Kluftfläche, nach oben gerichtet (z ≥ 0).
 * Sie kippt in Fallrichtung aus der Senkrechten.
 * @param {number} dipDirection Fallrichtung in Grad
 * @param {number} dip Fallen in Grad
 * @returns {Vec3}
 */
export function jointNormal(dipDirection, dip) {
  const d = toRad(dipDirection);
  const a = toRad(dip);
  return {
    x: Math.sin(d) * Math.sin(a),
    y: Math.cos(d) * Math.sin(a),
    z: Math.cos(a),
  };
}

/**
 * Pol der Kluft (Durchstosspunkt der Normalen durch die untere Halbkugel):
 * Richtung = Fallrichtung + 180°, Eintauchen = 90° − Fallen.
 * @param {number} dipDirection Fallrichtung in Grad
 * @param {number} dip Fallen in Grad
 * @returns {Line}
 */
export function jointPole(dipDirection, dip) {
  return { trend: normAzimuth(dipDirection + 180), plunge: 90 - dip };
}
