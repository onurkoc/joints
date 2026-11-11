// @ts-check

/** @typedef {import('./types.js').JointsInput} JointsInput */

export const MAX_JOINTS = 5;

/**
 * @typedef {Object} ValidationError
 * @property {string} field Pfad des Feldes, z. B. "joints[2].dip"
 * @property {string} code Stabiler Code: TYPE, RANGE, MIN_EXCLUSIVE, MAX_COUNT, H_LT_HALF_B
 * @property {string} message Klartext (deutsch)
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {ValidationError[]} errors
 */

/** @param {unknown} v @returns {v is number} */
function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Eingabeprüfung: Wertebereiche, maximal 5 Klüfte, H ≥ B/2, Abstand > 0.
 * Sammelt alle Fehler, wirft nie.
 * @param {any} input
 * @returns {ValidationResult}
 */
export function validateInput(input) {
  /** @type {ValidationError[]} */
  const errors = [];
  /** @param {string} field @param {string} code @param {string} message */
  const err = (field, code, message) => errors.push({ field, code, message });

  /**
   * @param {string} field
   * @param {unknown} v
   * @param {number} lo
   * @param {number} hi
   * @param {string} label
   */
  const range = (field, v, lo, hi, label) => {
    if (!isNum(v)) err(field, 'TYPE', `${label}: Zahl erforderlich`);
    else if (v < lo || v > hi) err(field, 'RANGE', `${label}: Wert ${v} ausserhalb ${lo}…${hi}`);
  };

  range('tunnelAzimuth', input?.tunnelAzimuth, 0, 360, 'Tunnelrichtung');

  const joints = input?.joints;
  if (!Array.isArray(joints)) {
    err('joints', 'TYPE', 'Klüfte: Liste erforderlich');
  } else {
    if (joints.length > MAX_JOINTS) {
      err('joints', 'MAX_COUNT', `Maximal ${MAX_JOINTS} Kluftscharen erlaubt (${joints.length} angegeben)`);
    }
    joints.forEach((j, i) => {
      const p = `joints[${i}]`;
      if (typeof j?.name !== 'string') err(`${p}.name`, 'TYPE', 'Name: Text erforderlich');
      range(`${p}.dipDirection`, j?.dipDirection, 0, 360, 'Fallrichtung');
      range(`${p}.dip`, j?.dip, 0, 90, 'Fallen');
      if (!isNum(j?.spacing)) err(`${p}.spacing`, 'TYPE', 'Abstand: Zahl erforderlich');
      else if (!(j.spacing > 0)) err(`${p}.spacing`, 'MIN_EXCLUSIVE', 'Abstand muss > 0 sein');
    });
  }

  const B = input?.profile?.width;
  const H = input?.profile?.height;
  if (!isNum(B)) err('profile.width', 'TYPE', 'Breite B: Zahl erforderlich');
  else if (!(B > 0)) err('profile.width', 'MIN_EXCLUSIVE', 'Breite B muss > 0 sein');
  if (!isNum(H)) err('profile.height', 'TYPE', 'Höhe H: Zahl erforderlich');
  else if (!(H > 0)) err('profile.height', 'MIN_EXCLUSIVE', 'Höhe H muss > 0 sein');
  if (isNum(B) && isNum(H) && B > 0 && H > 0 && H < B / 2) {
    err('profile.height', 'H_LT_HALF_B', `Höhe H muss ≥ B/2 sein (H = ${H}, B/2 = ${B / 2})`);
  }

  return { valid: errors.length === 0, errors };
}
