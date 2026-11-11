// @ts-check
// Winkelhilfen. Alle öffentlichen Winkel des Rechenkerns sind in Grad.

export const DEG = Math.PI / 180;

/**
 * @param {number} deg
 * @returns {number}
 */
export function toRad(deg) {
  return deg * DEG;
}

/**
 * @param {number} rad
 * @returns {number}
 */
export function toDeg(rad) {
  return rad / DEG;
}

/**
 * Azimut auf [0, 360) normieren.
 * @param {number} deg
 * @returns {number}
 */
export function normAzimuth(deg) {
  return (((deg % 360) + 360) % 360) + 0;
}
