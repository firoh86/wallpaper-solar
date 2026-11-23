// Dibujo de un fotograma completo: estrellas, órbitas, cuerpos, lunas y etiquetas.

import { S } from '../state.js';
import { applyTransitionCamera } from '../moon/transition.js';
import { TWO_PI } from '../core/constants.js';
import { PLANETS } from '../data/planets.js';
import { buildPlanetOrbitPoints, computeAllKeplerStates, epochMsToJD } from '../physics/kepler.js';
import { advanceVerletTo, getVerletDerivedStates } from '../physics/verlet.js';
import { auToScreen, moonToScreen } from './projection.js';
import { container, ctx } from '../ui/dom.js';
import { getAnchorBounds } from '../ui/layout.js';

export const stars = Array.from({ length: 240 }, () => ({
  rx: Math.random(),
  ry: Math.random(),
  r: Math.random() * 0.95 + 0.25,
  a: Math.random() * 0.22 + 0.05
}));

export function renderScene(epochMs) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const anchor = getAnchorBounds();

  ctx.fillStyle = '#030508';
  ctx.fillRect(0, 0, width, height);

  for (const s of stars) {
    ctx.fillStyle = `rgba(248, 250, 252, ${s.a})`;
    ctx.fillRect(s.rx * width, s.ry * height, s.r, s.r);
  }

  const jd = epochMsToJD(epochMs);
  const T = (jd - 2451545.0) / 36525.0;

  if (S.physicsEngine === 'kepler') {
    S.currentAllStates = computeAllKeplerStates(epochMs);
  } else {
    advanceVerletTo(epochMs);
    S.currentAllStates = getVerletDerivedStates();
  }

  const baseRadiusPx = Math.min(anchor.width, anchor.height) * 0.43;
  const originCenter = {
    x: anchor.left + anchor.width * 0.5,
    y: anchor.top + anchor.height * 0.5
  };

  if (S.followSelected && S.selectedBodyId) {
    const target = S.currentAllStates.find((b) => b.id === S.selectedBodyId);
    if (target) {
      let targetScreen;
      if (target.isMoon) {
        const host = S.currentAllStates.find((p) => p.id === target.hostId);
        const hostSp = auToScreen(host.pos, originCenter, baseRadiusPx, S.zoom);
        targetScreen = moonToScreen(target, hostSp, originCenter, baseRadiusPx, S.zoom);
      } else {
        targetScreen = auToScreen(target.pos, originCenter, baseRadiusPx, S.zoom);
      }
      S.panOffset.x = originCenter.x - targetScreen.x;
      S.panOffset.y = originCenter.y - targetScreen.y;
    }
  }

  // Expansión lunar: durante el viaje a la Luna la cámara la conduce la transición.
  applyTransitionCamera(originCenter, baseRadiusPx);

  const center = {
    x: originCenter.x + S.panOffset.x,
    y: originCenter.y + S.panOffset.y
  };

  if (S.showGuides) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center.x - 18, center.y);
    ctx.lineTo(center.x + 18, center.y);
    ctx.moveTo(center.x, center.y - 18);
    ctx.lineTo(center.x, center.y + 18);
    ctx.stroke();
  }

  const cacheKey = Math.round(T * 1000);
  if (!S.orbitCache.has(cacheKey)) {
    S.orbitCache.clear();
    const map = new Map();
    for (const p of PLANETS) {
      if (!p.isSun) map.set(p.id, buildPlanetOrbitPoints(p, T, 220));
    }
    S.orbitCache.set(cacheKey, map);
  }
  const planetOrbits = S.orbitCache.get(cacheKey);

  S.bodyHitTargets = [];
  const planetScreenMap = new Map();

  if (S.showGuides) {
    for (const body of S.currentAllStates) {
      if (body.isSun || body.isMoon) continue;
      const pts = planetOrbits.get(body.id);
      if (!pts || pts.length < 2) continue;

      const isSelected = S.selectedBodyId === body.id;
      ctx.strokeStyle = isSelected
        ? 'rgba(28, 103, 227, 0.78)'
        : (body.id === 'pluto' ? 'rgba(201, 177, 153, 0.22)' : 'rgba(138, 153, 173, 0.16)');
      ctx.lineWidth = isSelected ? 1.35 : 0.9;

      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const sp = auToScreen(pts[i], center, baseRadiusPx, S.zoom);
        if (i === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.stroke();
    }
  }

  const primaryBodies = S.currentAllStates
    .filter((b) => !b.isMoon)
    .map((body) => {
      const sp = auToScreen(body.pos, center, baseRadiusPx, S.zoom);
      planetScreenMap.set(body.id, sp);
      return { body, sp };
    });

  if (S.is3DMode) {
    primaryBodies.sort((a, b) => a.sp.depth - b.sp.depth);
  }

  for (const { body, sp } of primaryBodies) {
    const perspScale = S.is3DMode ? sp.persp : 1.0;
    const r = body.isSun
      ? Math.max(6.5, body.radiusPx * Math.pow(S.zoom, 0.28) * perspScale)
      : Math.max(2.4, body.radiusPx * Math.pow(S.zoom, 0.22) * perspScale);

    S.bodyHitTargets.push({
      id: body.id,
      x: sp.x,
      y: sp.y,
      hitRadius: Math.max(15, r + 9),
      priority: 1
    });

    if (S.is3DMode && S.showGuides && !body.isSun && Math.abs(body.pos.z) > 0.015) {
      const eclipticProj = auToScreen({ x: body.pos.x, y: body.pos.y, z: 0 }, center, baseRadiusPx, S.zoom);
      ctx.strokeStyle = S.selectedBodyId === body.id
        ? 'rgba(28, 103, 227, 0.55)'
        : 'rgba(138, 153, 173, 0.22)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(eclipticProj.x, eclipticProj.y);
      ctx.lineTo(sp.x, sp.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (body.isSun) {
      const glow = ctx.createRadialGradient(sp.x, sp.y, r * 0.2, sp.x, sp.y, r * 3.5);
      glow.addColorStop(0, 'rgba(253, 184, 19, 0.42)');
      glow.addColorStop(0.55, 'rgba(252, 61, 33, 0.10)');
      glow.addColorStop(1, 'rgba(252, 61, 33, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r * 3.5, 0, TWO_PI);
      ctx.fill();
    }

    if (body.id === 'saturn') {
      ctx.strokeStyle = 'rgba(226, 192, 132, 0.50)';
      ctx.lineWidth = 1.25;
      const tiltY = S.is3DMode ? Math.max(0.25, Math.abs(Math.cos(S.camPitch)) * 0.9) : 0.65;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, r * 2.1, r * tiltY, -0.34, 0, TWO_PI);
      ctx.stroke();
    }

    if (S.selectedBodyId === body.id) {
      const boxSize = r + 6;
      ctx.strokeStyle = '#1C67E3';
      ctx.lineWidth = 1.25;
      ctx.strokeRect(sp.x - boxSize, sp.y - boxSize, boxSize * 2, boxSize * 2);
    }

    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r, 0, TWO_PI);
    ctx.fill();

    if (S.showGuides && !body.isSun) {
      ctx.fillStyle = S.selectedBodyId === body.id ? '#F8FAFC' : 'rgba(138, 153, 173, 0.90)';
      ctx.font = S.selectedBodyId === body.id ? '600 11px Inter, sans-serif' : '400 10.5px Inter, sans-serif';
      ctx.fillText(body.name, sp.x + r + 6, sp.y + 3.5);
    }
  }

  if (S.showMoons) {
    for (const moon of S.currentAllStates) {
      if (!moon.isMoon) continue;

      const hostSp = planetScreenMap.get(moon.hostId);
      if (!hostSp) continue;

      const mPos = moonToScreen(moon, hostSp, center, baseRadiusPx, S.zoom);
      const mr = Math.max(1.8, moon.radiusPx * Math.pow(S.zoom, 0.18) * (mPos.persp || 1));

      if (S.showGuides && S.scaleMode === 'visual' && mPos.ringRadiusPx && mPos.ringRadiusPx * S.zoom > 9) {
        ctx.strokeStyle = S.selectedBodyId === moon.id
          ? 'rgba(28, 103, 227, 0.6)'
          : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        if (!S.is3DMode) {
          ctx.arc(hostSp.x, hostSp.y, mPos.ringRadiusPx, 0, TWO_PI);
        } else {
          const ry = Math.max(2, mPos.ringRadiusPx * Math.abs(Math.cos(S.camPitch)));
          ctx.ellipse(hostSp.x, hostSp.y, mPos.ringRadiusPx, ry, 0, 0, TWO_PI);
        }
        ctx.stroke();
      }

      if (S.selectedBodyId === moon.id) {
        const boxSize = mr + 5;
        ctx.strokeStyle = '#FC3D21';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(mPos.x - boxSize, mPos.y - boxSize, boxSize * 2, boxSize * 2);
      }

      ctx.fillStyle = moon.color;
      ctx.beginPath();
      ctx.arc(mPos.x, mPos.y, mr, 0, TWO_PI);
      ctx.fill();

      S.bodyHitTargets.push({
        id: moon.id,
        x: mPos.x,
        y: mPos.y,
        hitRadius: Math.max(11, mr + 7),
        priority: 2
      });

      if (S.showGuides && (S.zoom >= 1.75 || S.selectedBodyId === moon.id)) {
        ctx.fillStyle = S.selectedBodyId === moon.id ? '#F8FAFC' : 'rgba(138, 153, 173, 0.78)';
        ctx.font = '400 9.5px JetBrains Mono, monospace';
        ctx.fillText(moon.name, mPos.x + mr + 4, mPos.y + 3);
      }
    }
  }

  if (S.is3DMode && S.showGuides) {
    const pitchDeg = Math.round((S.camPitch / Math.PI) * 180);
    const yawDeg = Math.round((((S.camYaw % TWO_PI) + TWO_PI) % TWO_PI) / Math.PI * 180);
    ctx.fillStyle = 'rgba(138, 153, 173, 0.75)';
    ctx.font = '400 10px JetBrains Mono, monospace';
    ctx.fillText(`3D ATT // PITCH:${pitchDeg}° YAW:${yawDeg}° [CLIC DER. ROTAR]`, anchor.left + 16, anchor.top + anchor.height - 62);
  }
}
