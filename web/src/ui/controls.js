// Botones de la barra inferior y del panel de telemetría.

import { S } from '../state.js';
import { enterMoonView, exitMoonView } from '../moon/transition.js';
import { MOONS } from '../data/moons.js';
import { initVerletFromEpoch } from '../physics/verlet.js';
import { focusSelectedOrReset, linearFocusZoom } from './camera.js';
import { btnFollowBody, btnPause, btnScaleMode, btnToggle3D, btnToggleEngine, btnToggleGuides, btnToggleMoons, engineBadgeEl, inspectorCard, rateButtons } from './dom.js';
import { updateInspectorPanel } from './hud.js';
import { showToast } from './toast.js';

btnPause.addEventListener('click', () => {
  S.isPaused = !S.isPaused;
  btnPause.textContent = S.isPaused ? 'Reanudar' : 'Pausar';
  btnPause.className = S.isPaused
    ? 'nasa-btn-active px-2.5 py-1.5 font-medium uppercase tracking-wider'
    : 'nasa-btn px-2.5 py-1.5 font-medium uppercase tracking-wider text-[#F8FAFC]';
});

rateButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    S.timeRate = Number(btn.dataset.rate);
    if (S.isPaused) {
      S.isPaused = false;
      btnPause.textContent = 'Pausar';
      btnPause.className = 'nasa-btn px-2.5 py-1.5 font-medium uppercase tracking-wider text-[#F8FAFC]';
    }
    rateButtons.forEach((b) => {
      b.className = 'rate-btn nasa-btn px-2 py-1.5 mono text-[#8A99AD]';
    });
    btn.className = 'rate-btn nasa-btn-active px-2 py-1.5 mono font-medium';
  });
});

document.getElementById('btn-now').addEventListener('click', () => {
  S.simEpochMs = Date.now();
  S.timeRate = 1;
  S.isPaused = false;
  btnPause.textContent = 'Pausar';
  btnPause.className = 'nasa-btn px-2.5 py-1.5 font-medium uppercase tracking-wider text-[#F8FAFC]';

  if (S.physicsEngine === 'verlet') {
    initVerletFromEpoch(S.simEpochMs);
  }

  rateButtons.forEach((b) => {
    const isOneX = Number(b.dataset.rate) === 1;
    b.className = isOneX
      ? 'rate-btn nasa-btn-active px-2 py-1.5 mono font-medium'
      : 'rate-btn nasa-btn px-2 py-1.5 mono text-[#8A99AD]';
  });
  showToast('SINCRONIZADO // INSTANTE REAL UTC');
});

btnToggle3D.addEventListener('click', () => {
  S.is3DMode = !S.is3DMode;
  btnToggle3D.textContent = `3D: ${S.is3DMode ? 'ON' : 'OFF'}`;
  btnToggle3D.className = S.is3DMode
    ? 'nasa-btn-active px-2.5 py-1.5 mono font-medium'
    : 'nasa-btn px-2.5 py-1.5 mono text-[#8A99AD]';
  showToast(S.is3DMode ? 'PROYECCIÓN 3D // CLIC DER. PARA ROTAR' : 'PROYECCIÓN 2D // PLANO ECLÍPTICO');
});

btnScaleMode.addEventListener('click', () => {
  S.scaleMode = S.scaleMode === 'visual' ? 'linear' : 'visual';
  btnScaleMode.textContent = `Escala: ${S.scaleMode === 'visual' ? 'Visual' : '1:1 AU'}`;
  S.zoom = S.scaleMode === 'visual' ? 1.0 : 2.4;
  if (!S.followSelected) S.panOffset = { x: 0, y: 0 };
  showToast(`ESCALA // ${S.scaleMode === 'visual' ? 'VISUAL EQUILIBRADA' : 'REAL 1:1 AU'}`);
});

btnToggleMoons.addEventListener('click', () => {
  S.showMoons = !S.showMoons;
  btnToggleMoons.textContent = `Lunas: ${S.showMoons ? 'ON' : 'OFF'}`;
  btnToggleMoons.className = S.showMoons
    ? 'nasa-btn px-2.5 py-1.5 mono text-[#F8FAFC]'
    : 'nasa-btn px-2.5 py-1.5 mono text-[#8A99AD]';
  if (!S.showMoons && S.selectedBodyId && MOONS.some((m) => m.id === S.selectedBodyId)) {
    S.selectedBodyId = null;
    S.followSelected = false;
    inspectorCard.classList.add('hidden');
  }
});

btnToggleGuides.addEventListener('click', () => {
  S.showGuides = !S.showGuides;
  btnToggleGuides.textContent = `Guías: ${S.showGuides ? 'ON' : 'OFF'}`;
  btnToggleGuides.className = S.showGuides
    ? 'nasa-btn px-2.5 py-1.5 mono text-[#F8FAFC]'
    : 'nasa-btn px-2.5 py-1.5 mono text-[#8A99AD]';
});

btnToggleEngine.addEventListener('click', () => {
  if (S.physicsEngine === 'kepler') {
    S.physicsEngine = 'verlet';
    initVerletFromEpoch(S.simEpochMs);
    btnToggleEngine.textContent = 'Motor: N-Cuerpos';
    engineBadgeEl.textContent = 'VERLET N-BODY (SI)';
    showToast('MOTOR // GRAVEDAD N-CUERPOS VELOCITY VERLET');
  } else {
    S.physicsEngine = 'kepler';
    btnToggleEngine.textContent = 'Motor: JPL';
    engineBadgeEl.textContent = 'JPL J2000.0';
    showToast('MOTOR // EFEMÉRIDES ANALÍTICAS JPL J2000.0');
  }
});

document.getElementById('btn-center').addEventListener('click', focusSelectedOrReset);

btnFollowBody.addEventListener('click', () => {
  if (!S.selectedBodyId) return;
  S.followSelected = !S.followSelected;
  const lz = S.followSelected ? linearFocusZoom(S.currentAllStates.find((b) => b.id === S.selectedBodyId)) : null;
  if (lz) {
    S.zoom = lz;
  } else if (S.followSelected && S.zoom < 1.8) {
    S.zoom = 2.6;
  }
  updateInspectorPanel();
});

document.getElementById('btn-close-inspector').addEventListener('click', () => {
  S.selectedBodyId = null;
  S.followSelected = false;
  inspectorCard.classList.add('hidden');
});

// Expansión lunar
document.getElementById('btn-explore-moon').addEventListener('click', enterMoonView);
document.getElementById('btn-explore-moon-insp').addEventListener('click', enterMoonView);
document.getElementById('btn-moon-back').addEventListener('click', exitMoonView);
