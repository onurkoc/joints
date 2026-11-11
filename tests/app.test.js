// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { close } from './helpers.js';
import { defaultState, validateState, parseNumber, newJoint, cloneState, MAX_JOINTS } from '../app/state.js';
import { buildModel, sectionWindow } from '../app/model.js';
import {
  fmtAngle, fmtOrientation, fmtLength, fmtApparentDip, fmtMetres, fmtAzimuth3, fallsTo, jointLabel, esc,
} from '../app/format.js';
import { resultRows } from '../app/ui/results.js';
import { renderStereonet } from '../app/plots/stereonet.js';
import { renderSection, niceLength } from '../app/plots/section.js';

const DEG = Math.PI / 180;

/** @param {import('../app/state.js').State} s */
function modelOf(s) {
  const v = validateState(s);
  return { v, m: buildModel(s, v.errors) };
}

test('Standardwerte laut Auftrag und gültig', () => {
  const s = defaultState();
  assert.equal(s.tunnelAzimuth, 118);
  assert.deepEqual(s.profile, { width: 10, height: 8 });
  assert.deepEqual(s.joints.map((j) => [j.name, j.dipDirection, j.dip, j.spacing]), [
    ['Kl 1b', 295, 85, 1.0], ['Kl 2b', 207, 86, 1.0], ['SS', 317, 50, 1.0],
  ]);
  const v = validateState(s);
  assert.equal(v.valid, true);
  assert.deepEqual(v.errors, {});
});

test('Zahlenfelder: Punkt und Komma, Text und leer sind NaN', () => {
  assert.equal(parseNumber('12.5'), 12.5);
  assert.equal(parseNumber(' 0,4 '), 0.4);
  assert.equal(parseNumber('-3'), -3);
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber('1.2.3')));
  assert.ok(Number.isNaN(parseNumber('12abc')));
});

test('Prüfmeldungen am Feld (englisch)', () => {
  const s = defaultState();
  s.tunnelAzimuth = NaN;
  s.joints[0].dip = 95;
  s.joints[1].dipDirection = -1;
  s.joints[2].spacing = 0;
  s.profile.width = 10;
  s.profile.height = 4;
  const { errors } = validateState(s);
  assert.equal(errors.tunnelAzimuth, 'Enter a number');
  assert.equal(errors['joints[0].dip'], 'Enter a value from 0 to 90');
  assert.equal(errors['joints[1].dipDirection'], 'Enter a value from 0 to 360');
  assert.equal(errors['joints[2].spacing'], 'Must be greater than 0');
  assert.equal(errors['profile.height'], 'Must be at least B/2 = 5 m');
});

test('Add joint: höchstens 5 Klüfte; sechste ergibt Fehler des Rechenkerns', () => {
  const s = defaultState();
  while (s.joints.length < MAX_JOINTS) s.joints.push(newJoint(s.joints.length));
  assert.equal(validateState(s).valid, true);
  s.joints.push(newJoint(5));
  assert.equal(validateState(s).errors.joints, 'At most 5 joint sets');
});

test('cloneState kopiert tief', () => {
  const a = defaultState();
  const b = cloneState(a);
  b.joints[0].dip = 1; b.profile.width = 1;
  assert.equal(a.joints[0].dip, 85);
  assert.equal(a.profile.width, 10);
});

test('Format: ganze Grad, 0.01 m, dreistelliger Azimut, Seiten', () => {
  assert.equal(fmtApparentDip(30.9), '31°');
  assert.equal(fmtApparentDip(0.4), '0°');
  assert.equal(fmtMetres(9.8431), '9.84');
  assert.equal(fmtMetres(1), '1.00');
  assert.equal(fmtAzimuth3(28), '028');
  assert.equal(fmtAzimuth3(118 - 90), '028');
  assert.equal(fmtAzimuth3(118 + 90), '208');
  assert.equal(fmtAzimuth3(-10), '350');
  assert.equal(fmtAzimuth3(359.6), '000');
  assert.equal(fmtAngle(295), '295');
  assert.equal(fmtAngle(12.34), '12.3');
  assert.equal(fallsTo('rechts', 31), 'right');
  assert.equal(fallsTo('links', 21), 'left');
  assert.equal(fallsTo(null, 0), 'horizontal');
  assert.equal(fallsTo(null, 90), 'vertical');
  assert.equal(jointLabel('Kl 1b', 295, 85), 'Kl 1b 295/85');
  assert.equal(jointLabel('  ', 10, 5), '010/05');
  assert.equal(jointLabel('Kl 1b', 7, 5), 'Kl 1b 007/05');
  assert.equal(fmtOrientation(295, 85), '295/85');
  assert.equal(fmtOrientation(7, 5), '007/05');
  assert.equal(fmtOrientation(360, 90), '360/90');
  assert.equal(fmtOrientation(0, 0), '000/00');
  assert.equal(fmtOrientation(7.5, 5.25), '007.5/05.3');
  assert.equal(fmtLength(10), '10');
  assert.equal(fmtLength(7.254), '7.25');
  assert.equal(esc('<a&"b">'), '&lt;a&amp;&quot;b&quot;&gt;');
});

