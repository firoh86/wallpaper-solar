// Ratón, táctil y teclado directos sobre el lienzo (cuando no corre como wallpaper).

import { S } from '../state.js';
import { exitMoonView, toggleMoonView } from '../moon/transition.js';
import { focusSelectedOrReset, linearFocusZoom, setZoomClamped, zoomStep } from '../ui/camera.js';
import { closeBodiesMenu, isBodiesMenuOpen } from '../ui/bodies-menu.js';
import { btnPause, canvas, inspectorCard } from '../ui/dom.js';
import { updateInspectorPanel } from '../ui/hud.js';

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (S.view !== 'solar') return;
  zoomStep(e.deltaY < 0, 1.14);
}, { passive: false });

let isDragging = false;

let isRotating3D = false;

let movedDist = 0;

let dragStart = { x: 0, y: 0 };

let rotateStart = { x: 0, y: 0, yaw: 0, pitch: 0 };

canvas.addEventListener('contextmenu', (e) => {
  if (S.is3DMode) e.preventDefault();
});

export function selectBodyAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  let best = null;
  let bestScore = Infinity;

  for (const target of S.bodyHitTargets) {
    const d = Math.hypot(x - target.x, y - target.y);
    if (d <= target.hitRadius) {
      const score = d - (target.priority === 2 ? 4 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = target;
      }
    }
  }

  if (best) {
    S.selectedBodyId = best.id;
    updateInspectorPanel();
  } else {
    S.selectedBodyId = null;
    S.followSelected = false;
    inspectorCard.classList.add('hidden');
  }
}

canvas.addEventListener('mousedown', (e) => {
  if (S.view !== 'solar') return;
  if (S.is3DMode && (e.button === 2 || e.shiftKey)) {
    isRotating3D = true;
    rotateStart = { x: e.clientX, y: e.clientY, yaw: S.camYaw, pitch: S.camPitch };
    return;
  }
  if (e.button === 0) {
    isDragging = true;
    movedDist = 0;
    dragStart = { x: e.clientX - S.panOffset.x, y: e.clientY - S.panOffset.y };
  }
});

window.addEventListener('mousemove', (e) => {
  if (isRotating3D) {
    const dx = e.clientX - rotateStart.x;
    const dy = e.clientY - rotateStart.y;
    S.camYaw = rotateStart.yaw - dx * 0.0065;
    S.camPitch = Math.max(0.05, Math.min(Math.PI - 0.05, rotateStart.pitch + dy * 0.0065));
    return;
  }
  if (!isDragging) return;
  const nx = e.clientX - dragStart.x;
  const ny = e.clientY - dragStart.y;
  movedDist += Math.hypot(nx - S.panOffset.x, ny - S.panOffset.y);
  if (movedDist > 4) S.followSelected = false;
  S.panOffset.x = nx;
  S.panOffset.y = ny;
});

window.addEventListener('mouseup', (e) => {
  if (isRotating3D) {
    isRotating3D = false;
    return;
  }
  if (isDragging && movedDist < 5 && e.button === 0) {
    selectBodyAt(e.clientX, e.clientY);
  }
  isDragging = false;
});

canvas.addEventListener('dblclick', (e) => {
  if (S.view !== 'solar') return;
  selectBodyAt(e.clientX, e.clientY);
  if (S.selectedBodyId) {
    S.followSelected = true;
    const lz = linearFocusZoom(S.currentAllStates.find((b) => b.id === S.selectedBodyId));
    if (lz) S.zoom = lz;
    else if (S.zoom < 2.2) S.zoom = 3.0;
    updateInspectorPanel();
  }
});

// Táctil (versión web): un dedo desplaza y, si apenas se mueve, selecciona; dos dedos acercan/alejan
// (pellizco) y, en 3D, al moverlos juntos giran la cámara.
let pinch = null;
const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
const touchMid = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

canvas.addEventListener('touchstart', (e) => {
  if (S.view !== 'solar') return;
  if (e.touches.length === 1) {
    isDragging = true;
    movedDist = 0;
    dragStart = {
      x: e.touches[0].clientX - S.panOffset.x,
      y: e.touches[0].clientY - S.panOffset.y
    };
  } else if (e.touches.length === 2) {
    isDragging = false;
    const m = touchMid(e.touches);
    pinch = { d0: touchDist(e.touches) || 1, z0: S.zoom, x0: m.x, y0: m.y, yaw0: S.camYaw, pitch0: S.camPitch };
  }
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
  if (pinch && e.touches.length === 2) {
    setZoomClamped(pinch.z0 * (touchDist(e.touches) / pinch.d0));
    if (S.is3DMode) {
      const m = touchMid(e.touches);
      S.camYaw = pinch.yaw0 - (m.x - pinch.x0) * 0.0065;
      S.camPitch = Math.max(0.05, Math.min(Math.PI - 0.05, pinch.pitch0 + (m.y - pinch.y0) * 0.0065));
    }
    return;
  }
  if (isDragging && e.touches.length === 1) {
    const nx = e.touches[0].clientX - dragStart.x;
    const ny = e.touches[0].clientY - dragStart.y;
    movedDist += Math.hypot(nx - S.panOffset.x, ny - S.panOffset.y);
    if (movedDist > 6) S.followSelected = false;
    S.panOffset.x = nx;
    S.panOffset.y = ny;
  }
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  if (pinch) {
    // al levantar un dedo del pellizco no se selecciona nada ni se salta el desplazamiento
    if (e.touches.length === 0) pinch = null;
    isDragging = false;
    return;
  }
  if (isDragging && movedDist < 8 && e.changedTouches.length === 1) {
    selectBodyAt(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }
  isDragging = false;
});

window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

  // Expansión lunar: L abre/cierra la vista lunar; Esc vuelve; el resto no actúa fuera del Sistema Solar.
  if (e.code === 'KeyL') {
    e.preventDefault();
    toggleMoonView();
    return;
  }
  if (S.view === 'moon' && e.key === 'Escape') {
    exitMoonView();
    return;
  }
  if (S.view !== 'solar') return;
  if (e.key === 'Escape' && isBodiesMenuOpen()) {
    closeBodiesMenu();
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    btnPause.click();
  } else if (e.code === 'KeyF') {
    e.preventDefault();
    focusSelectedOrReset();
  } else if (e.key === 'Escape') {
    S.selectedBodyId = null;
    S.followSelected = false;
    inspectorCard.classList.add('hidden');
  }
});
