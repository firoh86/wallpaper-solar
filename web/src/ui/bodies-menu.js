// Lista flotante de cuerpos (botón "Cuerpos ▾" de la barra inferior): elegir cualquier planeta
// o luna, seleccionarlo y centrar la cámara en él (siguiéndolo). En escala real el zoom se ajusta
// para que se vean sus lunas separadas (ver linearFocusZoom en camera.js).

import { S } from '../state.js';
import { PLANETS } from '../data/planets.js';
import { MOONS } from '../data/moons.js';
import { focusSelectedOrReset } from './camera.js';
import { btnToggleMoons } from './dom.js';

const $ = (id) => document.getElementById(id);

const ITEM = 'w-full text-left px-2 py-1.5 flex items-center gap-2 border';
const ITEM_ON = `${ITEM} bg-[#0B3D91]/60 border-[#1C67E3]`;
const ITEM_OFF = `${ITEM} border-transparent hover:bg-white/5`;

function itemHtml(body, isMoon) {
  const sel = S.selectedBodyId === body.id;
  return `
    <button type="button" data-body="${body.id}" class="${sel ? ITEM_ON : ITEM_OFF}">
      ${isMoon ? '<span class="mono text-[10px] text-[#8A99AD] pl-3">↳</span>' : ''}
      <span class="w-2 h-2 shrink-0 inline-block" style="background:${body.color}"></span>
      <span class="${isMoon ? 'text-[11px] text-[#CBD5E1]' : 'text-xs text-[#F8FAFC] font-medium'}">${body.name}</span>
    </button>`;
}

function renderList() {
  let html = '';
  for (const p of PLANETS) {
    html += itemHtml(p, false);
    for (const m of MOONS.filter((mo) => mo.hostId === p.id)) html += itemHtml(m, true);
  }
  $('bodies-list').innerHTML = html;
}

export function isBodiesMenuOpen() {
  return !$('bodies-menu').classList.contains('hidden');
}

export function openBodiesMenu() {
  renderList();
  $('bodies-menu').classList.remove('hidden');
  $('btn-bodies').textContent = 'Cuerpos ▴';
}

export function closeBodiesMenu() {
  $('bodies-menu').classList.add('hidden');
  $('btn-bodies').textContent = 'Cuerpos ▾';
}

/** ¿El elemento pertenece a la lista o a su botón? (para cerrar al pulsar fuera) */
export function isInsideBodiesMenu(el) {
  return Boolean(el && (el.closest('#bodies-menu') || el.closest('#btn-bodies')));
}

export function scrollBodiesMenu(steps) {
  $('bodies-menu').scrollBy({ top: -steps * 60 });
}

function goTo(id) {
  closeBodiesMenu();
  if (MOONS.some((m) => m.id === id) && !S.showMoons) btnToggleMoons.click(); // hay que verla
  S.selectedBodyId = id;
  focusSelectedOrReset();
}

export function initBodiesMenu() {
  $('btn-bodies').addEventListener('click', () => (isBodiesMenuOpen() ? closeBodiesMenu() : openBodiesMenu()));
  $('bodies-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-body]');
    if (b) goTo(b.dataset.body);
  });
  // Ratón directo: pulsar fuera la cierra.
  document.addEventListener('pointerdown', (e) => {
    if (isBodiesMenuOpen() && !isInsideBodiesMenu(e.target)) closeBodiesMenu();
  }, true);
}
