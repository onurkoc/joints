// Browser-Check der App in Microsoft Edge (headless, Chrome DevTools Protocol).
// Gehört nicht zu "npm test" (braucht Edge); einmal ausführen mit
//
//     node tests/browser/check.mjs [--edge <Pfad zu msedge.exe>]
//
// Startet serve.mjs auf einem freien Port, öffnet die App mit den Standardwerten und prüft:
// keine Konsolenfehler, keine Anfragen an andere Hosts, Grafiken und Tabelle, Hover-Texte,
// Eingabefehler, Add/Remove/Reset, Farbwechsel Light/Dark, kein Querscrollen bei 390 px.
// Screenshots: docs/screenshots/ (Desktop hell, Desktop dunkel, 390 px).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:net';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = join(ROOT, 'docs', 'screenshots');
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

mkdirSync(SHOTS, { recursive: true });
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
    const h = await evaluate('Math.ceil(document.documentElement.scrollHeight)');
    await viewport(width, Math.max(height, h), mobile);
    await sleep(500);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.result.data, 'base64'));
    await viewport(width, height, mobile);
    await sleep(300);
    console.log(`     Screenshot docs/screenshots/${name}.png`);
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Page.enable');
  await viewport(1440, 900, false);
  await send('Page.navigate', { url: `${origin}/` });
  await waitFor('Boolean(window.app && window.app.ready)', 'App bereit');
  await sleep(300);

  // --- Standardwerte ------------------------------------------------------
  const rows = await evaluate(`[...document.querySelectorAll('#results tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent))`);
  console.log('     Ergebnistabelle:', JSON.stringify(rows));
  check('Tabelle: 3 Zeilen, Spalten wie im Auftrag', rows.length === 3 && rows[0].length === 6);
  check('Tabelle: Kl 1b 295 / 85 → 31° right', rows[0][0] === 'Kl 1b' && rows[0][1] === '295 / 85' && rows[0][2] === '31°' && rows[0][3] === 'right', rows[0]);
  check('Tabelle: Kl 2b 207 / 86 → 86° right', rows[1][1] === '207 / 86' && rows[1][2] === '86°' && rows[1][3] === 'right', rows[1]);
  check('Tabelle: SS 317 / 50 → 21° left', rows[2][1] === '317 / 50' && rows[2][2] === '21°' && rows[2][3] === 'left', rows[2]);
  check('Tabelle: Abstände 9.85 / 1.00 / 1.45', rows.map((r) => r[4]).join(' ') === '9.85 1.00 1.45', rows.map((r) => r[4]));
  const convention = await evaluate(`document.querySelector('.convention').textContent`);
  check('Konventionszeile', convention === 'Azimuth clockwise from north. Section perpendicular to tunnel axis, looking in tunnel direction. tan β = tan α · sin(dip direction − A).', convention);
  const titles = await evaluate(`[document.getElementById('title-net').textContent, document.getElementById('title-section').textContent]`);
  check('Titel', titles[0] === 'Stereonet – equal area, lower hemisphere' && titles[1] === 'Cross-section – looking in tunnel direction (118°)', titles);

  // --- Grafiken -----------------------------------------------------------
  const counts = await evaluate(`({
    joints: document.querySelectorAll('svg.net .joint').length,
    gc: document.querySelectorAll('svg.net .joint .gc').length,
    poles: document.querySelectorAll('svg.net .pole').length,
    tunnel: document.querySelectorAll('svg.net .tunnel-line').length,
    head: document.querySelectorAll('svg.net .tunnel-head').length,
    cardinals: [...document.querySelectorAll('svg.net .cardinal')].map((t) => t.textContent).join(''),
    tunnelLabel: document.querySelector('svg.net .tunnel-label')?.textContent,
    sets: document.querySelectorAll('svg.section .set').length,
    profile: document.querySelectorAll('svg.section .profile').length,
    sides: [...document.querySelectorAll('svg.section .side')].map((t) => t.textContent),
    bar: document.querySelector('svg.section .scalebar text')?.textContent,
  })`);
  check('Netz: 3 Grosskreise und 3 Pole', counts.joints === 3 && counts.gc === 3 && counts.poles === 3, counts);
  check('Netz: Tunnellinie mit Pfeil, N E S W', counts.tunnel === 1 && counts.head === 1 && counts.cardinals === 'NSEW', counts);
  check('Netz: Beschriftung «Tunnel 118°»', counts.tunnelLabel === 'Tunnel 118°', counts.tunnelLabel);
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

  // --- Hover ----------------------------------------------------------------
  const hover = (sel) => evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    const t = document.querySelector('.tip');
    return { hidden: t.hidden, text: t.textContent };
  })()`);
  const h1 = await hover('svg.net .joint .hit-pole');
  check('Hover Pol: Name und Fallrichtung/Fallen', !h1.hidden && h1.text === 'Kl 1b\nDip direction / dip: 295° / 85°', h1);
  const h2 = await hover('svg.section .set .hit');
  check('Hover Spur: Name, apparent dip, apparent spacing', !h2.hidden && /Apparent dip: 31° \(right\)\nApparent spacing: 9\.85 m/.test(h2.text), h2);

  // --- Eingabefehler ------------------------------------------------------
  await act(setField('in-azimuth', 'abc'));
  const bad = await evaluate(`({
    msg: !document.getElementById('msg').hidden,
    err: document.querySelector('#in-azimuth').closest('.field').querySelector('.err').textContent,
    invalid: document.getElementById('in-azimuth').classList.contains('invalid'),
    tunnel: document.querySelectorAll('svg.net .tunnel-line').length,
    joints: document.querySelectorAll('svg.net .joint').length,
    sets: document.querySelectorAll('svg.section .set').length,
    profile: document.querySelectorAll('svg.section .profile').length,
    notes: [...document.querySelectorAll('#results tbody td.note')].map((t) => t.textContent),
  })`);
  check('Ungültige Tunnelrichtung: Fehler am Feld, keine Tunnellinie/Spuren, Rest gezeichnet',
    bad.msg && bad.err === 'Enter a number' && bad.invalid && bad.tunnel === 0 && bad.joints === 3 && bad.sets === 0 && bad.profile === 1, bad);
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
  })`);
  check('5 Zeilen, «Add joint» danach gesperrt, 5 verschiedene Farben', five.rows === 5 && five.disabled && new Set(five.swatches).size === 5, five);
  check('5 Klüfte in Querschnitt und Tabelle', five.sets === 5 && five.resultRows === 5, five);
  await act(`document.querySelector('#input-form button.rm').click()`);
  const four = await evaluate(`({ rows: document.querySelectorAll('#input-form tbody tr[data-index]').length, name: document.getElementById('in-j0-name').value, disabled: document.getElementById('add-joint').disabled })`);
  check('Entfernen einer Zeile', four.rows === 4 && four.name === 'Kl 2b' && !four.disabled, four);
  await act(`document.getElementById('reset-defaults').click()`);

  // --- Light / Dark ---------------------------------------------------------
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

  // --- Schmale Anzeige ------------------------------------------------------
  await evaluate(`document.querySelector('input[name=theme][value=light]').click()`);
  await viewport(390, 844, true);
  await send('Page.navigate', { url: `${origin}/` });
  await waitFor('Boolean(window.app && window.app.ready)', 'App bereit (390 px)');
  await sleep(500);
  const phone = await evaluate(`({
    scrollW: document.documentElement.scrollWidth,
    inputsAbove: document.getElementById('inputs').getBoundingClientRect().top < document.getElementById('plots').getBoundingClientRect().top,
    netW: document.querySelector('svg.net').getBoundingClientRect().width,
    tableScroll: document.querySelector('#results .results-table').getBoundingClientRect().width > document.getElementById('results').clientWidth + 1,
  })`);
  check('390 px: kein seitliches Scrollen der Seite, Eingabe oben, Netz passt in die Breite', phone.scrollW <= 390 && phone.inputsAbove && phone.netW <= 390, phone);
  await shot('phone_390', 390, 844, true);

  check('Keine Konsolenfehler, Warnungen oder HTTP-Fehler', errors.length === 0, errors.slice(0, 5));
  const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('about:'));
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
