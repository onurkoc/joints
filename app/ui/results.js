// @ts-check
/*
Ergebnistabelle unter den Grafiken. Spalten:
Joint | Dip dir / Dip | Apparent dip | Falls to | Apparent spacing [m] | Note
*/
import { esc, fmtApparentDip, fmtMetres, fmtOrientation } from '../format.js';
import { jointColorVar } from '../plots/svg.js';

/** @typedef {import('../model.js').Model} Model */
/** @typedef {import('../model.js').JointModel} JointModel */

/**
 * @param {JointModel} j
 * @returns {string}
 */
export function noteFor(j) {
  if (!j.netValid) return 'invalid input – not drawn';
  if (!j.sectionValid) return 'invalid input – no traces';
  if (j.parallel) return 'parallel to section – no traces';
  if (j.truncated) return 'too many traces – increase spacing';
  return '';
}

/**
 * Zeilen der Tabelle als reine Daten (für Anzeige und Tests).
 * @param {Model} model
 * @returns {Array<{joint: string, orientation: string, apparentDip: string, fallsTo: string, apparentSpacing: string, note: string, index: number}>}
 */
export function resultRows(model) {
  return model.joints.map((j) => ({
    index: j.index,
    joint: j.name.trim() || `Joint ${j.index + 1}`,
    orientation: j.netValid ? fmtOrientation(j.dipDirection, j.dip) : '–',
    apparentDip: j.dipApparent ? fmtApparentDip(j.dipApparent.value) : '–',
    fallsTo: j.dipApparent ? j.dipApparent.text : '–',
    apparentSpacing: j.spacingApparent !== null ? fmtMetres(j.spacingApparent) : '–',
    note: noteFor(j),
  }));
}

/**
 * @param {HTMLElement} container
 * @param {Model} model
 */
export function renderResults(container, model) {
  const rows = resultRows(model);
  const body = rows.length === 0
    ? '<tr><td colspan="6" class="muted">No joint sets.</td></tr>'
    : rows.map((r) => `<tr data-index="${r.index}">`
      + `<td><span class="swatch" style="background:${jointColorVar(r.index)}"></span>${esc(r.joint)}</td>`
      + `<td class="num">${esc(r.orientation)}</td>`
      + `<td class="num">${esc(r.apparentDip)}</td>`
      + `<td>${esc(r.fallsTo)}</td>`
      + `<td class="num">${esc(r.apparentSpacing)}</td>`
      + `<td class="note">${esc(r.note)}</td></tr>`).join('');
  container.innerHTML = '<table class="data results-table"><thead><tr>'
    + '<th scope="col">Joint</th><th scope="col">Dip dir / Dip</th><th scope="col">Apparent dip</th>'
    + '<th scope="col">Falls to</th><th scope="col">Apparent spacing [m]</th><th scope="col">Note</th>'
    + `</tr></thead><tbody>${body}</tbody></table>`;
}
