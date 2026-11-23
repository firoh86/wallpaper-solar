// Punto de entrada: estilos, fuentes y arranque.

import './styles/fonts.css';
import './styles/main.css';

import { S } from './state.js';
import { animate } from './loop.js';
import { initVerletFromEpoch } from './physics/verlet.js';
import { focusSelectedOrReset } from './ui/camera.js';
import { resizeCanvas } from './ui/layout.js';
import { layoutMoonView } from './moon/view.js';
import { initMissionsPanel } from './moon/missions.js';
import { initBodiesMenu } from './ui/bodies-menu.js';

// Módulos que sólo registran eventos o funciones globales al cargarse.
import './bridge.js';
import './input/pointer.js';
import './ui/controls.js';

// wallpaper_solar (Python) llama a esta función desde la bandeja ("Centrar Sistema Solar").
// En la vista lunar no hace nada: primero hay que volver al Sistema Solar.
window.focusSelectedOrReset = () => {
  if (S.view === 'solar') focusSelectedOrReset();
};

document.body.dataset.view = S.view;
initMissionsPanel();
initBodiesMenu();

// Pruebas automáticas: index.html?debug expone el estado para inspeccionarlo.
if (new URLSearchParams(location.search).has('debug')) {
  window.__S = S;
  import('./moon/globe.js').then((g) => { window.__globe = g; });
}

window.addEventListener('resize', () => {
  resizeCanvas();
  layoutMoonView();
});

window.onload = function () {
  resizeCanvas();
  S.simEpochMs = Date.now();
  initVerletFromEpoch(S.simEpochMs);
  S.lastPerfMs = performance.now();
  S.rafId = requestAnimationFrame(animate);
};
