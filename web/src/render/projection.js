// Proyección de coordenadas (AU) a píxeles: escala visual/real, vista 2D/3D y anillos de lunas.

import { S } from '../state.js';

export function auToScreen(posAu, center, baseRadiusPx, currentZoom) {
  const r3d = Math.hypot(posAu.x, posAu.y, posAu.z || 0);
  if (r3d < 1e-10) {
    return { x: center.x, y: center.y, depth: 0, persp: 1 };
  }

  let scaleFactor;
  if (S.scaleMode === 'visual') {
    const compressedR = Math.pow(r3d, 0.56);
    scaleFactor = (compressedR / r3d) * (baseRadiusPx / Math.pow(39.8, 0.56)) * currentZoom;
  } else {
    scaleFactor = (baseRadiusPx * 0.36) * currentZoom;
  }

  if (!S.is3DMode) {
    return {
      x: center.x + posAu.x * scaleFactor,
      y: center.y - posAu.y * scaleFactor,
      depth: 0,
      persp: 1
    };
  }

  const sx = posAu.x * scaleFactor;
  const sy = posAu.y * scaleFactor;
  const sz = (posAu.z || 0) * scaleFactor;

  const cosY = Math.cos(S.camYaw);
  const sinY = Math.sin(S.camYaw);
  const rx = sx * cosY - sy * sinY;
  const ry = sx * sinY + sy * cosY;

  const cosP = Math.cos(S.camPitch);
  const sinP = Math.sin(S.camPitch);
  const screenY = -(ry * cosP + sz * sinP);
  const depth = -ry * sinP + sz * cosP;

  const focal = Math.max(950, baseRadiusPx * 2.6);
  const persp = Math.max(0.35, Math.min(2.6, focal / Math.max(220, focal - depth)));

  return {
    x: center.x + rx * persp,
    y: center.y + screenY * persp,
    depth,
    persp
  };
}

export function moonToScreen(moonState, hostScreenPos, center, baseRadiusPx, currentZoom) {
  if (S.scaleMode === 'linear') {
    return auToScreen(moonState.pos, center, baseRadiusPx, currentZoom);
  }

  const relR = Math.hypot(moonState.relPosAu.x, moonState.relPosAu.y, moonState.relPosAu.z || 0);
  if (relR < 1e-12) {
    return { x: hostScreenPos.x, y: hostScreenPos.y, depth: hostScreenPos.depth || 0, persp: hostScreenPos.persp || 1 };
  }

  const ringRadiusPx = moonState.visualRingPx * Math.pow(currentZoom, 0.45) * (hostScreenPos.persp || 1);
  const ux = moonState.relPosAu.x / relR;
  const uy = moonState.relPosAu.y / relR;
  const uz = (moonState.relPosAu.z || 0) / relR;

  if (!S.is3DMode) {
    return {
      x: hostScreenPos.x + ux * ringRadiusPx,
      y: hostScreenPos.y - uy * ringRadiusPx,
      ringRadiusPx,
      depth: 0,
      persp: 1
    };
  }

  const cosY = Math.cos(S.camYaw), sinY = Math.sin(S.camYaw);
  const rx = (ux * cosY - uy * sinY) * ringRadiusPx;
  const ry = (ux * sinY + uy * cosY) * ringRadiusPx;
  const sz = uz * ringRadiusPx;

  const cosP = Math.cos(S.camPitch), sinP = Math.sin(S.camPitch);
  const screenY = -(ry * cosP + sz * sinP);
  const relDepth = -ry * sinP + sz * cosP;

  return {
    x: hostScreenPos.x + rx,
    y: hostScreenPos.y + screenY,
    ringRadiusPx,
    depth: (hostScreenPos.depth || 0) + relDepth * 0.05,
    persp: hostScreenPos.persp || 1
  };
}
