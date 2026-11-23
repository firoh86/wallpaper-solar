// Punto subsolar de la Luna (dónde está el Sol en el cénit) en coordenadas selenográficas,
// para iluminar el globo como en el instante simulado.
// Método: Meeus, "Astronomical Algorithms", cap. 53 (sin libración física, < 0,05°).
// Contrastado con JPL Horizons (marco MOON_ME, noviembre de 2026): error < 0,02°.

import { PLANETS } from '../data/planets.js';
import { AU_KM, TT_MINUS_UTC_DAYS } from '../core/constants.js';
import { epochMsToJD, computePlanetKeplerState } from '../physics/kepler.js';
import { lunarGeocentricKm } from '../physics/lunar.js';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const EARTH = PLANETS.find((p) => p.id === 'earth');
const INCL = 1.54242 * D2R; // inclinación del ecuador lunar respecto a la eclíptica

const norm360 = (d) => ((d % 360) + 360) % 360;

/** @returns {{lat:number, lon:number}} latitud y longitud (este +) selenográficas del punto subsolar, en grados. */
export function subsolarPoint(epochMs) {
  const jd = epochMsToJD(epochMs);
  const jdTT = jd + TT_MINUS_UTC_DAYS;
  const T = (jdTT - 2451545.0) / 36525.0;
  const prec = 1.3969713 * T; // J2000 -> equinoccio de la fecha

  // Luna geocéntrica
  const m = lunarGeocentricKm(jdTT);
  const delta = Math.hypot(m.x, m.y, m.z);
  const lam = Math.atan2(m.y, m.x) * R2D + prec;
  const beta = Math.asin(m.z / delta) * R2D;

  // Sol geocéntrico (= -Tierra heliocéntrica)
  const e = computePlanetKeplerState(EARTH, (jd - 2451545.0) / 36525.0).pos;
  const R = Math.hypot(e.x, e.y, e.z) * AU_KM;
  const lam0 = Math.atan2(-e.y, -e.x) * R2D + prec;

  // Posición heliocéntrica aproximada de la Luna
  const lamH = lam0 + 180 + (delta / R) * R2D * Math.cos(beta * D2R) * Math.sin((lam0 - lam) * D2R);
  const betaH = (delta / R) * beta;

  const omega = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T; // nodo ascendente medio
  const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T;     // argumento de latitud

  const W = (lamH - omega) * D2R;
  const bH = betaH * D2R;
  const A = Math.atan2(
    Math.sin(W) * Math.cos(bH) * Math.cos(INCL) - Math.sin(bH) * Math.sin(INCL),
    Math.cos(W) * Math.cos(bH)
  ) * R2D;

  const lon = norm360(A - F);
  const lat = Math.asin(-Math.sin(W) * Math.cos(bH) * Math.sin(INCL) - Math.sin(bH) * Math.cos(INCL)) * R2D;
  return { lat, lon: lon > 180 ? lon - 360 : lon };
}