test('Modell Standardwerte: scheinbares Fallen nach der Formel, Seite, Abstand', () => {
  const { m } = modelOf(defaultState());
  assert.equal(m.azimuth, 118);
  assert.equal(m.joints.length, 3);
  for (const j of m.joints) {
    const t = Math.tan(j.dip * DEG) * Math.sin((j.dipDirection - 118) * DEG);
    const beta = Math.atan(t) / DEG;
    assert.ok(j.dipApparent);
    close(j.dipApparent.value, Math.abs(beta), 1e-9);
    assert.equal(j.dipApparent.side, beta > 0 ? 'rechts' : 'links');
    assert.equal(j.parallel, false);
    assert.equal(j.truncated, false);
    assert.ok(j.traces.length > 0);
    assert.ok(j.circle && j.pole);
  }
  assert.deepEqual(m.joints.map((j) => j.dipApparent?.text), ['right', 'right', 'left']);
  assert.deepEqual(resultRows(m).map((r) => r.orientation), ['295/85', '207/86', '317/50']);
  assert.deepEqual(resultRows(m).map((r) => [r.apparentDip, r.fallsTo]), [['31°', 'right'], ['86°', 'right'], ['21°', 'left']]);
  // Abstand unabhängig über Normale · Tunnelachse (θ), s' = s / sin θ
  const expected = m.joints.map((j) => {
    const n = [Math.sin(j.dipDirection * DEG) * Math.sin(j.dip * DEG), Math.cos(j.dipDirection * DEG) * Math.sin(j.dip * DEG), Math.cos(j.dip * DEG)];
    const a = [Math.sin(118 * DEG), Math.cos(118 * DEG), 0];
    const cosT = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
    return (1 / Math.sqrt(1 - cosT * cosT)).toFixed(2);
  });
  assert.deepEqual(resultRows(m).map((r) => r.apparentSpacing), expected);
  assert.deepEqual(expected, ['9.85', '1.00', '1.45']);
});

test('Bildfenster: 3·B breit, 0.5·B unter der Sohle, 0.75·B über der Firste', () => {
  assert.deepEqual(sectionWindow(10, 8), { xmin: -15, xmax: 15, ymin: -5, ymax: 15.5 });
});

test('Ungültige Tunnelrichtung: keine Tunnellinie, keine Spuren, Netz der Klüfte bleibt', () => {
  const s = defaultState();
  s.tunnelAzimuth = 400;
  const { m } = modelOf(s);
  assert.equal(m.azimuth, null);
  assert.equal(m.tunnel, null);
  for (const j of m.joints) {
    assert.ok(j.circle && j.pole);
    assert.deepEqual(j.traces, []);
    assert.equal(j.dipApparent, null);
  }
  assert.ok(m.profile);
  const net = renderStereonet(m, 500);
  assert.ok(!net.includes('class="tunnel"'));
  assert.equal((net.match(/class="joint"/g) ?? []).length, 3);
  const sec = renderSection(m, 500);
  assert.ok(!sec.includes('class="set"') && !sec.includes('class="side"'));
  assert.ok(sec.includes('class="profile"'));
});

test('Ungültige Kluft: nur diese Kluft entfällt, Rest wird gezeichnet', () => {
  const s = defaultState();
  s.joints[1].dip = 120;
  const { m } = modelOf(s);
  assert.equal(m.joints[1].netValid, false);
  assert.equal(m.joints[1].circle, null);
  assert.deepEqual(m.joints[1].traces, []);
  assert.ok(m.joints[0].circle && m.joints[2].circle);
  assert.ok(m.joints[0].traces.length > 0 && m.joints[2].traces.length > 0);
  const rows = resultRows(m);
  assert.equal(rows[1].note, 'invalid input – not drawn');
  assert.equal(rows[1].orientation, '–');
  assert.equal(rows[0].note, '');
});

test('Ungültiger Abstand: Netz ja, Spuren nein', () => {
  const s = defaultState();
  s.joints[0].spacing = -1;
  const { m } = modelOf(s);
  const j = m.joints[0];
  assert.ok(j.circle && j.pole);
  assert.deepEqual(j.traces, []);
  assert.ok(j.dipApparent); // scheinbares Fallen braucht keinen Abstand
  assert.equal(j.spacingApparent, null);
  assert.equal(resultRows(m)[0].note, 'invalid input – no traces');
});

