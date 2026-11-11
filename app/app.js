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
import { encodeState, decodeState } from './link.js';
import { exportStereonet, exportSection, exportBoth } from './export.js';
import { downloadBlob, svgBlob, svgToPngBlob, copyText } from './ui/download.js';

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
  let state = decodeState(location.hash);
  let pending = false;
  let runs = 0;
  /** @type {import('./model.js').Model | null} */
  let model = null;
  /** @type {Record<string, string>} */
  let errors = {};
  /** URL-Teil, den die App zuletzt selbst geschrieben hat */
  let lastHash = '';
  /** letzte erzeugte Datei (für den Browser-Check) */
  /** @type {{name: string, blob: Blob} | null} */
  let lastDownload = null;

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
    onCopyLink() { copyLink(); },
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
    updateButtons(v.valid);
    if (v.valid) writeHash();
    runs++;
  }

  /**
   * Eingaben im URL-Teil führen; im Standardzustand bleibt der URL-Teil leer.
   * Bei ungültigen Eingaben bleibt der letzte gültige Link stehen.
   */
  function writeHash() {
    const enc = encodeState(state);
    lastHash = enc === encodeState(defaultState()) ? '' : `#${enc}`;
    if (location.hash !== lastHash) {
      history.replaceState(null, '', location.pathname + location.search + lastHash);
    }
  }

  /** @param {boolean} valid */
  function updateButtons(valid) {
    for (const id of ['copy-link', 'export-net-svg', 'export-net-png', 'export-section-svg', 'export-section-png', 'export-both-png']) {
      const b = /** @type {HTMLButtonElement} */ ($(id));
      b.disabled = !valid;
      if (!valid) b.title = 'Fix the invalid input first';
      else b.removeAttribute('title');
    }
  }

  /** @param {string} name @param {Blob} blob */
  function save(name, blob) {
    lastDownload = { name, blob };
    downloadBlob(name, blob);
  }

  /**
   * @param {string} base Dateiname ohne Endung
   * @param {{svg: string, width: number, height: number} | null} img
   * @param {'svg'|'png'} kind
   */
  async function exportImage(base, img, kind) {
    if (!img) return;
    if (kind === 'svg') save(`${base}.svg`, svgBlob(img.svg));
    else save(`${base}.png`, await svgToPngBlob(img.svg, img.width, img.height, 2));
  }

  /** @type {Array<[string, () => Promise<void>]>} */
  const exportActions = [
    ['export-net-svg', () => exportImage('joints_stereonet', model && exportStereonet(model), 'svg')],
    ['export-net-png', () => exportImage('joints_stereonet', model && exportStereonet(model), 'png')],
    ['export-section-svg', () => exportImage('joints_section', model && exportSection(model), 'svg')],
    ['export-section-png', () => exportImage('joints_section', model && exportSection(model), 'png')],
    ['export-both-png', () => exportImage('joints_both', model && exportBoth(model), 'png')],
  ];
  for (const [id, action] of exportActions) {
    $(id).addEventListener('click', () => {
      action().catch((err) => {
        $('msg').hidden = false;
        $('msg').textContent = `Export failed: ${err.message}`;
      });
    });
  }

  async function copyLink() {
    const btn = $('copy-link');
    const ok = await copyText(location.href);
    btn.textContent = ok ? 'Link copied' : 'Copy failed';
    setTimeout(() => { btn.textContent = 'Copy link'; }, 1500);
  }

  // Link von Hand geändert (eingefügt, Verlauf): Eingaben daraus lesen
  window.addEventListener('hashchange', () => {
    if (location.hash !== lastHash) replace(decodeState(location.hash));
  });

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
    get lastDownload() { return lastDownload; },
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
