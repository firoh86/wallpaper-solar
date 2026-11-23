// Panel de misiones de la vista lunar: filtros, lista agrupada por década y ficha de detalle.

import {
  LUNAR_MISSIONS, MISSION_TYPES, OUTCOMES, COUNTRY_FILTERS, TYPE_FILTERS
} from '../data/lunar-missions.js';
import { animateGlobeTo, getGlobeView } from './globe.js';

// Distancia de cámara al enfocar una misión (más cerca que la vista general, 5.0).
const FOCUS_DIST = 3.4;

const $ = (id) => document.getElementById(id);

/** Estado de la interfaz lunar (se conserva entre visitas). */
export const moonUi = {
  typeFilter: 'todas',
  countryFilter: 'todos',
  selectedId: null,
  showMarkers: true,
  showLabels: false,
  lightMode: 'real',        // 'real' (Sol del instante simulado) | 'uniforme'
  panelCollapsed: false,    // panel de misiones plegado
  version: 0 // sube con cada cambio, para que la vista sepa cuándo redibujar el disco
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const OUTCOME_DOT = { exito: 'bg-[#22C55E]', parcial: 'bg-[#F59E0B]', fallo: 'bg-[#FC3D21]' };
const OUTCOME_TEXT = { exito: 'text-[#22C55E]', parcial: 'text-[#F59E0B]', fallo: 'text-[#FC3D21]' };

const CHIP_ON = 'nasa-btn-active px-2 py-1 mono text-[10px] uppercase tracking-wider';
const CHIP_OFF = 'nasa-btn px-2 py-1 mono text-[10px] uppercase tracking-wider text-[#8A99AD] border border-white/15';
const ITEM_BASE = 'mission-item w-full text-left px-2 py-2 flex gap-3 items-start border';
const ITEM_ON = `${ITEM_BASE} bg-[#0B3D91]/60 border-[#1C67E3]`;
const ITEM_OFF = `${ITEM_BASE} border-transparent hover:bg-white/5`;

export function formatMissionDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

export function isFarSide(m) {
  if (m.lat == null) return false;
  return Math.cos(m.lat * Math.PI / 180) * Math.cos(m.lon * Math.PI / 180) < 0;
}

export function formatCoords(m) {
  if (m.lat == null) return 'Sin punto en superficie';
  const ns = m.lat >= 0 ? 'N' : 'S';
  const ew = m.lon >= 0 ? 'E' : 'O';
  return `${Math.abs(m.lat).toFixed(2)}° ${ns} · ${Math.abs(m.lon).toFixed(2)}° ${ew}`;
}

function matchesFilters(m) {
  if (moonUi.typeFilter !== 'todas' && MISSION_TYPES[m.type].group !== moonUi.typeFilter) return false;
  if (moonUi.countryFilter !== 'todos') {
    const f = COUNTRY_FILTERS.find((c) => c.id === moonUi.countryFilter);
    const allowed = f.match ?? [f.id];
    if (!allowed.includes(m.country)) return false;
  }
  return true;
}

export function visibleMissions() {
  return LUNAR_MISSIONS.filter(matchesFilters);
}

export function selectedMission() {
  return LUNAR_MISSIONS.find((m) => m.id === moonUi.selectedId) ?? null;
}

function changed() {
  moonUi.version++;
}

// ---------------------------------------------------------------- render
function renderFilters() {
  $('mission-type-filters').innerHTML = TYPE_FILTERS.map((f) =>
    `<button type="button" data-type-filter="${f.id}" class="${f.id === moonUi.typeFilter ? CHIP_ON : CHIP_OFF}">${f.label}</button>`
  ).join('');
  $('mission-country-filters').innerHTML = COUNTRY_FILTERS.map((f) =>
    `<button type="button" data-country-filter="${f.id}" class="${f.id === moonUi.countryFilter ? CHIP_ON : CHIP_OFF}">${f.label}</button>`
  ).join('');
}

function renderList() {
  const list = visibleMissions();
  $('missions-count').textContent = `${list.length} / ${LUNAR_MISSIONS.length}`;

  let html = '';
  let decade = null;
  for (const m of list) {
    const d = Math.floor(Number(m.date.slice(0, 4)) / 10) * 10;
    if (d !== decade) {
      decade = d;
      html += `<div class="px-2 pt-3 pb-1 mono text-[10px] uppercase tracking-[0.14em] text-[#1C67E3]">Década de ${d}</div>`;
    }
    const sel = m.id === moonUi.selectedId;
    html += `
      <button type="button" data-mission="${m.id}" class="${sel ? ITEM_ON : ITEM_OFF}">
        <span class="mono text-[10px] text-[#8A99AD] w-[4.6rem] shrink-0 pt-px">${formatMissionDate(m.date)}</span>
        <span class="flex-1 min-w-0">
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 shrink-0 ${OUTCOME_DOT[m.outcome]}"></span>
            <span class="text-xs text-[#F8FAFC] truncate">${m.name}</span>
          </span>
          <span class="block mono text-[10px] text-[#8A99AD] truncate">${m.country} · ${MISSION_TYPES[m.type].label}</span>
        </span>
      </button>`;
  }
  if (!list.length) {
    html = '<p class="px-2 py-6 text-center mono text-[11px] text-[#8A99AD]">Ninguna misión con estos filtros</p>';
  }
  $('mission-list').innerHTML = html;
}

function renderCard() {
  const m = selectedMission();
  const card = $('mission-card');
  if (!m) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  $('mc-name').textContent = m.name;
  $('mc-meta').textContent = `${formatMissionDate(m.date)} · ${m.country} · ${m.agency}`;
  $('mc-type').textContent = MISSION_TYPES[m.type].label;
  const out = $('mc-outcome');
  out.textContent = OUTCOMES[m.outcome];
  out.className = `mono text-right ${OUTCOME_TEXT[m.outcome]}`;
  $('mc-site').textContent = m.site ?? (m.type === 'sobrevuelo' || m.type === 'tripulada-orbital' ? 'Sobrevuelo' : 'Órbita lunar');
  $('mc-coords').textContent = formatCoords(m) + (isFarSide(m) ? ' · cara oculta' : '');
  $('mc-summary').textContent = m.summary;
}

function renderToggles() {
  const light = $('btn-moon-light');
  light.textContent = `Luz: ${moonUi.lightMode === 'real' ? 'Real' : 'Uniforme'}`;

  $('moon-view-inner').dataset.missions = moonUi.panelCollapsed ? 'collapsed' : 'open';
  $('btn-missions-toggle').textContent = moonUi.panelCollapsed ? '▾ Desplegar' : '▴ Plegar';

  const markers = $('btn-moon-markers');
  markers.textContent = `Marcadores: ${moonUi.showMarkers ? 'ON' : 'OFF'}`;
  markers.classList.toggle('text-[#F8FAFC]', moonUi.showMarkers);
  markers.classList.toggle('text-[#8A99AD]', !moonUi.showMarkers);
  const labels = $('btn-moon-labels');
  labels.textContent = `Nombres: ${moonUi.showLabels ? 'ON' : 'OFF'}`;
  labels.classList.toggle('text-[#F8FAFC]', moonUi.showLabels);
  labels.classList.toggle('text-[#8A99AD]', !moonUi.showLabels);
}

export function renderMissionsPanel() {
  renderFilters();
  renderList();
  renderCard();
  renderToggles();
}

// --------------------------------------------------------------- acciones
export function selectMission(id) {
  moonUi.selectedId = moonUi.selectedId === id ? null : id;
  changed();
  renderList();
  renderCard();
  const btn = document.querySelector(`[data-mission="${moonUi.selectedId}"]`);
  if (btn) btn.scrollIntoView({ block: 'nearest' });

  // Fase 4: el globo gira (camino corto) hasta poner el lugar de la misión de frente.
  const m = selectedMission();
  if (m && m.lat != null) {
    animateGlobeTo(m.lat, m.lon, Math.min(getGlobeView().dist, FOCUS_DIST), 950);
  }
}

export function clearMissionSelection() {
  if (!moonUi.selectedId) return false;
  moonUi.selectedId = null;
  changed();
  renderList();
  renderCard();
  return true;
}

function setTypeFilter(id) {
  moonUi.typeFilter = id;
  afterFilter();
}

function setCountryFilter(id) {
  moonUi.countryFilter = id;
  afterFilter();
}

function afterFilter() {
  // Si la misión seleccionada queda fuera del filtro, se deselecciona.
  const m = selectedMission();
  if (m && !matchesFilters(m)) moonUi.selectedId = null;
  changed();
  renderMissionsPanel();
  $('mission-list').scrollTop = 0;
}

/** Desplaza la lista (rueda reenviada por el wallpaper). steps > 0 = hacia arriba. */
export function scrollMissionList(steps) {
  $('mission-list').scrollBy({ top: -steps * 72 });
}

/** Un solo listener por contenedor: vale para el ratón directo y para btn.click() del puente. */
export function initMissionsPanel() {
  $('mission-type-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-type-filter]');
    if (b) setTypeFilter(b.dataset.typeFilter);
  });
  $('mission-country-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-country-filter]');
    if (b) setCountryFilter(b.dataset.countryFilter);
  });
  $('mission-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mission]');
    if (!b) return;
    // en pantalla pequeña el panel tapa la Luna: se pliega para ver dónde está la misión
    if ($('moon-view-inner').dataset.small === 'true' && !moonUi.panelCollapsed) {
      moonUi.panelCollapsed = true;
      changed();
      renderToggles();
    }
    selectMission(b.dataset.mission);
  });
  $('btn-mission-close').addEventListener('click', clearMissionSelection);
  $('btn-moon-markers').addEventListener('click', () => {
    moonUi.showMarkers = !moonUi.showMarkers;
    changed();
    renderToggles();
  });
  $('btn-moon-light').addEventListener('click', () => {
    moonUi.lightMode = moonUi.lightMode === 'real' ? 'uniforme' : 'real';
    changed();
    renderToggles();
  });
  $('btn-missions-toggle').addEventListener('click', () => {
    moonUi.panelCollapsed = !moonUi.panelCollapsed;
    changed();
    renderToggles();
  });
  $('btn-moon-labels').addEventListener('click', () => {
    moonUi.showLabels = !moonUi.showLabels;
    changed();
    renderToggles();
  });
  renderMissionsPanel();
}
