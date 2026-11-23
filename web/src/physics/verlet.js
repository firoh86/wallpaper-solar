// Motor alternativo: integrador gravitatorio N-cuerpos Velocity Verlet en unidades SI.

import { S } from '../state.js';
import { AU_KM, AU_M, DAY_SECONDS, G_SI } from '../core/constants.js';
import { computeAllKeplerStates } from './kepler.js';

export function initVerletFromEpoch(epochMs) {
  const states = computeAllKeplerStates(epochMs);

  S.verletBodies = states.map((s) => ({
    ...s,
    posM: {
      x: s.pos.x * AU_M,
      y: s.pos.y * AU_M,
      z: s.pos.z * AU_M
    },
    velMS: {
      x: (s.velAuDay.x * AU_M) / DAY_SECONDS,
      y: (s.velAuDay.y * AU_M) / DAY_SECONDS,
      z: (s.velAuDay.z * AU_M) / DAY_SECONDS
    },
    accMS2: { x: 0, y: 0, z: 0 }
  }));

  let px = 0, py = 0, pz = 0;
  for (const b of S.verletBodies) {
    if (!b.isSun) {
      px += b.massKg * b.velMS.x;
      py += b.massKg * b.velMS.y;
      pz += b.massKg * b.velMS.z;
    }
  }
  S.verletBodies[0].velMS.x = -px / S.verletBodies[0].massKg;
  S.verletBodies[0].velMS.y = -py / S.verletBodies[0].massKg;
  S.verletBodies[0].velMS.z = -pz / S.verletBodies[0].massKg;

  computeVerletAccelerations(S.verletBodies);
  S.verletEpochMs = epochMs;
}

export function computeVerletAccelerations(list) {
  const n = list.length;
  for (let i = 0; i < n; i++) {
    list[i].accMS2.x = 0;
    list[i].accMS2.y = 0;
    list[i].accMS2.z = 0;
  }

  const softSq = 1e6;
  for (let i = 0; i < n; i++) {
    const bi = list[i];
    for (let j = i + 1; j < n; j++) {
      const bj = list[j];
      const dx = bj.posM.x - bi.posM.x;
      const dy = bj.posM.y - bi.posM.y;
      const dz = bj.posM.z - bi.posM.z;
      const distSq = dx * dx + dy * dy + dz * dz + softSq;
      const invDist = 1.0 / Math.sqrt(distSq);
      const invDist3 = invDist * invDist * invDist;

      const fI = G_SI * bj.massKg * invDist3;
      const fJ = G_SI * bi.massKg * invDist3;

      bi.accMS2.x += dx * fI;
      bi.accMS2.y += dy * fI;
      bi.accMS2.z += dz * fI;
      bj.accMS2.x -= dx * fJ;
      bj.accMS2.y -= dy * fJ;
      bj.accMS2.z -= dz * fJ;
    }
  }
}

export function advanceVerletTo(targetEpochMs) {
  const deltaSec = (targetEpochMs - S.verletEpochMs) / 1000.0;
  if (Math.abs(deltaSec) < 1e-3) return;

  const maxStep = 300.0;
  const sign = deltaSec >= 0 ? 1 : -1;
  let absRem = Math.abs(deltaSec);

  if (absRem / maxStep > 3000) {
    initVerletFromEpoch(targetEpochMs);
    return;
  }

  while (absRem > 1e-6) {
    const h = Math.min(maxStep, absRem) * sign;
    const halfH = 0.5 * h;
    const halfHSq = 0.5 * h * h;

    const oldAcc = S.verletBodies.map((b) => ({ ...b.accMS2 }));
    for (const b of S.verletBodies) {
      b.posM.x += b.velMS.x * h + b.accMS2.x * halfHSq;
      b.posM.y += b.velMS.y * h + b.accMS2.y * halfHSq;
      b.posM.z += b.velMS.z * h + b.accMS2.z * halfHSq;
    }

    computeVerletAccelerations(S.verletBodies);

    for (let i = 0; i < S.verletBodies.length; i++) {
      const b = S.verletBodies[i];
      b.velMS.x += (oldAcc[i].x + b.accMS2.x) * halfH;
      b.velMS.y += (oldAcc[i].y + b.accMS2.y) * halfH;
      b.velMS.z += (oldAcc[i].z + b.accMS2.z) * halfH;
    }

    absRem -= Math.abs(h);
  }

  S.verletEpochMs = targetEpochMs;
}

export function getVerletDerivedStates() {
  const sun = S.verletBodies[0];
  const byId = new Map();

  const derived = S.verletBodies.map((b) => {
    const hx = (b.posM.x - sun.posM.x) / AU_M;
    const hy = (b.posM.y - sun.posM.y) / AU_M;
    const hz = (b.posM.z - sun.posM.z) / AU_M;
    const distSunAu = Math.hypot(hx, hy, hz);
    const speedKmS = Math.hypot(
      b.velMS.x - sun.velMS.x,
      b.velMS.y - sun.velMS.y,
      b.velMS.z - sun.velMS.z
    ) / 1000.0;

    const item = {
      ...b,
      pos: { x: hx, y: hy, z: hz },
      distSunAu,
      speedKmS
    };
    byId.set(b.id, item);
    return item;
  });

  for (const item of derived) {
    if (item.isMoon) {
      const host = byId.get(item.hostId);
      if (host) {
        item.hostName = host.name;
        item.relPosAu = {
          x: item.pos.x - host.pos.x,
          y: item.pos.y - host.pos.y,
          z: item.pos.z - host.pos.z
        };
        item.distHostKm = Math.hypot(item.relPosAu.x, item.relPosAu.y, item.relPosAu.z) * AU_KM;
        item.relSpeedKmS = Math.hypot(
          item.velMS.x - host.velMS.x,
          item.velMS.y - host.velMS.y,
          item.velMS.z - host.velMS.z
        ) / 1000.0;
      }
    }
  }

  return derived;
}
