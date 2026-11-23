// Expansión lunar · Fase 1: guardar la cámara, viajar hasta la Luna con fundido a negro
// y volver al punto exacto de partida.
//
// Flujo de S.view:  'solar' -> 'to-moon' -> 'moon' -> 'to-solar' -> 'solar'
// Mientras no es 'solar', la entrada del Sistema Solar (ratón, puente) queda bloqueada.

import { S } from '../state.js';
import { auToScreen, moonToScreen } from '../render/projection.js';
import { inspectorCard } from '../ui/dom.js';
import { updateInspectorPanel } from '../ui/hud.js';
import { showMoonView, hideMoonView } from './view.js';

const TO_MOON_MS = 1400;        // duración del acercamiento
const FADE_START = 0.7;         // el fundido empieza en el último 30 %
const TO_SOLAR_MS = 650;        // duración del fundido de vuelta
const TARGET_ZOOM = { visual: 24, linear: 35 };

const fadeEl = () => document.getElementById('moon-fade');

function setView(view) {
  S.view = view;
  document.body.dataset.view = view;
}

// ------------------------------------------------------------------ cámara
export function saveCameraState() {
  return {
    zoom: S.zoom,
    panOffset: { ...S.panOffset },
    followSelected: S.followSelected,
    selectedBodyId: S.selectedBodyId,
    is3DMode: S.is3DMode,
    camYaw: S.camYaw,
    camPitch: S.camPitch,
    scaleMode: S.scaleMode
  };
}

export function restoreCameraState(snap) {
  if (!snap) return;
  S.zoom = snap.zoom;
  S.panOffset = { ...snap.panOffset };
  S.followSelected = snap.followSelected;
  S.selectedBodyId = snap.selectedBodyId;
  S.is3DMode = snap.is3DMode;
  S.camYaw = snap.camYaw;
  S.camPitch = snap.camPitch;
  S.scaleMode = snap.scaleMode;
  if (S.selectedBodyId) updateInspectorPanel();
  else inspectorCard.classList.add('hidden');
}

// ------------------------------------------------------------- utilidades
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Desplazamiento en pantalla de la Luna respecto al centro, para un zoom dado (sin pan). */
function moonOffsetAt(zoom, originCenter, baseRadiusPx) {
  const moon = S.currentAllStates.find((b) => b.id === 'moon');
  const earth = S.currentAllStates.find((b) => b.id === 'earth');
  if (!moon || !earth) return null;
  const earthSp = auToScreen(earth.pos, originCenter, baseRadiusPx, zoom);
  const sp = moonToScreen(moon, earthSp, originCenter, baseRadiusPx, zoom);
  return { x: sp.x - originCenter.x, y: sp.y - originCenter.y };
}

// ----------------------------------------------------------------- entrada
export function enterMoonView() {
  if (S.view !== 'solar') return;
  S.cameraSnapshot = saveCameraState();

  // La Luna queda resaltada durante el viaje; la cámara la conduce la transición.
  S.selectedBodyId = 'moon';
  S.followSelected = false;
  inspectorCard.classList.add('hidden');

  S.moonTransition = {
    t0: performance.now(),
    z0: S.zoom,
    z1: Math.max(S.zoom, TARGET_ZOOM[S.scaleMode] ?? 24),
    p0: { ...S.panOffset },
    s0: null // posición inicial de la Luna en pantalla (se fija en el primer fotograma)
  };
  setView('to-moon');
}

/**
 * Lo llama renderScene en cada fotograma de la ida, después de calcular las posiciones
 * y antes de dibujar. Ajusta S.zoom y S.panOffset para que la Luna se desplace en línea
 * recta hasta el centro mientras el zoom crece de forma geométrica.
 */
export function applyTransitionCamera(originCenter, baseRadiusPx) {
  const tr = S.moonTransition;
  if (!tr || S.view !== 'to-moon') return;

  const p = clamp01((performance.now() - tr.t0) / TO_MOON_MS);
  const e = easeInOutCubic(p);

  if (!tr.s0) {
    const f0 = moonOffsetAt(tr.z0, originCenter, baseRadiusPx);
    if (!f0) return;
    tr.s0 = { x: originCenter.x + tr.p0.x + f0.x, y: originCenter.y + tr.p0.y + f0.y };
  }

  const zoom = tr.z0 * Math.pow(tr.z1 / tr.z0, e);
  const f = moonOffsetAt(zoom, originCenter, baseRadiusPx);
  if (!f) return;

  // Posición deseada de la Luna: del punto inicial al centro, en línea recta.
  const want = {
    x: tr.s0.x + (originCenter.x - tr.s0.x) * e,
    y: tr.s0.y + (originCenter.y - tr.s0.y) * e
  };
  S.zoom = zoom;
  S.panOffset = { x: want.x - originCenter.x - f.x, y: want.y - originCenter.y - f.y };

  const fade = fadeEl();
  if (fade) fade.style.opacity = String(clamp01((p - FADE_START) / (1 - FADE_START)));

  if (p >= 1) finishEnter();
}

function finishEnter() {
  S.moonTransition = null;
  setView('moon');
  showMoonView();
  const fade = fadeEl();
  if (fade) fade.style.opacity = '0'; // la vista lunar ya tapa la pantalla
}

// ------------------------------------------------------------------ salida
export function exitMoonView() {
  if (S.view !== 'moon') return;
  setView('to-solar');

  // Bajo el negro: restaurar la cámara exacta y volver a mostrar el Sistema Solar.
  const fade = fadeEl();
  if (fade) {
    fade.style.transition = 'none';
    fade.style.opacity = '1';
  }
  hideMoonView();
  restoreCameraState(S.cameraSnapshot);
  S.cameraSnapshot = null;

  // Fundido de vuelta.
  requestAnimationFrame(() => {
    if (fade) {
      fade.style.transition = `opacity ${TO_SOLAR_MS}ms ease-out`;
      fade.style.opacity = '0';
    }
    setTimeout(() => {
      if (fade) fade.style.transition = 'none';
      setView('solar');
    }, TO_SOLAR_MS);
  });
}

export function toggleMoonView() {
  if (S.view === 'solar') enterMoonView();
  else if (S.view === 'moon') exitMoonView();
}
