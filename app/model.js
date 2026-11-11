// @ts-check
/*
Rechenmodell der Oberfläche: aus Zustand und Prüfergebnis alles, was die Grafiken und
die Tabelle brauchen, als reine Daten (Einheitsnetz R = 1, Querschnitt in m).
Ungültige Elemente werden nicht berechnet und tragen ein Kennzeichen (valid-Flags).
*/
import { jointPole } from './core/joint.js';
import { projectLine, greatCircle, tunnelLine } from './core/stereonet.js';
import { netGrid } from './core/netgrid.js';
import { apparentDip, apparentSpacing, traceSet } from './core/section.js';
import { horseshoe } from './core/profile.js';
import { fallsTo, jointLabel } from './format.js';

/** @typedef {import('./state.js').State} State */
/** @typedef {import('./core/types.js').Point} Point */
/** @typedef {import('./core/types.js').Rect} Rect */

/**
 * @typedef {Object} JointModel
 * @property {number} index 0-basiert, bestimmt die Farbe
 * @property {string} name
 * @property {string} label Name und Fallrichtung/Fallen
 * @property {number} dipDirection
 * @property {number} dip
 * @property {number} spacing
 * @property {boolean} netValid Fallrichtung und Fallen gültig: Netz kann gezeichnet werden
 * @property {boolean} sectionValid zusätzlich Abstand, Tunnelrichtung und Profil gültig
 * @property {Point[]|null} circle Grosskreis im Einheitsnetz
 * @property {Point|null} pole Pol im Einheitsnetz
 * @property {{value: number, text: 'right'|'left'|'horizontal'|'vertical', side: 'rechts'|'links'|null}|null} dipApparent
 *   Betrag |β| und Seite; null wenn nicht berechenbar oder parallel zum Schnitt
 * @property {number|null} spacingApparent s' in m; null wenn nicht berechenbar oder parallel
 * @property {boolean} parallel
 * @property {boolean} truncated
 * @property {Array<import('./core/types.js').Segment & {k: number}>} traces
 */

/**
 * @typedef {Object} ProfileModel
 * @property {number} width
 * @property {number} height
 * @property {Point[]} outline
 * @property {Rect} window
 * @property {Point} center
 */

/**
 * @typedef {Object} Model
 * @property {number|null} azimuth Tunnelrichtung, null wenn ungültig
 * @property {ReturnType<typeof netGrid>} grid
 * @property {[Point, Point]|null} tunnel Randpunkte der Tunnellinie im Einheitsnetz
 * @property {ProfileModel|null} profile null wenn B oder H ungültig
 * @property {JointModel[]} joints
 */

const GRID = netGrid(1);

/**
 * Bildfenster des Querschnitts: Breite 3·B mittig zum Profil, 0.5·B unter der Sohle,
 * 0.75·B über der Firste.
 * @param {number} B
 * @param {number} H
 * @returns {Rect}
 */
export function sectionWindow(B, H) {
  return { xmin: -1.5 * B, xmax: 1.5 * B, ymin: -0.5 * B, ymax: H + 0.75 * B };
}

/**
 * @param {State} state
 * @param {Record<string, string>} errors Feldpfad -> Meldung (validateState)
 * @returns {Model}
 */
export function buildModel(state, errors) {
  const azOk = !('tunnelAzimuth' in errors);
  const profileOk = !('profile.width' in errors) && !('profile.height' in errors);
  const A = azOk ? state.tunnelAzimuth : null;

  /** @type {ProfileModel|null} */
  let profile = null;
  if (profileOk) {
    const { width: B, height: H } = state.profile;
    profile = {
      width: B, height: H,
      outline: horseshoe(B, H),
      window: sectionWindow(B, H),
      center: { x: 0, y: H / 2 },
    };
  }

  const joints = state.joints.map((j, i) => {
    const netValid = !(`joints[${i}].dipDirection` in errors) && !(`joints[${i}].dip` in errors);
    const spacingOk = !(`joints[${i}].spacing` in errors);
    /** @type {JointModel} */
    const m = {
      index: i,
      name: j.name,
      label: jointLabel(j.name, j.dipDirection, j.dip),
      dipDirection: j.dipDirection,
      dip: j.dip,
      spacing: j.spacing,
      netValid,
      sectionValid: netValid && spacingOk && A !== null && profile !== null,
      circle: null,
      pole: null,
      dipApparent: null,
      spacingApparent: null,
      parallel: false,
      truncated: false,
      traces: [],
    };
    if (netValid) {
      const pole = jointPole(j.dipDirection, j.dip);
      m.pole = projectLine(pole.trend, pole.plunge, 1);
      m.circle = greatCircle(j.dipDirection, j.dip, 1);
    }
    if (netValid && A !== null) {
      // scheinbares Fallen braucht Tunnelrichtung und Kluftlage, nicht Abstand und Profil
      const sp = apparentSpacing(j.dipDirection, j.dip, A, spacingOk ? j.spacing : 1);
      m.parallel = sp.parallel;
      if (!sp.parallel) {
        const ad = apparentDip(j.dipDirection, j.dip, A);
        m.dipApparent = { value: ad.magnitude, text: fallsTo(ad.side, ad.magnitude), side: ad.side };
        if (spacingOk) m.spacingApparent = sp.spacing;
      }
    }
    if (m.sectionValid && profile && A !== null) {
      const ts = traceSet(j.dipDirection, j.dip, A, j.spacing, profile.center, profile.window);
      m.parallel = ts.parallel;
      m.truncated = ts.truncated;
      m.traces = ts.segments;
    }
    return m;
  });

  return {
    azimuth: A,
    grid: GRID,
    tunnel: A === null ? null : tunnelLine(A, 1),
    profile,
    joints,
  };
}
