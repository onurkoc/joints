// @ts-check
/*
Joints: Zustand, Verdrahtung der Eingaben, Berechnung, Grafiken und Ergebnistabelle.
Jede Änderung zeichnet beide Grafiken und die Tabelle neu (einmal je Bildschirmbild).
*/
import { defaultState, cloneState, newJoint, validateState, MAX_JOINTS } from './state.js';
import { buildModel } from './model.js';
import { fmtAngle } from './format.js';
import { renderInputs } from './ui/inputs.js';
import { renderResults } from './ui/results.js';
import { setupThemeSwitch } from './ui/theme.js';
import { setupTooltip } from './ui/tooltip.js';
import { renderStereonet } from './plots/stereonet.js';
import { renderSection } from './plots/section.js';

/** @typedef {import('./state.js').State} State */

/**
 * Element nach id.
 * @param {string} id
 * @returns {HTMLElement}
 */
function $(id) {
  const e = document.getElementById(id);
  if (!e) throw new Error(`element #${id} missing`);
  return e;
}

function main() {
  /** @type {State} */
  let state = defaultState();
  let pending = false;
  let runs = 0;
  /** @type {import('./model.js').Model | null} */
  let model = null;
  /** @type {Record<string, string>} */
  let errors = {};

  const inputs = renderInputs($('input-form'), {
    onAzimuth(v) { change((s) => { s.tunnelAzimuth = v; }); },
    onProfile(key, v) { change((s) => { s.profile[key] = v; }); },
    onJoint(i, key, v) {
      change((s) => {
        if (key === 'name') s.joints[i].name = String(v);
        else s.joints[i][key] = Number(v);
      });
    },
    onAdd() { change((s) => { if (s.joints.length < MAX_JOINTS) s.joints.push(newJoint(s.joints.length)); }); },
    onRemove(i) { change((s) => { s.joints.splice(i, 1); }); },
    onReset() { replace(defaultState()); },
  });

  /** @param {(s: State) => void} fn */
  function change(fn) {
    const next = cloneState(state);
    fn(next);
    replace(next);
  }

  /** @param {State} next */
  function replace(next) {
    state = next;
    schedule();
  }

  /** Einmal je Bildschirmbild neu berechnen. */
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      run();
    });
  }

  function draw() {
    if (!model) return;
    const net = $('plot-net');
    const sec = $('plot-section');
    net.innerHTML = renderStereonet(model, net.clientWidth);
    sec.innerHTML = renderSection(model, sec.clientWidth);
    $('title-section').textContent = model.azimuth === null
      ? 'Cross-section – looking in tunnel direction'
      : `Cross-section – looking in tunnel direction (${fmtAngle(model.azimuth)}°)`;
  }

  function run() {
    const v = validateState(state);
    errors = v.errors;
    inputs.sync(state, errors);
    $('msg').hidden = v.valid;
    model = buildModel(state, errors);
    draw();
    renderResults($('results'), model);
    runs++;
  }

  // Grafiken folgen der Breite ihres Feldes
  /** @type {Map<Element, number>} */
  const widths = new Map();
  const ro = new ResizeObserver((entries) => {
    let changed = false;
    for (const e of entries) {
      const w = Math.round(e.contentRect.width);
      if (widths.get(e.target) !== w) { widths.set(e.target, w); changed = true; }
    }
    if (changed) draw();
  });
  ro.observe($('plot-net'));
  ro.observe($('plot-section'));

  // Eingaben: auf breitem Bildschirm immer offen, auf schmalem einklappbar
  const wide = matchMedia('(min-width: 900px)');
  const details = /** @type {HTMLDetailsElement} */ ($('inputs'));
  wide.addEventListener('change', () => { if (wide.matches) details.open = true; });

  setupThemeSwitch($('theme-switch'));
  setupTooltip($('plots'));

  run();
  /** für den Browser-Check */
  /** @type {any} */ (window).app = {
    get state() { return state; },
    get model() { return model; },
    get errors() { return errors; },
    get runs() { return runs; },
    set(/** @type {State} */ s) { replace(s); },
    ready: true,
  };
}

try {
  main();
} catch (err) {
  const box = document.getElementById('msg');
  if (box) {
    box.hidden = false;
    box.textContent = `The app could not be started: ${/** @type {Error} */ (err).message}`;
  }
  throw err;
}
