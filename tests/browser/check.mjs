// Browser-Check der App in Microsoft Edge (headless, Chrome DevTools Protocol).
// Gehört nicht zu "npm test" (braucht Edge); einmal je Auftrag ausführen mit
//
//     node tests/browser/check.mjs [--edge <Pfad zu msedge.exe>]
//
// Startet serve.mjs auf einem freien Port, öffnet die App mit den Standardwerten und prüft:
// keine Konsolenfehler, keine Anfragen an andere Hosts, Grafiken und Tabelle, Hover-Texte
// (echte Mausbewegung), Tunnelbeschriftung ohne Überdeckung, Eingabefehler, Add/Remove/Reset,
// Link mit Eingaben (Schreiben, Laden, kaputter Link), Export (SVG und PNG, im dunklen Theme
// erzeugt, trotzdem hell), Light/Dark, 390 px.
// Ausgabe: docs/screenshots/ (Desktop hell, Desktop dunkel, 390 px) und docs/screenshots/export/.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:net';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = join(ROOT, 'docs', 'screenshots');
const EXPORTS = join(SHOTS, 'export');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const EDGE = arg('--edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { startServer } = await import(pathToFileURL(join(ROOT, 'serve.mjs')).href);

function freePort() {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

let failures = 0;
let total = 0;
function check(name, ok, info) {
  total++;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info === undefined ? '' : ' – ' + (typeof info === 'string' ? info : JSON.stringify(info))}`);
}

mkdirSync(EXPORTS, { recursive: true });
const server = await startServer(0);
const origin = `http://127.0.0.1:${server.address().port}`;
const cdpPort = await freePort();
const profile = mkdtempSync(join(tmpdir(), 'joints-edge-'));
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });

