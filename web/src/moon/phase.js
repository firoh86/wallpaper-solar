// Fase lunar a partir de las posiciones de la simulación (Sol, Tierra y Luna).

import { PLANETS } from '../data/planets.js';
import { TT_MINUS_UTC_DAYS } from '../core/constants.js';
import { epochMsToJD, computePlanetKeplerState } from '../physics/kepler.js';
import { lunarGeocentricKm } from '../physics/lunar.js';

const SYNODIC_MONTH_DAYS = 29.530589;
const RAD2DEG = 180 / Math.PI;

const PHASE_NAMES = [
  'Luna nueva', 'Luna creciente', 'Cuarto creciente', 'Gibosa creciente',
  'Luna llena', 'Gibosa menguante', 'Cuarto menguante', 'Luna menguante'
];

/**
 * @param {object} earth  estado de la Tierra (pos heliocéntrica en AU)
 * @param {object} moon   estado de la Luna (relPosAu geocéntrica en AU)
 * @returns {{elongationDeg, illumination, waxing, ageDays, name, dLon}}
 */
export function computeLunarPhase(earth, moon) {
  // Dirección del Sol vista desde la Tierra = -posición heliocéntrica de la Tierra.
  const sun = { x: -earth.pos.x, y: -earth.pos.y, z: -earth.pos.z };
  const m = moon.relPosAu;

  // Diferencia de longitud eclíptica Luna - Sol (0° nueva, 180° llena).
  const lonSun = Math.atan2(sun.y, sun.x);
  const lonMoon = Math.atan2(m.y, m.x);
  let dLon = (lonMoon - lonSun) * RAD2DEG;
  dLon = ((dLon % 360) + 360) % 360;

  // Elongación 3D y fracción iluminada (aproximación de ángulo de fase = 180° - elongación).
  const dot = sun.x * m.x + sun.y * m.y + sun.z * m.z;
  const cosE = dot / (Math.hypot(sun.x, sun.y, sun.z) * Math.hypot(m.x, m.y, m.z));
  const elongationDeg = Math.acos(Math.max(-1, Math.min(1, cosE))) * RAD2DEG;
  const illumination = (1 - cosE) / 2;

  const ageDays = (dLon / 360) * SYNODIC_MONTH_DAYS;
  const name = PHASE_NAMES[Math.floor(((dLon + 22.5) % 360) / 45)];

  return { elongationDeg, illumination, waxing: dLon < 180, ageDays, name, dLon };
}

// ---------------------------------------------------- búsqueda de fases exactas

const EARTH = PLANETS.find((p) => p.id === 'earth');
const DAY_MS = 86400000;

/** Diferencia de longitud Luna - Sol (0..360°) en un instante; versión ligera (sólo Tierra y Luna). */
function moonSunDeltaLon(epochMs) {
  const jd = epochMsToJD(epochMs);
  const earth = computePlanetKeplerState(EARTH, (jd - 2451545.0) / 36525.0);
  const m = lunarGeocentricKm(jd + TT_MINUS_UTC_DAYS);
  const d = (Math.atan2(m.y, m.x) - Math.atan2(-earth.pos.y, -earth.pos.x)) * RAD2DEG;
  return ((d % 360) + 360) % 360;
}

/**
 * Instante (ms) de la próxima vez que la diferencia Luna - Sol alcanza targetDeg
 * (0 = luna nueva, 180 = luna llena). Pasos de 6 h y bisección hasta ~1 minuto.
 */
export function findNextLunarPhase(fromMs, targetDeg) {
  const rel = (ms) => (((moonSunDeltaLon(ms) - targetDeg) % 360) + 540) % 360 - 180; // -180..180
  let a = fromMs + 60000;
  let fa = rel(a);
  for (let i = 0; i < 4 * 32; i++) {
    const b = a + DAY_MS / 4;
    const fb = rel(b);
    if (fa < 0 && fb >= 0) {
      let lo = a, hi = b;
      for (let k = 0; k < 20; k++) {
        const mid = (lo + hi) / 2;
        if (rel(mid) < 0) lo = mid; else hi = mid;
      }
      return hi;
    }
    a = b;
    fa = fb;
  }
  return null;
}
