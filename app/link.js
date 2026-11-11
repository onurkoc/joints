// @ts-check
/*
Eingaben im URL-Teil nach # (Schreiben und Lesen), ohne DOM.
Format: A=118&B=10&H=8&n=3&j=295,85,1,Kl+1b&j=…   (j = Fallrichtung,Fallen,Abstand,Name;
der Name steht zuletzt und darf Kommas und Sonderzeichen enthalten).
Lesen ist tolerant: Was fehlt oder ungültig ist, wird durch Standardwerte ersetzt
(A, Profil und Kluftliste je als Ganzes), es gibt nie einen Fehler.
*/
import { defaultState, parseNumber, validateState } from './state.js';

/** @typedef {import('./state.js').State} State */

/**
 * Zustand als Text für den URL-Teil (ohne führendes #).
 * @param {State} s
 * @returns {string}
 */
export function encodeState(s) {
  const p = new URLSearchParams();
  p.set('A', String(s.tunnelAzimuth));
  p.set('B', String(s.profile.width));
  p.set('H', String(s.profile.height));
  p.set('n', String(s.joints.length));
  for (const j of s.joints) p.append('j', `${j.dipDirection},${j.dip},${j.spacing},${j.name}`);
  return p.toString();
}

/**
 * Eine Kluft aus "Fallrichtung,Fallen,Abstand,Name"; null, wenn die Form nicht stimmt.
 * @param {string} text
 * @returns {import('./core/types.js').Joint | null}
 */
function parseJoint(text) {
  const parts = [];
  let rest = text;
  for (let i = 0; i < 3; i++) {
    const k = rest.indexOf(',');
    if (k < 0) return null;
    parts.push(rest.slice(0, k));
    rest = rest.slice(k + 1);
  }
  return {
    name: rest,
    dipDirection: parseNumber(parts[0]),
    dip: parseNumber(parts[1]),
    spacing: parseNumber(parts[2]),
  };
}

/**
 * Zustand aus dem URL-Teil. Immer ein gültiger Zustand.
 * @param {string} hash mit oder ohne führendes #
 * @returns {State}
 */
export function decodeState(hash) {
  const def = defaultState();
  try {
    const p = new URLSearchParams(String(hash).replace(/^#/, ''));
    const cand = {
      tunnelAzimuth: parseNumber(p.get('A') ?? ''),
      profile: { width: parseNumber(p.get('B') ?? ''), height: parseNumber(p.get('H') ?? '') },
      joints: /** @type {import('./core/types.js').Joint[]} */ ([]),
    };
    const raw = p.getAll('j');
    const count = parseNumber(p.get('n') ?? '');
    let jointsOk = Number.isInteger(count) && count === raw.length;
    if (jointsOk) {
      for (const r of raw) {
        const j = parseJoint(r);
        if (!j) { jointsOk = false; break; }
        cand.joints.push(j);
      }
    }
    if (!jointsOk) cand.joints = def.joints;
    // Gruppen mit Fehlern durch Standardwerte ersetzen
    const keys = Object.keys(validateState(cand).errors);
    const out = {
      tunnelAzimuth: keys.includes('tunnelAzimuth') ? def.tunnelAzimuth : cand.tunnelAzimuth,
      profile: keys.some((k) => k.startsWith('profile.')) ? def.profile : cand.profile,
      joints: keys.some((k) => k.startsWith('joints')) ? def.joints : cand.joints,
    };
    return validateState(out).valid ? out : def;
  } catch {
    return def;
  }
}
