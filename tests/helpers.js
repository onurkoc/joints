// @ts-check
import assert from 'node:assert/strict';

export const TOL = 1e-9;

/**
 * @param {number} actual
 * @param {number} expected
 * @param {number} [tol]
 * @param {string} [msg]
 */
export function close(actual, expected, tol = TOL, msg = '') {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${msg} erwartet ${expected}, erhalten ${actual} (Toleranz ${tol})`,
  );
}

/**
 * Kleinste Winkeldifferenz in Grad (modulo 360).
 * @param {number} a
 * @param {number} b
 */
export function angleDiff(a, b) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

/**
 * Deterministischer Zufallsgenerator (mulberry32), Ergebnis in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
