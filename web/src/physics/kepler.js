// Efemérides analíticas: fecha juliana, ecuación de Kepler y posiciones de los planetas.

import { AU_KM, DAY_SECONDS, DEG2RAD, MU_SUN_AU_DAY, TWO_PI } from '../core/constants.js';
import { MOONS } from '../data/moons.js';
import { PLANETS } from '../data/planets.js';
import { computeMoonKeplerState } from './moons.js';

export function epochMsToJD(ms) {
  return ms / 86400000.0 + 2440587.5;
}

export function normalizeDeg180(deg) {
  let a = (deg + 180.0) % 360.0;
  if (a < 0) a += 360.0;
  return a - 180.0;
}

export function solveKepler(M_rad, e) {
  let E = M_rad + e * Math.sin(M_rad) * (1.0 + e * Math.cos(M_rad));
  for (let iter = 0; iter < 14; iter++) {
    const f = E - e * Math.sin(E) - M_rad;
    const fPrime = 1.0 - e * Math.cos(E);
    const dE = f / fPrime;
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

export function computePlanetKeplerState(planet, T) {
  if (planet.isSun) {
    return {
      ...planet,
      isMoon: false,
      pos: { x: 0, y: 0, z: 0 },
      velAuDay: { x: 0, y: 0, z: 0 },
      distSunAu: 0,
      speedKmS: 0
    };
  }

  const a = planet.a + planet.da * T;
  const e = planet.e + planet.de * T;
  const I = (planet.I + planet.dI * T) * DEG2RAD;
  const L = planet.L + planet.dL * T;
  const wBar = planet.wBar + planet.dwBar * T;
  const Omega = (planet.Omega + planet.dOmega * T) * DEG2RAD;

  const omega = (wBar - (planet.Omega + planet.dOmega * T)) * DEG2RAD;
  const M = normalizeDeg180(L - wBar) * DEG2RAD;

  const E = solveKepler(M, e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const sqrtOneMinusESq = Math.sqrt(1.0 - e * e);

  const xPrime = a * (cosE - e);
  const yPrime = a * sqrtOneMinusESq * sinE;
  const r = Math.hypot(xPrime, yPrime);

  const n = Math.sqrt(MU_SUN_AU_DAY / (a * a * a));
  const edot = n / (1.0 - e * cosE);
  const vxPrime = -a * sinE * edot;
  const vyPrime = a * sqrtOneMinusESq * cosE * edot;

  const cosO = Math.cos(Omega), sinO = Math.sin(Omega);
  const cosw = Math.cos(omega), sinw = Math.sin(omega);
  const cosI = Math.cos(I), sinI = Math.sin(I);

  const m11 = cosO * cosw - sinO * sinw * cosI;
  const m12 = -cosO * sinw - sinO * cosw * cosI;
  const m21 = sinO * cosw + cosO * sinw * cosI;
  const m22 = -sinO * sinw + cosO * cosw * cosI;
  const m31 = sinw * sinI;
  const m32 = cosw * sinI;

  const x = m11 * xPrime + m12 * yPrime;
  const y = m21 * xPrime + m22 * yPrime;
  const z = m31 * xPrime + m32 * yPrime;

  const vx = m11 * vxPrime + m12 * vyPrime;
  const vy = m21 * vxPrime + m22 * vyPrime;
  const vz = m31 * vxPrime + m32 * vyPrime;

  const vAuDay = Math.sqrt(MU_SUN_AU_DAY * (2.0 / r - 1.0 / a));
  const speedKmS = (vAuDay * AU_KM) / DAY_SECONDS;

  return {
    ...planet,
    isMoon: false,
    pos: { x, y, z },
    velAuDay: { x: vx, y: vy, z: vz },
    distSunAu: r,
    speedKmS
  };
}

export function computeAllKeplerStates(epochMs) {
  const jd = epochMsToJD(epochMs);
  const T = (jd - 2451545.0) / 36525.0;

  const planetStates = PLANETS.map((p) => computePlanetKeplerState(p, T));
  const planetMap = new Map(planetStates.map((p) => [p.id, p]));

  const moonStates = MOONS.map((m) => {
    const host = planetMap.get(m.hostId);
    return computeMoonKeplerState(m, host, jd);
  });

  return [...planetStates, ...moonStates];
}

export function buildPlanetOrbitPoints(planet, T, segments = 220) {
  if (planet.isSun) return [];
  const a = planet.a + planet.da * T;
  const e = planet.e + planet.de * T;
  const I = (planet.I + planet.dI * T) * DEG2RAD;
  const wBar = planet.wBar + planet.dwBar * T;
  const Omega = (planet.Omega + planet.dOmega * T) * DEG2RAD;
  const omega = (wBar - (planet.Omega + planet.dOmega * T)) * DEG2RAD;

  const sqrtOneMinusESq = Math.sqrt(1.0 - e * e);
  const cosO = Math.cos(Omega), sinO = Math.sin(Omega);
  const cosw = Math.cos(omega), sinw = Math.sin(omega);
  const cosI = Math.cos(I), sinI = Math.sin(I);

  const m11 = cosO * cosw - sinO * sinw * cosI;
  const m12 = -cosO * sinw - sinO * cosw * cosI;
  const m21 = sinO * cosw + cosO * sinw * cosI;
  const m22 = -sinO * sinw + cosO * cosw * cosI;
  const m31 = sinw * sinI;
  const m32 = cosw * sinI;

  const pts = [];
  for (let k = 0; k <= segments; k++) {
    const E = (k / segments) * TWO_PI;
    const xPrime = a * (Math.cos(E) - e);
    const yPrime = a * sqrtOneMinusESq * Math.sin(E);
    pts.push({
      x: m11 * xPrime + m12 * yPrime,
      y: m21 * xPrime + m22 * yPrime,
      z: m31 * xPrime + m32 * yPrime
    });
  }
  return pts;
}