test('Ungültiges Profil: kein Querschnitt, Netz bleibt', () => {
  const s = defaultState();
  s.profile.height = 3;
  const { m } = modelOf(s);
  assert.equal(m.profile, null);
  assert.ok(m.tunnel);
  assert.match(renderSection(m, 500), /not drawn/);
  assert.ok(m.joints.every((j) => j.circle && j.traces.length === 0));
  assert.ok(m.joints.every((j) => j.dipApparent));
});

test('Parallel zum Schnitt: Hinweis, keine Spuren, kein scheinbares Fallen', () => {
  const s = defaultState();
  s.joints[0] = { name: 'P', dipDirection: 118, dip: 90, spacing: 1 };
  const { m } = modelOf(s);
  const j = m.joints[0];
  assert.equal(j.parallel, true);
  assert.deepEqual(j.traces, []);
  assert.equal(j.dipApparent, null);
  const row = resultRows(m)[0];
  assert.equal(row.note, 'parallel to section – no traces');
  assert.equal(row.apparentSpacing, '–');
  assert.ok(j.circle); // im Netz bleibt sie sichtbar
});

test('Zu viele Spuren: Hinweis', () => {
  const s = defaultState();
  s.joints[1].spacing = 0.001;
  const { m } = modelOf(s);
  assert.equal(m.joints[1].truncated, true);
  assert.deepEqual(m.joints[1].traces, []);
  assert.equal(resultRows(m)[1].note, 'too many traces – increase spacing');
});

test('Netz-SVG: Titel-Inhalte, Himmelsrichtungen, Tunnelbeschriftung, Farben als CSS-Variablen', () => {
  const { m } = modelOf(defaultState());
  const svg = renderStereonet(m, 520);
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  for (const c of ['>N<', '>E<', '>S<', '>W<']) assert.ok(svg.includes(c), c);
  assert.ok(svg.includes('Tunnel 118°'));
  assert.ok(svg.includes('Kl 1b 295/85') && svg.includes('Kl 2b 207/86') && svg.includes('SS 317/50'));
  assert.equal((svg.match(/class="joint"/g) ?? []).length, 3);
  assert.equal((svg.match(/class="pole"/g) ?? []).length, 3);
  assert.ok(svg.includes('--c:var(--joint1)') && svg.includes('--c:var(--joint2)') && svg.includes('--c:var(--joint3)'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(svg), 'keine festen Farben im SVG');
  assert.ok(svg.includes('data-tip="Kl 1b&#10;Dip direction/dip: 295/85"'));
});

test('Netz-SVG: Tunnelpfeil bei A, Pole innerhalb des Netzes', () => {
  const { m } = modelOf(defaultState());
  const w = 520;
  const svg = renderStereonet(m, w);
  const R = (w - 60) / 2;
  const c = 30 + R;
  const head = /class="tunnel-head" d="M([\d.-]+) ([\d.-]+)/.exec(svg);
  assert.ok(head);
  // Spitze bei Azimut 118°: rechts (Ost) und unterhalb der Mitte
  close(Number(head[1]), c + R * Math.sin(118 * DEG), 0.02);
  close(Number(head[2]), c - R * Math.cos(118 * DEG), 0.02);
  for (const p of m.joints.map((j) => j.pole)) assert.ok(p && Math.hypot(p.x, p.y) <= 1 + 1e-9);
});

test('Querschnitt-SVG: Seitenbeschriftung, gleicher Massstab, Massstabsbalken, Spuren je Schar', () => {
  const { m } = modelOf(defaultState());
  const svg = renderSection(m, 560);
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  assert.ok(svg.includes('left (028°)') && svg.includes('right (208°)'));
  assert.equal((svg.match(/class="set"/g) ?? []).length, 3);
  assert.ok(svg.includes('class="profile"'));
  assert.ok(svg.includes(' m</text>'));
  assert.ok(svg.includes('Apparent dip: 31° (right)') && svg.includes('Apparent spacing: 9.85 m'));
  const f = /class="frame" x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"/.exec(svg);
  assert.ok(f);
  close(Number(f[1]) / Number(f[2]), 30 / 20.5, 2e-3); // 3·B : (H + 1.25·B)
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(svg), 'keine festen Farben im SVG');
  // Profil liegt über den Spuren
  assert.ok(svg.indexOf('class="profile"') > svg.lastIndexOf('class="set"'));
});

test('Massstabsbalken: schöne Länge', () => {
  assert.equal(niceLength(6), 5);
  assert.equal(niceLength(4.9), 2);
  assert.equal(niceLength(2), 2);
  assert.equal(niceLength(1.1), 1);
  assert.equal(niceLength(12), 10);
  assert.equal(niceLength(0.3), 0.2);
});

test('Namen werden in SVG und Tabelle maskiert', () => {
  const s = defaultState();
  s.joints[0].name = '<b>"x"</b>';
  const { m } = modelOf(s);
  const svg = renderStereonet(m, 500);
  assert.ok(!svg.includes('<b>'));
  assert.ok(svg.includes('&lt;b&gt;'));
});
