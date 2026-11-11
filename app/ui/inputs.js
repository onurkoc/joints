// @ts-check
/*
Eingabeformular: Tunnelrichtung (Zahlenfeld mit Schieber), Profil (B, H) und Tabelle
der Kluftscharen (maximal 5 Zeilen). Zahlenfelder sind Textfelder, damit der
Dezimaltrenner unabhängig von der Browsersprache immer '.' ist (Komma wird gelesen).
Fehler stehen direkt am Feld.
*/
import { AZIMUTH_SLIDER, MAX_JOINTS, parseNumber } from '../state.js';
import { jointColorVar } from '../plots/svg.js';

/** @typedef {import('../state.js').State} State */

/**
 * @typedef {Object} InputHandlers
 * @property {(v: number) => void} onAzimuth
 * @property {(key: 'width'|'height', v: number) => void} onProfile
 * @property {(i: number, key: 'name'|'dipDirection'|'dip'|'spacing', v: string|number) => void} onJoint
 * @property {() => void} onAdd
 * @property {(i: number) => void} onRemove
 * @property {() => void} onReset
 * @property {() => void} onCopyLink
 */

/**
 * Element mit Attributen und Kindern.
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @param {(Node | string)[]} [children]
 * @returns {HTMLElement}
 */
function h(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

/**
 * Textfeld für Zahlen.
 * @param {string} id
 * @param {string} label  für aria-label
 * @returns {HTMLInputElement}
 */
function numberInput(id, label) {
  return /** @type {HTMLInputElement} */ (h('input', {
    id, type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': label,
  }));
}

/**
 * Wert ins Feld schreiben, ausser es hat den Fokus (dann bleibt, was getippt wird).
 * null = ungültiger Text im Zustand (NaN): das Feld behält, was getippt wurde.
 * @param {HTMLInputElement} input
 * @param {string | null} text
 */
function setValue(input, text) {
  if (text !== null && document.activeElement !== input && input.value !== text) input.value = text;
}

/**
 * @param {number} v
 * @returns {string | null}
 */
function numText(v) {
  return Number.isFinite(v) ? String(v) : null;
}

/**
 * @param {HTMLElement} container
 * @param {InputHandlers} on
 */
export function renderInputs(container, on) {
  // --- Tunnel -------------------------------------------------------------
  const azNum = numberInput('in-azimuth', 'Tunnel direction A in degrees');
  const azRange = /** @type {HTMLInputElement} */ (h('input', {
    type: 'range', min: String(AZIMUTH_SLIDER.min), max: String(AZIMUTH_SLIDER.max),
    step: String(AZIMUTH_SLIDER.step), 'aria-label': 'Tunnel direction A slider',
  }));
  const azErr = h('div', { class: 'err', 'aria-live': 'polite' });
  const azField = h('div', { class: 'field' }, [
    h('label', { for: 'in-azimuth' }, ['Tunnel direction A ', h('span', { class: 'unit' }, ['[°]'])]),
    h('div', { class: 'pair' }, [azRange, azNum]),
    azErr,
  ]);
  azNum.addEventListener('input', () => {
    const v = parseNumber(azNum.value);
    if (Number.isFinite(v)) azRange.value = String(Math.min(AZIMUTH_SLIDER.max, Math.max(AZIMUTH_SLIDER.min, v)));
    on.onAzimuth(v);
  });
  azNum.addEventListener('change', () => {
    const v = parseNumber(azNum.value);
    if (Number.isFinite(v)) azNum.value = String(v);
  });
  azRange.addEventListener('input', () => {
    azNum.value = azRange.value;
    on.onAzimuth(Number(azRange.value));
  });

  // --- Profil -------------------------------------------------------------
  /**
   * @param {'width'|'height'} key
   * @param {string} text
   * @param {string} unit
   */
  const profileField = (key, text, unit) => {
    const input = numberInput(`in-${key}`, `${text} in metres`);
    const err = h('div', { class: 'err', 'aria-live': 'polite' });
    const row = h('div', { class: 'field' }, [
      h('label', { for: `in-${key}` }, [text, ' ', h('span', { class: 'unit' }, [unit])]),
      input,
      err,
    ]);
    input.addEventListener('input', () => on.onProfile(key, parseNumber(input.value)));
    input.addEventListener('change', () => {
      const v = parseNumber(input.value);
      if (Number.isFinite(v)) input.value = String(v);
    });
    return { row, input, err };
  };
  const widthF = profileField('width', 'Width B', '[m]');
  const heightF = profileField('height', 'Height H', '[m]');

  // --- Kluftscharen -------------------------------------------------------
  const tbody = h('tbody');
  const jointsErr = h('div', { class: 'err', 'aria-live': 'polite' });
  const addBtn = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', id: 'add-joint' }, ['Add joint']));
  addBtn.addEventListener('click', () => on.onAdd());
  const table = h('table', { class: 'joints' }, [
    h('thead', {}, [h('tr', {}, [
      h('th', { scope: 'col', class: 'col-color' }, [h('span', { class: 'sr' }, ['Colour'])]),
      h('th', { scope: 'col' }, ['Name']),
      h('th', { scope: 'col' }, ['Dip direction [°]']),
      h('th', { scope: 'col' }, ['Dip [°]']),
      h('th', { scope: 'col' }, ['Spacing [m]']),
      h('th', { scope: 'col', class: 'col-rm' }, [h('span', { class: 'sr' }, ['Remove'])]),
    ])]),
    tbody,
  ]);

  /**
   * @typedef {Object} Row
   * @property {HTMLInputElement} name
   * @property {HTMLInputElement} dipDirection
   * @property {HTMLInputElement} dip
   * @property {HTMLInputElement} spacing
   * @property {HTMLElement} errRow
   * @property {HTMLElement} errCell
   */
  /** @type {Row[]} */
  let rows = [];

  /** @param {number} count */
  function buildRows(count) {
    tbody.replaceChildren();
    rows = [];
    for (let i = 0; i < count; i++) {
      const name = /** @type {HTMLInputElement} */ (h('input', {
        id: `in-j${i}-name`, type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': `Joint ${i + 1} name`,
      }));
      const dipDirection = numberInput(`in-j${i}-dipDirection`, `Joint ${i + 1} dip direction in degrees`);
      const dip = numberInput(`in-j${i}-dip`, `Joint ${i + 1} dip in degrees`);
      const spacing = numberInput(`in-j${i}-spacing`, `Joint ${i + 1} spacing in metres`);
      const rm = h('button', { type: 'button', class: 'rm', 'aria-label': `Remove joint ${i + 1}`, title: 'Remove joint' }, ['×']);
      name.addEventListener('input', () => on.onJoint(i, 'name', name.value));
      for (const [key, input] of /** @type {const} */ ([['dipDirection', dipDirection], ['dip', dip], ['spacing', spacing]])) {
        input.addEventListener('input', () => on.onJoint(i, key, parseNumber(input.value)));
        input.addEventListener('change', () => {
          const v = parseNumber(input.value);
          if (Number.isFinite(v)) input.value = String(v);
        });
      }
      rm.addEventListener('click', () => on.onRemove(i));
      const swatch = h('span', { class: 'swatch', style: `background:${jointColorVar(i)}` });
      const tr = h('tr', { 'data-index': String(i) }, [
        h('td', { class: 'col-color' }, [swatch]),
        h('td', {}, [name]), h('td', {}, [dipDirection]), h('td', {}, [dip]), h('td', {}, [spacing]),
        h('td', { class: 'col-rm' }, [rm]),
      ]);
      const errCell = h('td', { colspan: '6', class: 'err' });
      const errRow = h('tr', { class: 'err-row', hidden: '' }, [errCell]);
      tbody.append(tr, errRow);
      rows.push({ name, dipDirection, dip, spacing, errRow, errCell });
    }
  }

  const reset = h('button', { type: 'button', id: 'reset-defaults' }, ['Reset to defaults']);
  reset.addEventListener('click', () => on.onReset());
  const copy = h('button', { type: 'button', id: 'copy-link' }, ['Copy link']);
  copy.addEventListener('click', () => on.onCopyLink());

  container.append(
    h('fieldset', {}, [h('legend', {}, ['Tunnel']), azField]),
    h('fieldset', {}, [h('legend', {}, ['Profile (horseshoe)']), h('div', { class: 'two' }, [widthF.row, heightF.row])]),
    h('fieldset', {}, [
      h('legend', {}, ['Joint sets']),
      h('div', { class: 'table-wrap' }, [table]),
      jointsErr,
      h('div', { class: 'actions form-actions left' }, [addBtn]),
    ]),
    h('div', { class: 'actions form-actions' }, [copy, reset]),
  );

  /**
   * @param {HTMLInputElement} input
   * @param {string|undefined} msg
   */
  const mark = (input, msg) => {
    input.classList.toggle('invalid', Boolean(msg));
    if (msg) input.setAttribute('title', msg);
    else input.removeAttribute('title');
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  /**
   * Zustand anzeigen; ein Feld mit Fokus behält, was getippt wird.
   * @param {State} s
   * @param {Record<string, string>} errors Feldpfad -> Meldung
   */
  function sync(s, errors) {
    setValue(azNum, numText(s.tunnelAzimuth));
    if (Number.isFinite(s.tunnelAzimuth) && document.activeElement !== azRange) {
      azRange.value = String(Math.min(AZIMUTH_SLIDER.max, Math.max(AZIMUTH_SLIDER.min, s.tunnelAzimuth)));
    }
    mark(azNum, errors.tunnelAzimuth);
    azErr.textContent = errors.tunnelAzimuth ?? '';

    for (const [f, key] of /** @type {const} */ ([[widthF, 'width'], [heightF, 'height']])) {
      setValue(f.input, numText(s.profile[key]));
      const msg = errors[`profile.${key}`];
      mark(f.input, msg);
      f.err.textContent = msg ?? '';
    }

    if (rows.length !== s.joints.length) buildRows(s.joints.length);
    s.joints.forEach((j, i) => {
      const r = rows[i];
      setValue(r.name, j.name);
      setValue(r.dipDirection, numText(j.dipDirection));
      setValue(r.dip, numText(j.dip));
      setValue(r.spacing, numText(j.spacing));
      /** @type {string[]} */
      const msgs = [];
      for (const [input, key, label] of /** @type {const} */ ([
        [r.name, 'name', 'Name'], [r.dipDirection, 'dipDirection', 'Dip direction'],
        [r.dip, 'dip', 'Dip'], [r.spacing, 'spacing', 'Spacing'],
      ])) {
        const msg = errors[`joints[${i}].${key}`];
        mark(input, msg);
        if (msg) msgs.push(`${label}: ${msg}`);
      }
      r.errRow.hidden = msgs.length === 0;
      r.errCell.textContent = msgs.join('. ');
    });
    jointsErr.textContent = errors.joints ?? '';
    addBtn.disabled = s.joints.length >= MAX_JOINTS;
  }

  return { sync };
}
