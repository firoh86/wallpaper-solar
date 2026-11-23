// Posición y velocidad de las lunas respecto a su planeta.

import { AU_KM, DAY_SECONDS, DEG2RAD, MOON_ELEMENTS_EPOCH_JD, TT_MINUS_UTC_DAYS, TWO_PI } from '../core/constants.js';
import { solveKepler } from './kepler.js';
import { lunarGeocentricKm } from './lunar.js';

export function computeMoonRelativeState(moon, jd) {
  const jdTT = jd + TT_MINUS_UTC_DAYS;

  if (moon.model === 'meeus') {
    // Velocidad por diferencia central (±30 min); suficiente para telemetría y Verlet.
    const h = 1.0 / 48.0;
    const p0 = lunarGeocentricKm(jdTT);
    const pA = lunarGeocentricKm(jdTT + h);
    const pB = lunarGeocentricKm(jdTT - h);
    return {
      relPosAu: { x: p0.x / AU_KM, y: p0.y / AU_KM, z: p0.z / AU_KM },
      relVelAuDay: {
        x: (pA.x - pB.x) / (2 * h * AU_KM),
        y: (pA.y - pB.y) / (2 * h * AU_KM),
        z: (pA.z - pB.z) / (2 * h * AU_KM)
      }
    };
  }

  const nRadDay = moon.meanMotionDegDay * DEG2RAD;
  let M = (moon.M0Deg * DEG2RAD + nRadDay * (jdTT - MOON_ELEMENTS_EPOCH_JD)) % TWO_PI;
  if (M < 0) M += TWO_PI;

  const E = solveKepler(M, moon.e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const sqrtOneMinusESq = Math.sqrt(1.0 - moon.e * moon.e);

  const aAu = moon.aKm / AU_KM;
  const xPrime = aAu * (cosE - moon.e);
  const yPrime = aAu * sqrtOneMinusESq * sinE;

  const edot = nRadDay / (1.0 - moon.e * cosE);
  const vxPrime = -aAu * sinE * edot;
  const vyPrime = aAu * sqrtOneMinusESq * cosE * edot;

  const Omega = moon.Omega0Deg * DEG2RAD;
  const omega = moon.omega0Deg * DEG2RAD;
  const I = moon.incDeg * DEG2RAD;

  const cosO = Math.cos(Omega), sinO = Math.sin(Omega);
  const cosw = Math.cos(omega), sinw = Math.sin(omega);
  const cosI = Math.cos(I), sinI = Math.sin(I);

  const m11 = cosO * cosw - sinO * sinw * cosI;
  const m12 = -cosO * sinw - sinO * cosw * cosI;
  const m21 = sinO * cosw + cosO * sinw * cosI;
  const m22 = -sinO * sinw + cosO * cosw * cosI;
  const m31 = sinw * sinI;
  const m32 = cosw * sinI;

  return {
    relPosAu: {
      x: m11 * xPrime + m12 * yPrime,
      y: m21 * xPrime + m22 * yPrime,
      z: m31 * xPrime + m32 * yPrime
    },
    relVelAuDay: {
      x: m11 * vxPrime + m12 * vyPrime,
      y: m21 * vxPrime + m22 * vyPrime,
      z: m31 * vxPrime + m32 * vyPrime
    }
  };
}

export function computeMoonKeplerState(moon, hostState, jd) {
  const { relPosAu, relVelAuDay } = computeMoonRelativeState(moon, jd);

  const pos = {
    x: hostState.pos.x + relPosAu.x,
    y: hostState.pos.y + relPosAu.y,
    z: hostState.pos.z + relPosAu.z
  };

  const velAuDay = {
    x: hostState.velAuDay.x + relVelAuDay.x,
    y: hostState.velAuDay.y + relVelAuDay.y,
    z: hostState.velAuDay.z + relVelAuDay.z
  };

  const distSunAu = Math.hypot(pos.x, pos.y, pos.z);
  const distHostKm = Math.hypot(relPosAu.x, relPosAu.y, relPosAu.z) * AU_KM;
  const relSpeedKmS = (Math.hypot(relVelAuDay.x, relVelAuDay.y, relVelAuDay.z) * AU_KM) / DAY_SECONDS;
  const speedKmS = (Math.hypot(velAuDay.x, velAuDay.y, velAuDay.z) * AU_KM) / DAY_SECONDS;

  return {
    ...moon,
    isMoon: true,
    hostName: hostState.name,
    pos,
    relPosAu,
    velAuDay,
    distSunAu,
    distHostKm,
    relSpeedKmS,
    speedKmS
  };
}
