// @ts-check
// Anzeigeformate der Oberfläche (Englisch). Keine DOM-Zugriffe.

/**
 * Zahl auf höchstens eine Nachkommastelle, ohne überflüssige Nullen ("295", "12.5").
 * @param {number} v
 * @returns {string}
 */
export function fmtAngle(v) {
  if (!Number.isFinite(v)) return '–';
  return String(Number(v.toFixed(1)));
}

/**
 * Scheinbares Fallen: Betrag auf ganze Grad.
 * @param {number} magnitude
 * @returns {string}
 */
export function fmtApparentDip(magnitude) {
  return `${Math.round(magnitude)}°`;
}

/**
 * Abstand in m auf 0.01 m.
 * @param {number} v
 * @returns {string}
 */
export function fmtMetres(v) {
  return v.toFixed(2);
}

/**
 * Azimut ganzzahlig und dreistellig, z. B. 28 -> "028".
 * @param {number} deg
 * @returns {string}
 */
export function fmtAzimuth3(deg) {
  const r = ((Math.round(deg) % 360) + 360) % 360;
  return String(r).padStart(3, '0');
}

/**
 * Seite, zu der die Spur fällt, in der Sprache der Oberfläche.
 * Der Rechenkern liefert 'rechts' / 'links' / null; null = horizontal (β = 0) oder
 * senkrecht (|β| = 90°).
 * @param {'rechts'|'links'|null} side
 * @param {number} magnitude |β| in Grad
 * @returns {'right'|'left'|'horizontal'|'vertical'}
 */
export function fallsTo(side, magnitude) {
  if (side === 'rechts') return 'right';
  if (side === 'links') return 'left';
  return magnitude < 45 ? 'horizontal' : 'vertical';
}

/**
 * Zahl mit festgelegter Mindestzahl Stellen vor dem Komma, z. B. (7, 3) -> "007".
 * @param {number} v
 * @param {number} width
 * @returns {string}
 */
function padAngle(v, width) {
  const s = fmtAngle(v);
  if (!Number.isFinite(v) || v < 0) return s;
  const [int, frac] = s.split('.');
  return int.padStart(width, '0') + (frac ? `.${frac}` : '');
}

/**
 * Fallrichtung/Fallen, dreistellig/zweistellig, z. B. "295/85", "007/05".
 * @param {number} dipDirection
 * @param {number} dip
 * @returns {string}
 */
export function fmtOrientation(dipDirection, dip) {
  return `${padAngle(dipDirection, 3)}/${padAngle(dip, 2)}`;
}

/**
 * Länge in m, höchstens 2 Nachkommastellen ohne überflüssige Nullen ("10", "7.25").
 * @param {number} v
 * @returns {string}
 */
export function fmtLength(v) {
  return Number.isFinite(v) ? String(Number(v.toFixed(2))) : '–';
}

/**
 * Beschriftung einer Kluft: Name, dann Fallrichtung/Fallen, z. B. "Kl 1b 295/85".
 * @param {string} name
 * @param {number} dipDirection
 * @param {number} dip
 * @returns {string}
 */
export function jointLabel(name, dipDirection, dip) {
  const o = fmtOrientation(dipDirection, dip);
  const n = name.trim();
  return n ? `${n} ${o}` : o;
}

/**
 * Text für SVG/HTML maskieren.
 * @param {string} s
 * @returns {string}
 */
export function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
