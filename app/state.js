// @ts-check
/*
Zustand der Eingaben, Standardwerte und Prüfung. Keine DOM-Zugriffe.
Prüfung über validateInput() des Rechenkerns; die Meldungen der Oberfläche
sind englisch und werden hier aus den Fehlercodes gebildet.
*/
import { validateInput, MAX_JOINTS } from './core/validate.js';

/** @typedef {import('./core/types.js').Joint} Joint */

/**
 * @typedef {Object} State
 * @property {number} tunnelAzimuth Tunnelrichtung A in Grad (NaN = ungültiger Text)
 * @property {{width: number, height: number}} profile
 * @property {Joint[]} joints
 */

export { MAX_JOINTS };

/** Slider und Zahlenfeld der Tunnelrichtung. */
export const AZIMUTH_SLIDER = { min: 0, max: 359, step: 1 };

/** @returns {State} */
export function defaultState() {
  return {
    tunnelAzimuth: 118,
    profile: { width: 10, height: 8 },
    joints: [
      { name: 'Kl 1b', dipDirection: 295, dip: 85, spacing: 1.0 },
      { name: 'Kl 2b', dipDirection: 207, dip: 86, spacing: 1.0 },
      { name: 'SS', dipDirection: 317, dip: 50, spacing: 1.0 },
    ],
  };
}

/**
 * Neue Kluftzeile für «Add joint».
 * @param {number} count Anzahl bisheriger Klüfte
 * @returns {Joint}
 */
export function newJoint(count) {
  return { name: `Joint ${count + 1}`, dipDirection: 90, dip: 60, spacing: 1.0 };
}

/**
 * @param {State} s
 * @returns {State}
 */
export function cloneState(s) {
  return {
    tunnelAzimuth: s.tunnelAzimuth,
    profile: { ...s.profile },
    joints: s.joints.map((j) => ({ ...j })),
  };
}

/**
 * Text eines Zahlenfeldes -> Zahl. Komma als Dezimaltrenner erlaubt; leer oder Text = NaN.
 * @param {string} text
 * @returns {number}
 */
export function parseNumber(text) {
  const t = text.trim().replace(',', '.');
  if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}

/**
 * Feldgrenzen für die Meldungen.
 * @param {string} field
 * @returns {[number, number] | null}
 */
function bounds(field) {
  if (field === 'tunnelAzimuth' || field.endsWith('.dipDirection')) return [0, 360];
  if (field.endsWith('.dip')) return [0, 90];
  return null;
}

/**
 * Meldung der Oberfläche (englisch) zu einem Fehler des Rechenkerns.
 * @param {import('./core/validate.js').ValidationError} e
 * @param {State} s
 * @returns {string}
 */
function message(e, s) {
  switch (e.code) {
    case 'TYPE':
      return e.field.endsWith('.name') ? 'Enter a name' : 'Enter a number';
    case 'RANGE': {
      const b = bounds(e.field);
      return b ? `Enter a value from ${b[0]} to ${b[1]}` : 'Value out of range';
    }
    case 'MIN_EXCLUSIVE':
      return 'Must be greater than 0';
    case 'H_LT_HALF_B':
      return `Must be at least B/2 = ${s.profile.width / 2} m`;
    case 'MAX_COUNT':
      return `At most ${MAX_JOINTS} joint sets`;
    default:
      return 'Invalid value';
  }
}

/**
 * @typedef {Object} Validation
 * @property {Record<string, string>} errors Feldpfad -> Meldung (erste Meldung je Feld),
 *   Pfade wie im Rechenkern: "tunnelAzimuth", "joints[1].dip", "profile.height", "joints"
 * @property {boolean} valid
 */

/**
 * @param {State} s
 * @returns {Validation}
 */
export function validateState(s) {
  const r = validateInput({
    tunnelAzimuth: s.tunnelAzimuth,
    joints: s.joints,
    profile: s.profile,
  });
  /** @type {Record<string, string>} */
  const errors = {};
  for (const e of r.errors) {
    if (!(e.field in errors)) errors[e.field] = message(e, s);
  }
  return { errors, valid: r.valid };
}
