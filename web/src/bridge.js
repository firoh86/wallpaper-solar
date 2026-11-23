// Puente con wallpaper_solar (Python): recibe clics, arrastres, zoom y atajos reenviados por los hooks.

import { S } from './state.js';
import { exitMoonView, toggleMoonView } from './moon/transition.js';
import { selectBodyAt } from './input/pointer.js';
import { focusSelectedOrReset, linearFocusZoom, zoomStep } from './ui/camera.js';
import { btnPause, canvas, inspectorCard } from './ui/dom.js';
import { updateInspectorPanel } from './ui/hud.js';
import { applyPrimaryLayout } from './ui/layout.js';
import { layoutMoonView } from './moon/view.js';
import { scrollMissionList, selectMission } from './moon/missions.js';
import { closeBodiesMenu, isBodiesMenuOpen, isInsideBodiesMenu, scrollBodiesMenu } from './ui/bodies-menu.js';
import { isGlobeElement, pickMissionAt, resetGlobeView, rotateGlobeBy, zoomGlobeBy } from './moon/globe.js';

// Arrastres del wallpaper en la vista lunar: Python no avisa de dónde empezó el arrastre, así que
// los movimientos minúsculos de un clic normal (1-2 px) no deben girar el globo. Se agrupan por
// gesto (pausa > 150 ms = gesto nuevo) y sólo se aplican cuando el gesto supera 5 px.
const globeDrag = { lastT: 0, total: 0, held: { x: 0, y: 0 } };
function globeDragBy(dx, dy) {
  const now = performance.now();
  if (now - globeDrag.lastT > 150) {
    globeDrag.total = 0;
    globeDrag.held = { x: 0, y: 0 };
  }
  globeDrag.lastT = now;
  globeDrag.total += Math.hypot(dx, dy);
  if (globeDrag.total < 5) {
    globeDrag.held.x += dx;
    globeDrag.held.y += dy;
    return;
  }
  rotateGlobeBy(dx + globeDrag.held.x, dy + globeDrag.held.y);
  globeDrag.held = { x: 0, y: 0 };
}

// Puente interactivo para wallpaper_solar.py (multimonitor + clics en botones HUD + zoom/pan/3D/teclas)
window.__wallpaperBridge = {
  setPrimaryViewport(left, top, width, height) {
    S.primaryViewport = { left, top, width, height };
    applyPrimaryLayout();
    layoutMoonView();
  },
  clickAtClient(clientX, clientY) {
    // 1. Comprobar primero si el clic cayó sobre un botón o control interactivo del HUD
    const el = document.elementFromPoint(clientX, clientY);
    // La lista de cuerpos se cierra al pulsar fuera de ella (ese clic no hace nada más).
    if (isBodiesMenuOpen() && !isInsideBodiesMenu(el)) {
      closeBodiesMenu();
      return;
    }
    if (el) {
      const btn = el.closest('button');
      if (btn && !btn.disabled) {
        btn.click();
        return;
      }
      // Vista lunar: clic sobre un marcador del globo = seleccionar esa misión.
      if (S.view === 'moon' && isGlobeElement(el)) {
        const id = pickMissionAt(clientX, clientY);
        if (id) selectMission(id);
        return;
      }
      // Fuera de la vista del Sistema Solar sólo cuentan los botones.
      if (S.view !== 'solar') return;
      if (el.closest('#inspector-card') || el.closest('#hud-header') || el.closest('#hud-footer')) {
        return;
      }
    }
    // 2. Si no es un botón del HUD, seleccionar cuerpo celeste en el lienzo
    const rect = canvas.getBoundingClientRect();
    selectBodyAt(rect.left + clientX, rect.top + clientY);
  },
  dblClickAtClient(clientX, clientY) {
    if (S.view === 'moon') {
      if (isGlobeElement(document.elementFromPoint(clientX, clientY))) resetGlobeView();
      return;
    }
    if (S.view !== 'solar') return;
    const el = document.elementFromPoint(clientX, clientY);
    if (el && (el.closest('button') || el.closest('#inspector-card'))) return;
    const rect = canvas.getBoundingClientRect();
    selectBodyAt(rect.left + clientX, rect.top + clientY);
    if (S.selectedBodyId) {
      S.followSelected = true;
      const lz = linearFocusZoom(S.currentAllStates.find((b) => b.id === S.selectedBodyId));
      if (lz) S.zoom = lz;
      else if (S.zoom < 2.2) S.zoom = 3.0;
      updateInspectorPanel();
    }
  },
  panBy(dx, dy) {
    if (S.view === 'moon') {
      globeDragBy(dx, dy);
      return;
    }
    if (S.view !== 'solar') return;
    if (Math.hypot(dx, dy) > 2) S.followSelected = false;
    S.panOffset.x += dx;
    S.panOffset.y += dy;
  },
  rotate3DBy(dx, dy) {
    if (S.view === 'moon') {
      globeDragBy(dx, dy);
      return;
    }
    if (S.view !== 'solar') return;
    if (!S.is3DMode) return;
    S.camYaw -= dx * 0.0065;
    S.camPitch = Math.max(0.05, Math.min(Math.PI - 0.05, S.camPitch + dy * 0.0065));
  },
  // Rueda con posición (wallpaper_solar >= fase 2 lunar). steps > 0 = rueda hacia arriba.
  wheelAt(clientX, clientY, steps) {
    if (S.view === 'solar') {
      if (isBodiesMenuOpen() && isInsideBodiesMenu(document.elementFromPoint(clientX, clientY))) {
        scrollBodiesMenu(steps);
        return;
      }
      for (let i = 0; i < Math.abs(steps); i++) this.zoomByDelta(Math.sign(steps));
      return;
    }
    if (S.view === 'moon') {
      const el = document.elementFromPoint(clientX, clientY);
      if (el && el.closest('#mission-list')) scrollMissionList(steps);
      else if (isGlobeElement(el)) zoomGlobeBy(steps);
    }
  },
  zoomByDelta(delta) {
    if (S.view !== 'solar') return;
    zoomStep(delta > 0, 1.16);
  },
  shortcut(keyCode) {
    // Expansión lunar
    if (keyCode === 'KeyL') {
      toggleMoonView();
      return;
    }
    if (S.view === 'moon' && keyCode === 'Escape') {
      exitMoonView();
      return;
    }
    if (S.view !== 'solar') return;
    if (keyCode === 'Escape' && isBodiesMenuOpen()) {
      closeBodiesMenu();
      return;
    }

    if (keyCode === 'KeyF') {
      focusSelectedOrReset();
    } else if (keyCode === 'Space') {
      btnPause.click();
    } else if (keyCode === 'Escape') {
      S.selectedBodyId = null;
      S.followSelected = false;
      inspectorCard.classList.add('hidden');
    }
  }
};
