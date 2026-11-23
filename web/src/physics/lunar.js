// Teoría lunar de Meeus (Astronomical Algorithms, cap. 47), términos principales.

import { DEG2RAD } from '../core/constants.js';

// Teoría lunar de Meeus (Astronomical Algorithms, cap. 47), términos principales.
// Devuelve la posición geocéntrica en km, eclíptica J2000. jdTT en Tiempo Terrestre.
export const LUNAR_LON_TERMS = [
  [6.288774, 0, 0, 1, 0], [1.274027, 2, 0, -1, 0], [0.658314, 2, 0, 0, 0], [0.213618, 0, 0, 2, 0],
  [-0.185116, 0, 1, 0, 0], [-0.114332, 0, 0, 0, 2], [0.058793, 2, 0, -2, 0], [0.057066, 2, -1, -1, 0],
  [0.053322, 2, 0, 1, 0], [0.045758, 2, -1, 0, 0], [-0.040923, 0, 1, -1, 0], [-0.034720, 1, 0, 0, 0],
  [-0.030383, 0, 1, 1, 0], [0.015327, 2, 0, 0, -2], [-0.012528, 0, 0, 1, 2], [0.010980, 0, 0, 1, -2],
  [0.010675, 4, 0, -1, 0], [0.010034, 0, 0, 3, 0], [0.008548, 4, 0, -2, 0], [-0.007888, 2, 1, -1, 0],
  [-0.006766, 2, 1, 0, 0], [-0.005163, 1, 0, -1, 0], [0.004987, 1, 1, 0, 0], [0.004036, 2, -1, 1, 0]
];

export const LUNAR_DIST_TERMS = [
  [-20905.355, 0, 0, 1, 0], [-3699.111, 2, 0, -1, 0], [-2955.968, 2, 0, 0, 0], [-569.925, 0, 0, 2, 0],
  [48.888, 0, 1, 0, 0], [-3.149, 0, 0, 0, 2], [246.158, 2, 0, -2, 0], [-152.138, 2, -1, -1, 0],
  [-170.733, 2, 0, 1, 0], [-204.586, 2, -1, 0, 0], [-129.620, 0, 1, -1, 0], [108.743, 1, 0, 0, 0],
  [104.755, 0, 1, 1, 0], [10.321, 2, 0, 0, -2], [79.661, 0, 0, 1, -2], [-34.782, 4, 0, -1, 0],
  [-23.210, 0, 0, 3, 0], [-21.636, 4, 0, -2, 0], [24.208, 2, 1, -1, 0], [30.824, 2, 1, 0, 0],
  [-8.379, 1, 0, -1, 0], [-16.675, 1, 1, 0, 0], [-12.831, 2, -1, 1, 0]
];

export const LUNAR_LAT_TERMS = [
  [5.128122, 0, 0, 0, 1], [0.280602, 0, 0, 1, 1], [0.277693, 0, 0, 1, -1], [0.173237, 2, 0, 0, -1],
  [0.055413, 2, 0, -1, 1], [0.046271, 2, 0, -1, -1], [0.032573, 2, 0, 0, 1], [0.017198, 0, 0, 2, 1],
  [0.009266, 2, 0, 1, -1], [0.008822, 0, 0, 2, -1], [0.008216, 2, -1, 0, -1], [0.004324, 2, 0, -2, -1],
  [0.004200, 2, 0, 1, 1]
];

export function lunarGeocentricKm(jdTT) {
  const T = (jdTT - 2451545.0) / 36525.0;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = (297.8501921 + 445267.1114034 * T) * DEG2RAD;
  const Ms = (357.5291092 + 35999.0502909 * T) * DEG2RAD;
  const Mm = (134.9633964 + 477198.8675055 * T) * DEG2RAD;
  const F = (93.2720950 + 483202.0175233 * T) * DEG2RAD;
  const Ecc = 1.0 - 0.002516 * T;

  const sumSeries = (terms, fn) => {
    let acc = 0;
    for (const t of terms) {
      const k = Math.abs(t[2]);
      const ef = k === 1 ? Ecc : (k === 2 ? Ecc * Ecc : 1.0);
      acc += t[0] * ef * fn(t[1] * D + t[2] * Ms + t[3] * Mm + t[4] * F);
    }
    return acc;
  };

  // Longitud de la fecha -> J2000 restando la precesión general en longitud.
  const lon = (Lp + sumSeries(LUNAR_LON_TERMS, Math.sin) - 1.3969713 * T) * DEG2RAD;
  const lat = sumSeries(LUNAR_LAT_TERMS, Math.sin) * DEG2RAD;
  const r = 385000.56 + sumSeries(LUNAR_DIST_TERMS, Math.cos);
  const cosLat = Math.cos(lat);
  return {
    x: r * cosLat * Math.cos(lon),
    y: r * cosLat * Math.sin(lon),
    z: r * Math.sin(lat)
  };
}
