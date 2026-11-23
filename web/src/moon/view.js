// Vista lunar: globo 3D (moon/globe.js), panel de misiones (moon/missions.js) y telemetría.
// El globo no rota solo; con 'Luz: Real' el Sol lo ilumina como en el instante simulado.

import { S } from '../state.js';
import { AU_KM } from '../core/constants.js';
import { computeAllKeplerStates } from '../physics/kepler.js';
import { getAnchorBounds } from '../ui/layout.js';
import { computeLunarPhase, findNextLunarPhase } from './phase.js';
import { moonUi, visibleMissions, renderMissionsPanel, selectMission } from './missions.js';
import { initGlobe, onGlobePick, requestRender, setLightMode, setSunDirection, HAS_REAL_TEXTURE } from './globe.js';
import { subsolarPoint } from './sunlight.js';

const $ = (id) => document.getElementById(id);
let lastMarkersVersion = -1;
let globeReady = false;

function ensureGlobe() {
  if (globeReady) return;
  globeReady = true;
  initGlobe($('globe-container'), () => ({
    missions: visibleMissions(),
    selectedId: moonUi.selectedId,
    showMarkers: moonUi.showMarkers,
    showLabels: moonUi.showLabels,
    cardRect: moonUi.selectedId && !$('mission-card').classList.contains('hidden')
      ? $('mission-card').getBoundingClientRect()
      : null
  }));
  onGlobePick(selectMission);
  if (HAS_REAL_TEXTURE) {
    $('globe-credit').classList.remove('hidden');
  } else {
    $('globe-hint').textContent += ' · Textura provisional';
  }
}

export function showMoonView() {
  const view = $('moon-view');
  view.classList.remove('hidden');
  layoutMoonView();
  watchCompact();
  ensureGlobe();
  renderMissionsPanel();
  requestRender();
  updateMoonView();
  // Aparición suave del contenido sobre el negro.
  view.style.opacity = '0';
  requestAnimationFrame(() => {
    view.style.transition = 'opacity 350ms ease-out';
    view.style.opacity = '1';
  });
}

export function hideMoonView() {
  const view = $('moon-view');
  view.style.transition = 'none';
  view.classList.add('hidden');
}

/** Coloca el contenido dentro del monitor principal (igual que el HUD en multimonitor). */
export function layoutMoonView() {
  const inner = $('moon-view-inner');
  if (!inner) return;
  const b = getAnchorBounds();
  inner.style.left = `${b.left}px`;
  inner.style.top = `${b.top}px`;
  inner.style.width = `${b.width}px`;
  inner.style.height = `${b.height}px`;
  updateCompact();
}

// Modo compacto según el ancho real de la zona de la Luna (cambia también al plegar el panel).
const COMPACT_BELOW_PX = 1120;
function updateCompact() {
  const inner = $('moon-view-inner');
  const stage = $('moon-stage');
  if (!inner || !stage || !stage.clientWidth) return;
  inner.dataset.compact = String(stage.clientWidth < COMPACT_BELOW_PX);
}
let compactObserver = null;
function watchCompact() {
  if (compactObserver) return;
  compactObserver = new ResizeObserver(updateCompact);
  compactObserver.observe($('moon-stage'));
}

const fmtInt = (v) => Math.round(v).toLocaleString('es-ES');
const fmtLatLon = (lat, lon) =>
  `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'O'}`;

// Las fechas de la próxima llena / nueva se recalculan sólo cuando el tiempo
// simulado pasa de la fecha calculada o salta (botón AHORA, velocidades altas hacia atrás…).
let phaseCache = { from: NaN, full: null, newMoon: null };
function nextPhases(simMs) {
  const c = phaseCache;
  const stale = !(simMs >= c.from) || (c.full && simMs >= c.full) || (c.newMoon && simMs >= c.newMoon);
  if (stale) {
    phaseCache = { from: simMs, full: findNextLunarPhase(simMs, 180), newMoon: findNextLunarPhase(simMs, 0) };
  }
  return phaseCache;
}

function fmtEvent(eventMs, simMs) {
  if (!eventMs) return '--';
  const days = (eventMs - simMs) / 86400000;
  const d = new Date(eventMs);
  const pad = (n) => String(n).padStart(2, '0');
  const when = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return days < 1 ? `${when} · ${Math.max(0, days * 24).toFixed(0)} h` : `${when} · ${days.toFixed(1)} d`;
}

export function updateMoonView() {
  if (S.view !== 'moon') return;

  const states = computeAllKeplerStates(S.simEpochMs);
  const earth = states.find((b) => b.id === 'earth');
  const moon = states.find((b) => b.id === 'moon');
  if (!earth || !moon) return;

  const ph = computeLunarPhase(earth, moon);
  const next = nextPhases(S.simEpochMs);
  const distKm = Math.hypot(moon.relPosAu.x, moon.relPosAu.y, moon.relPosAu.z) * AU_KM;
  const velKmS = moon.relSpeedKmS;

  $('moon-phase-name').textContent = ph.name;
  $('moon-illum').textContent = `${(ph.illumination * 100).toFixed(1)} %`;
  $('moon-age').textContent = `${ph.ageDays.toFixed(1)} d`;
  $('moon-dist').textContent = `${fmtInt(distKm)} km`;
  $('moon-vel').textContent = `${velKmS.toFixed(3)} km/s`;
  $('moon-next-full').textContent = fmtEvent(next.full, S.simEpochMs);
  $('moon-next-new').textContent = fmtEvent(next.newMoon, S.simEpochMs);

  // Luz del Sol en tiempo real: el globo sólo se redibuja si el punto subsolar se mueve.
  const sub = subsolarPoint(S.simEpochMs);
  setSunDirection(sub.lat, sub.lon);
  $('moon-subsolar').textContent = fmtLatLon(sub.lat, sub.lon);

  // Cambios de interfaz (selección, filtros, conmutadores, luz, panel plegado).
  if (moonUi.version !== lastMarkersVersion) {
    lastMarkersVersion = moonUi.version;
    setLightMode(moonUi.lightMode);
    requestRender();
  }
}
