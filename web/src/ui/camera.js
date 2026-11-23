// Enfoque de cámara: seguir el cuerpo seleccionado o volver a la vista general.

import { S } from '../state.js';
import { AU_KM } from '../core/constants.js';
import { MOONS } from '../data/moons.js';
import { getAnchorBounds } from './layout.js';
import { updateInspectorPanel } from './hud.js';
import { showToast } from './toast.js';

// ------------------------------------------------------------------- zoom
// En escala visual las lunas se dibujan en anillos y basta con 35×. En escala real están a
// su distancia de verdad (Fobos a 9.400 km de Marte) y hace falta muchísimo más zoom.
export const ZOOM_MIN = 0.25;
const ZOOM_MAX_VISUAL = 35;
const ZOOM_MAX_LINEAR = 20000;

export function maxZoom() {
  return S.scaleMode === 'linear' ? ZOOM_MAX_LINEAR : ZOOM_MAX_VISUAL;
}

/** Un paso de rueda. baseFactor es el de siempre (1,14 ratón / 1,16 wallpaper); por encima de
 *  35× en escala real los pasos son más grandes para no necesitar cientos de clics de rueda. */
export function zoomStep(zoomIn, baseFactor) {
  const factor = S.scaleMode === 'linear' && S.zoom >= ZOOM_MAX_VISUAL ? 1.35 : baseFactor;
  const next = zoomIn ? S.zoom * factor : S.zoom / factor;
  S.zoom = Math.max(ZOOM_MIN, Math.min(maxZoom(), next));
}

/** Zoom continuo (pellizco en pantallas táctiles), dentro de los límites de la escala actual. */
export function setZoomClamped(z) {
  S.zoom = Math.max(ZOOM_MIN, Math.min(maxZoom(), z));
}

/**
 * Escala real: zoom para encuadrar un cuerpo con sus lunas separadas.
 *  - luna: queda a ~140 px de su planeta
 *  - planeta con lunas: la luna más lejana queda a ~220 px
 * Devuelve null si no aplica (escala visual o cuerpo sin lunas): se usa el zoom de siempre.
 */
export function linearFocusZoom(body) {
  if (S.scaleMode !== 'linear' || !body) return null;
  const b = getAnchorBounds();
  const pxPerAu = Math.min(b.width, b.height) * 0.43 * 0.36; // igual que render/projection.js con zoom 1
  let distAu, wantPx;
  if (body.isMoon && body.relPosAu) {
    distAu = Math.hypot(body.relPosAu.x, body.relPosAu.y, body.relPosAu.z);
    wantPx = 140;
  } else {
    const moons = MOONS.filter((m) => m.hostId === body.id);
    if (!moons.length) return null;
    distAu = Math.max(...moons.map((m) => (m.aKm ?? 384400) / AU_KM));
    wantPx = 220;
  }
  if (!(distAu > 0)) return null;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX_LINEAR, wantPx / (pxPerAu * distAu)));
}

export function focusSelectedOrReset() {
  if (S.selectedBodyId) {
    S.followSelected = true;
    const target = S.currentAllStates.find((b) => b.id === S.selectedBodyId);
    const linearZoom = linearFocusZoom(target);
    if (linearZoom) {
      S.zoom = linearZoom;
    } else if (S.zoom < 2.2) {
      S.zoom = 2.8;
    }
    if (target) {
      showToast(`ENFOQUE // ${target.name.toUpperCase()}`);
    }
    updateInspectorPanel();
  } else {
    S.followSelected = false;
    S.panOffset = { x: 0, y: 0 };
    S.zoom = S.scaleMode === 'visual' ? 1.0 : 2.4;
    if (S.is3DMode) {
      S.camYaw = 0.55;
      S.camPitch = 0.92;
    }
    showToast('VISTA // SISTEMA SOLAR CENTRADO');
  }
}
