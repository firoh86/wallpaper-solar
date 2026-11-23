// Bucle de animación y pausa externa (pantalla completa).

import { S } from './state.js';
import { updateMoonView } from './moon/view.js';
import { renderScene } from './render/scene.js';
import { updateInspectorPanel, updateTelemetryClock } from './ui/hud.js';

window.__setExternalPause = function (paused) {
  const nextPaused = Boolean(paused);
  if (S.externalPaused === nextPaused) return;
  S.externalPaused = nextPaused;
  S.lastPerfMs = performance.now();

  if (S.externalPaused) {
    if (S.rafId !== null) {
      cancelAnimationFrame(S.rafId);
      S.rafId = null;
    }
  } else if (S.rafId === null) {
    S.rafId = requestAnimationFrame(animate);
  }
};

export function animate(nowPerfMs) {
  if (S.externalPaused) {
    S.lastPerfMs = nowPerfMs;
    S.rafId = null;
    return;
  }

  const dtRealMs = nowPerfMs - S.lastPerfMs;
  S.lastPerfMs = nowPerfMs;

  if (!S.isPaused) {
    if (S.timeRate === 1 && Math.abs(Date.now() - S.simEpochMs) < 1500) {
      S.simEpochMs = Date.now();
    } else {
      S.simEpochMs += dtRealMs * S.timeRate;
    }
  }

  updateTelemetryClock(S.simEpochMs);
  if (S.view === 'moon') {
    // El Sistema Solar queda oculto: se ahorra su dibujo y sólo se actualiza la vista lunar.
    updateMoonView();
  } else {
    renderScene(S.simEpochMs);
    updateInspectorPanel();
  }

  S.rafId = requestAnimationFrame(animate);
}