let ws;
try {
  let tabs = [];
  for (let i = 0; i < 300 && !tabs.some((t) => t.type === 'page'); i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json(); } catch { /* noch nicht */ }
    await sleep(100);
  }
  const page = tabs.find((t) => t.type === 'page');
  if (!page) throw new Error(`Edge hat keinen Tab auf Port ${cdpPort} innerhalb von 30 s`);
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  const errors = [];
  const requests = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(m.params.type)) {
      errors.push(`console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(`log: ${m.params.entry.text} ${m.params.entry.url ?? ''}`);
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) errors.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id;
    const timer = setTimeout(() => { pending.delete(i); reject(new Error(`keine Antwort auf ${method} in 20 s`)); }, 20000);
    pending.set(i, (m) => { clearTimeout(timer); resolve(m); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.error) throw new Error(`${expression.slice(0, 80)}: ${r.error.message}`);
    if (r.result?.exceptionDetails) {
      const d = r.result.exceptionDetails;
      throw new Error(`${expression.slice(0, 80)}: ${d.exception?.description ?? d.text}`);
    }
    return r.result?.result?.value;
  };
  const waitFor = async (expr, what) => {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(expr)) return;
      await sleep(100);
    }
    throw new Error(`Zeitüberschreitung: ${what}`);
  };
  /** Aktion ausführen und warten, bis die App neu gerechnet hat. */
  const act = async (code) => {
    const before = await evaluate('window.app.runs');
    await evaluate(code);
    await waitFor(`window.app.runs > ${before}`, `Neuberechnung nach ${code.slice(0, 60)}`);
    await sleep(60);
  };
  const setField = (idSel, value) => `(() => { const e = document.getElementById('${idSel}'); e.focus(); e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.blur(); })()`;
  const viewport = async (width, height, mobile) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
    await send('Page.bringToFront');
  };
  const shot = async (name, width, height, mobile) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
    const h = await evaluate('Math.ceil(document.documentElement.scrollHeight)');
    await viewport(width, Math.max(height, h), mobile);
    await sleep(500);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.result.data, 'base64'));
    await viewport(width, height, mobile);
    await sleep(300);
    console.log(`     Screenshot docs/screenshots/${name}.png`);
  };
  /** Neu laden. Der Parameter r erzwingt eine echte Navigation (sonst wäre ein Fragmentwechsel nur ein hashchange). */
  let loads = 0;
  const load = async (url) => {
    const u = new URL(url);
    u.searchParams.set('r', String(++loads));
    await evaluate('window.__old = true').catch(() => {});
    await send('Page.navigate', { url: u.toString() });
    await waitFor('!window.__old && Boolean(window.app && window.app.ready)', `App bereit: ${url.slice(0, 60)}`);
    await sleep(300);
  };
  const center = (sel, i = 0) => evaluate(`(() => { const r = document.querySelectorAll(${JSON.stringify(sel)})[${i}].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  const click = async (sel) => {
    await evaluate(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' })`);
    const c = await center(sel);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 });
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Page.enable');
  await send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
  await viewport(1440, 900, false);
  await load(`${origin}/`);
  const defaultJson = await evaluate('JSON.stringify(window.app.state)');

  // --- Standardwerte ------------------------------------------------------
  const rows = await evaluate(`[...document.querySelectorAll('#results tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent))`);
  console.log('     Ergebnistabelle:', JSON.stringify(rows));
  check('Tabelle: 3 Zeilen, Spalten wie im Auftrag', rows.length === 3 && rows[0].length === 6);
  check('Tabelle: Kl 1b 295/85 → 31° right', rows[0][0] === 'Kl 1b' && rows[0][1] === '295/85' && rows[0][2] === '31°' && rows[0][3] === 'right', rows[0]);
  check('Tabelle: Kl 2b 207/86 → 86° right', rows[1][1] === '207/86' && rows[1][2] === '86°' && rows[1][3] === 'right', rows[1]);
  check('Tabelle: SS 317/50 → 21° left', rows[2][1] === '317/50' && rows[2][2] === '21°' && rows[2][3] === 'left', rows[2]);
  check('Tabelle: Abstände 9.85 / 1.00 / 1.45', rows.map((r) => r[4]).join(' ') === '9.85 1.00 1.45', rows.map((r) => r[4]));
  const convention = await evaluate(`document.querySelector('.convention').textContent`);
  check('Konventionszeile', convention === 'Azimuth clockwise from north. Section perpendicular to tunnel axis, looking in tunnel direction. tan β = tan α · sin(dip direction − A).', convention);
  const titles = await evaluate(`[document.getElementById('title-net').textContent, document.getElementById('title-section').textContent]`);
  check('Titel', titles[0] === 'Stereonet – equal area, lower hemisphere' && titles[1] === 'Cross-section – looking in tunnel direction (118°)', titles);
  const nohash = await evaluate('location.hash');
  check('Standardzustand: URL-Teil leer', nohash === '', nohash);

  // --- Grafiken -----------------------------------------------------------
  const counts = await evaluate(`({
    joints: document.querySelectorAll('svg.net .joint').length,
    gc: document.querySelectorAll('svg.net .joint .gc').length,
    poles: document.querySelectorAll('svg.net .pole').length,
    tunnel: document.querySelectorAll('svg.net .tunnel-line').length,
    head: document.querySelectorAll('svg.net .tunnel-head').length,
    cardinals: [...document.querySelectorAll('svg.net .cardinal')].map((t) => t.textContent).join(''),
    tunnelLabel: document.querySelector('svg.net .tunnel-label')?.textContent,
    plabels: [...document.querySelectorAll('svg.net .plabel')].map((t) => t.textContent),
    sets: document.querySelectorAll('svg.section .set').length,
    profile: document.querySelectorAll('svg.section .profile').length,
    sides: [...document.querySelectorAll('svg.section .side')].map((t) => t.textContent),
    bar: document.querySelector('svg.section .scalebar text')?.textContent,
  })`);
  check('Netz: 3 Grosskreise und 3 Pole', counts.joints === 3 && counts.gc === 3 && counts.poles === 3, counts);
  check('Netz: Tunnellinie mit Pfeil, N E S W', counts.tunnel === 1 && counts.head === 1 && counts.cardinals === 'NSEW', counts);
  check('Netz: Beschriftung «Tunnel 118°»', counts.tunnelLabel === 'Tunnel 118°', counts.tunnelLabel);
  check('Netz: Kluftbeschriftung Name + 3-/2-stellig', counts.plabels.join('|') === 'Kl 1b 295/85|Kl 2b 207/86|SS 317/50', counts.plabels);
  check('Querschnitt: 3 Spurenscharen, 1 Profil', counts.sets === 3 && counts.profile === 1, counts);
  check('Querschnitt: left (028°) / right (208°)', counts.sides.join('|') === 'left (028°)|right (208°)', counts.sides);
  check('Querschnitt: Massstabsbalken in m', /^\d+(\.\d+)? m$/.test(counts.bar ?? ''), counts.bar);
  const geom = await evaluate(`(() => {
    const f = document.querySelector('svg.section .frame').getBoundingClientRect();
    const p = document.querySelector('svg.section .profile').getBoundingClientRect();
    return { frameRatio: f.width / f.height, profileW: p.width / f.width * 30, profileH: p.height / f.height * 20.5 };
  })()`);
  check('Querschnitt: gleicher Massstab (Fenster 30 m × 20.5 m, Profil 10 m × 8 m)',
    Math.abs(geom.frameRatio - 30 / 20.5) < 0.01 && Math.abs(geom.profileW - 10.1) < 0.5 && Math.abs(geom.profileH - 8.1) < 0.5, geom);

  // «Tunnel 118°» darf keine Kluftbeschriftung überdecken
  const overlap = await evaluate(`(() => {
    const t = document.querySelector('svg.net .tunnel-label').getBoundingClientRect();
    const hits = [];
    for (const el of document.querySelectorAll('svg.net .plabel')) {
      const r = el.getBoundingClientRect();
      if (t.left < r.right && t.right > r.left && t.top < r.bottom && t.bottom > r.top) hits.push(el.textContent);
    }
    return hits;
  })()`);
  check('«Tunnel 118°» überdeckt keine Kluftbeschriftung', overlap.length === 0, overlap);

  // --- Hover ----------------------------------------------------------------
  const hoverSynthetic = (sel) => evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    const t = document.querySelector('.tip');
    return { hidden: t.hidden, text: t.textContent };
  })()`);
  const h2 = await hoverSynthetic('svg.section .set .hit');
  check('Hover Spur: Name, apparent dip, apparent spacing', !h2.hidden && /Apparent dip: 31° \(right\)\nApparent spacing: 9\.85 m/.test(h2.text), h2);
  // echte Mausbewegung: auf den Pol, dann weg
  await evaluate(`document.querySelector('.tip').hidden = true`);
  const pc = await center('svg.net .joint .hit-pole', 2); // SS: weit von den anderen Linien
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pc.x - 30, y: pc.y - 30 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pc.x, y: pc.y });
  await sleep(150);
  const over = await evaluate(`({ hidden: document.querySelector('.tip').hidden, text: document.querySelector('.tip').textContent })`);
  check('Hover Pol (Maus): Name und Fallrichtung/Fallen', !over.hidden && over.text === 'SS\nDip direction/dip: 317/50', over);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 30 });
  await sleep(150);
  const away = await evaluate(`document.querySelector('.tip').hidden`);
  check('Hover-Text verschwindet nach Verlassen des Elements', away === true, away);

  // --- Eingabefehler ------------------------------------------------------
  await act(setField('in-azimuth', 'abc'));
  const bad = await evaluate(`({
    msg: !document.getElementById('msg').hidden,
    err: document.querySelector('#in-azimuth').closest('.field').querySelector('.err').textContent,
    invalid: document.getElementById('in-azimuth').classList.contains('invalid'),
    kept: document.getElementById('in-azimuth').value,
    tunnel: document.querySelectorAll('svg.net .tunnel-line').length,
    joints: document.querySelectorAll('svg.net .joint').length,
    sets: document.querySelectorAll('svg.section .set').length,
    profile: document.querySelectorAll('svg.section .profile').length,
    disabled: ['copy-link', 'export-net-svg', 'export-net-png', 'export-section-svg', 'export-section-png', 'export-both-png'].every((i) => document.getElementById(i).disabled),
  })`);
  check('Ungültige Tunnelrichtung: Fehler am Feld, keine Tunnellinie/Spuren, Rest gezeichnet',
    bad.msg && bad.err === 'Enter a number' && bad.invalid && bad.kept === 'abc' && bad.tunnel === 0 && bad.joints === 3 && bad.sets === 0 && bad.profile === 1, bad);
  check('Ungültige Eingabe: Copy link und Export gesperrt', bad.disabled, bad.disabled);
  await act(setField('in-azimuth', '118'));
  await act(setField('in-j1-dip', '120'));
  const bad2 = await evaluate(`({
    row: document.querySelector('#input-form tr.err-row:not([hidden])')?.textContent,
    joints: document.querySelectorAll('svg.net .joint').length,
    sets: document.querySelectorAll('svg.section .set').length,
    note: document.querySelectorAll('#results tbody td.note')[1].textContent,
  })`);
  check('Ungültiges Fallen einer Kluft: nur diese Kluft entfällt', bad2.row === 'Dip: Enter a value from 0 to 90' && bad2.joints === 2 && bad2.sets === 2 && bad2.note === 'invalid input – not drawn', bad2);
  await act(setField('in-height', '4'));
  const bad3 = await evaluate(`({ plot: document.getElementById('plot-section').textContent, net: document.querySelectorAll('svg.net .joint').length })`);
  check('Ungültiges Profil (H < B/2): kein Querschnitt, Netz bleibt', /not drawn/.test(bad3.plot) && bad3.net === 2, bad3);

  // --- Add / Remove / Reset -----------------------------------------------
  await act(`document.getElementById('reset-defaults').click()`);
  const afterReset = await evaluate(`({ az: document.getElementById('in-azimuth').value, h: document.getElementById('in-height').value, rows: document.querySelectorAll('#input-form tbody tr[data-index]').length, msg: document.getElementById('msg').hidden })`);
  check('Reset to defaults', afterReset.az === '118' && afterReset.h === '8' && afterReset.rows === 3 && afterReset.msg === true, afterReset);
  await act(`document.getElementById('add-joint').click()`);
  await act(`document.getElementById('add-joint').click()`);
  const five = await evaluate(`({
    rows: document.querySelectorAll('#input-form tbody tr[data-index]').length,
    disabled: document.getElementById('add-joint').disabled,
    swatches: [...document.querySelectorAll('#input-form tbody .swatch')].map((s) => getComputedStyle(s).backgroundColor),
    sets: document.querySelectorAll('svg.section .set').length,
    resultRows: document.querySelectorAll('#results tbody tr').length,
    names: [document.getElementById('in-j3-name').value, document.getElementById('in-j4-name').value],
    vals: ['dipDirection', 'dip', 'spacing'].map((k) => document.getElementById('in-j3-' + k).value),
  })`);
  check('5 Zeilen, «Add joint» danach gesperrt, 5 verschiedene Farben', five.rows === 5 && five.disabled && new Set(five.swatches).size === 5, five);
  check('Neue Klüfte: «Joint 4», «Joint 5» mit 90 / 60 / 1', five.names.join('|') === 'Joint 4|Joint 5' && five.vals.join('|') === '90|60|1', five);
  check('5 Klüfte in Querschnitt und Tabelle', five.sets === 5 && five.resultRows === 5, five);
  await act(`document.querySelector('#input-form button.rm').click()`);
  const four = await evaluate(`({ rows: document.querySelectorAll('#input-form tbody tr[data-index]').length, name: document.getElementById('in-j0-name').value, disabled: document.getElementById('add-joint').disabled })`);
  check('Entfernen einer Zeile', four.rows === 4 && four.name === 'Kl 2b' && !four.disabled, four);
  const hashBeforeReset = await evaluate('location.hash');
  await act(`document.getElementById('reset-defaults').click()`);
  const hashAfterReset = await evaluate('location.hash');
  check('Reset leert den URL-Teil', hashBeforeReset.length > 10 && hashAfterReset === '', { before: hashBeforeReset.slice(0, 40), after: hashAfterReset });

  // --- Link mit Eingaben --------------------------------------------------
  await act(setField('in-azimuth', '45'));
  await act(setField('in-j0-name', 'Ä & "x", y'));
  await act(setField('in-width', '12'));
  await act(`document.getElementById('add-joint').click()`);
  const changed = await evaluate(`({ json: JSON.stringify(window.app.state), href: location.href, hash: location.hash })`);
  check('Link: Eingaben stehen im URL-Teil', changed.hash.startsWith('#A=45&B=12&H=8&n=4&j=') && changed.json !== defaultJson, changed.hash.slice(0, 60));
  await load(changed.href.replace(`${origin}/`, `${origin}/index.html`));
  const loaded = await evaluate(`({ json: JSON.stringify(window.app.state), name: document.getElementById('in-j0-name').value, az: document.getElementById('in-azimuth').value, title: document.getElementById('title-section').textContent, hash: location.hash })`);
  check('Link laden: Zustand ist gleich', loaded.json === changed.json && loaded.name === 'Ä & "x", y' && loaded.az === '45' && loaded.title.includes('(45°)') && loaded.hash === changed.hash, { name: loaded.name, az: loaded.az, same: loaded.json === changed.json });
  await click('#copy-link');
  await waitFor(`document.getElementById('copy-link').textContent !== 'Copy link'`, 'Rückmeldung Copy link');
  const copied = await evaluate(`document.getElementById('copy-link').textContent`);
  check('Copy link: Rückmeldung «Link copied»', copied === 'Link copied', copied);
  await load(`${origin}/index.html#A=abc&B=-1&H=%&n=2&j=x&j=1,2`);
  const brokenLoaded = await evaluate(`({ json: JSON.stringify(window.app.state), hash: location.hash, msg: document.getElementById('msg').hidden })`);
  check('Kaputter Link: Standardwerte, kein Absturz, URL-Teil bereinigt', brokenLoaded.json === defaultJson && brokenLoaded.hash === '' && brokenLoaded.msg === true, brokenLoaded);
  await load(`${origin}/index.html#A=300`);
  const partial = await evaluate(`({ az: window.app.state.tunnelAzimuth, joints: window.app.state.joints.length })`);
  check('Unvollständiger Link: gültiger Teil bleibt, Rest Standard', partial.az === 300 && partial.joints === 3, partial);

  // --- Light / Dark, Export -------------------------------------------------
  await load(`${origin}/`);
  const colours = async () => evaluate(`({
    bg: getComputedStyle(document.body).backgroundColor,
    joint1: getComputedStyle(document.querySelector('svg.net .joint .gc')).stroke,
    net: getComputedStyle(document.querySelector('svg.net .grid')).stroke,
    theme: document.documentElement.getAttribute('data-theme'),
  })`);
  await evaluate(`document.querySelector('input[name=theme][value=light]').click()`);
  await sleep(200);
  await shot('desktop_light', 1440, 900, false);
  const light = await colours();
  await evaluate(`document.querySelector('input[name=theme][value=dark]').click()`);
  await sleep(200);
  const dark = await colours();
  check('Umschalter Light/Dark ändert Hintergrund, Kluftfarbe und Netz (CSS-Variablen)',
    light.theme === 'light' && dark.theme === 'dark' && light.bg !== dark.bg && light.joint1 !== dark.joint1 && light.net !== dark.net, { light, dark });
  const stored = await evaluate(`localStorage.getItem('joints-theme')`);
  check('Wahl im Browser gespeichert', stored === 'dark', stored);
  await shot('desktop_dark', 1440, 900, false);

  // Export im dunklen Theme: muss trotzdem hell sein
  const exportButtons = [
    ['export-net-svg', 'joints_stereonet.svg'], ['export-net-png', 'joints_stereonet.png'],
    ['export-section-svg', 'joints_section.svg'], ['export-section-png', 'joints_section.png'],
    ['export-both-png', 'joints_both.png'],
  ];
  const widthOf = {};
  for (const [btn, name] of exportButtons) {
    await evaluate(`window.__prev = window.app.lastDownload`);
    await evaluate(`document.getElementById('${btn}').click()`);
    await waitFor(`window.app.lastDownload && window.app.lastDownload !== window.__prev`, `Export ${name}`);
    const info = await evaluate(`(async () => {
      const d = window.app.lastDownload;
      const out = { name: d.name, size: d.blob.size, type: d.blob.type };
      if (d.name.endsWith('.svg')) {
        const text = await d.blob.text();
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        out.parseError = Boolean(doc.querySelector('parsererror'));
        out.root = doc.documentElement.tagName;
        out.w = Number(doc.documentElement.getAttribute('width'));
        out.h = Number(doc.documentElement.getAttribute('height'));
        out.vars = text.includes('var(');
        out.classes = text.includes('class=');
        out.texts = doc.querySelectorAll('text').length;
        out.dark = /#1d1c1a|#141413/i.test(text);
      } else {
        const bmp = await createImageBitmap(d.blob);
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
        const px = ctx.getImageData(0, 0, c.width, c.height).data;
        let ink = 0;
        for (let i = 0; i < px.length; i += 4) if (px[i] < 235 || px[i + 1] < 235 || px[i + 2] < 235) ink++;
        out.w = bmp.width; out.h = bmp.height;
        out.corner = Array.from(ctx.getImageData(2, 2, 1, 1).data);
        out.ink = ink / (c.width * c.height);
      }
      const b64 = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(d.blob); });
      out.b64 = b64;
      return out;
    })()`);
    const bytes = Buffer.from(info.b64, 'base64');
    writeFileSync(join(EXPORTS, name), bytes);
    delete info.b64;
    const pngSig = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (name.endsWith('.svg')) {
      widthOf[name.replace('.svg', '')] = info.w;
      check(`Export ${name}: gültiges XML, nicht leer, ohne CSS-Variablen und Klassen, hell`, info.name === name && info.size > 3000 && !info.parseError && info.root === 'svg'
        && !info.vars && !info.classes && !info.dark && info.texts > 10, info);
    } else {
      const base = name.replace('.png', '');
      const expectW = widthOf[base] ? widthOf[base] * 2 : null;
      check(`Export ${name}: PNG nicht leer, doppelte Auflösung, weisser Grund`, info.name === name && info.type === 'image/png' && pngSig && info.size > 8000
        && info.w >= 1000 && (expectW === null || info.w === expectW) && info.corner.join(',') === '255,255,255,255' && info.ink > 0.01, { ...info, expectW });
    }
  }

  // --- Schmale Anzeige ------------------------------------------------------
  await evaluate(`document.querySelector('input[name=theme][value=light]').click()`);
  await viewport(390, 844, true);
  await load(`${origin}/`);
  const phone = await evaluate(`(() => {
    const net = document.querySelector('svg.net').getBoundingClientRect();
    const sec = document.querySelector('svg.section').getBoundingClientRect();
    const btn = document.getElementById('export-both-png').getBoundingClientRect();
    return {
      scrollW: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      inputsAbove: document.getElementById('inputs').getBoundingClientRect().top < document.getElementById('plots').getBoundingClientRect().top,
      net: [Math.round(net.left), Math.round(net.right)],
      section: [Math.round(sec.left), Math.round(sec.right)],
      btn: [Math.round(btn.left), Math.round(btn.right)],
      cardinals: [...document.querySelectorAll('svg.net .cardinal')].every((t) => { const r = t.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; }),
    };
  })()`);
  check('390 px: Seite nicht breiter als das Fenster', phone.scrollW <= phone.inner, phone);
  check('390 px: Netz vollständig sichtbar (Rand, N E S W), Querschnitt und Export-Knopf im Fenster',
    phone.net[0] >= 0 && phone.net[1] <= phone.inner && phone.cardinals && phone.section[0] >= 0 && phone.section[1] <= phone.inner && phone.btn[1] <= phone.inner && phone.inputsAbove, phone);
  await shot('phone_390', 390, 844, true);

  check('Keine Konsolenfehler, Warnungen oder HTTP-Fehler', errors.length === 0, errors.slice(0, 5));
  const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('about:') && !u.startsWith('blob:'));
  check('Keine Anfragen an andere Hosts', foreign.length === 0, foreign.slice(0, 5));
} catch (e) {
  failures++;
  console.log(`FAIL Abbruch: ${e.stack ?? e}`);
} finally {
  try { ws?.close(); } catch { /* egal */ }
  edge.kill();
  server.close();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Edge hält Dateien noch */ }
}
console.log(`\n${total - failures} von ${total} Prüfungen ok${failures ? `, ${failures} FEHLER` : ''}`);
process.exit(failures ? 1 : 0);
