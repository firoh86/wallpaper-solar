// Reloj, estado EN VIVO / PAUSADO / SIMULACIÓN y panel de telemetría del cuerpo seleccionado.

import { S } from '../state.js';
import { AU_KM } from '../core/constants.js';
import { epochMsToJD } from '../physics/kepler.js';
import { btnFollowBody, clockLocalEl, clockUtcEl, inspectorCard, jdBadgeEl, liveDotEl, liveLabelEl } from './dom.js';

export function updateTelemetryClock(epochMs) {
  const d = new Date(epochMs);
  const pad = (n) => String(n).padStart(2, '0');

  clockUtcEl.textContent = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  clockLocalEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  jdBadgeEl.textContent = `JD ${epochMsToJD(epochMs).toFixed(5)}`;

  const isLiveNow = !S.isPaused && S.timeRate === 1 && Math.abs(Date.now() - epochMs) < 2500;
  if (isLiveNow) {
    liveDotEl.className = 'w-2 h-2 bg-[#FC3D21] inline-block animate-pulse';
    liveLabelEl.textContent = 'EN VIVO';
  } else if (S.isPaused) {
    liveDotEl.className = 'w-2 h-2 bg-[#8A99AD] inline-block';
    liveLabelEl.textContent = 'PAUSADO';
  } else {
    liveDotEl.className = 'w-2 h-2 bg-[#1C67E3] inline-block';
    liveLabelEl.textContent = 'SIMULACIÓN';
  }
}

export function updateInspectorPanel() {
  if (!S.selectedBodyId) {
    inspectorCard.classList.add('hidden');
    return;
  }

  const body = S.currentAllStates.find((b) => b.id === S.selectedBodyId);
  const earth = S.currentAllStates.find((b) => b.id === 'earth');
  if (!body || !earth) return;

  inspectorCard.classList.remove('hidden');

  const swatch = document.getElementById('insp-swatch');
  swatch.style.backgroundColor = body.color;

  document.getElementById('insp-name').textContent = body.name.toUpperCase();
  document.getElementById('insp-category').textContent = body.category;

  btnFollowBody.className = S.followSelected
    ? 'nasa-btn-active px-2 py-1 mono text-[10px] uppercase tracking-wider'
    : 'nasa-btn px-2 py-1 mono text-[10px] uppercase tracking-wider text-[#8A99AD] border border-white/15';
  btnFollowBody.textContent = S.followSelected ? 'SIGUIENDO' : 'SEGUIR [F]';

  document.getElementById('btn-explore-moon-insp').classList.toggle('hidden', body.id !== 'moon');

  const hostBlock = document.getElementById('insp-host-block');
  if (body.isMoon) {
    hostBlock.classList.remove('hidden');
    document.getElementById('insp-host-name').textContent = body.hostName || body.hostId;
    document.getElementById('insp-dist-host').textContent = `${Math.round(body.distHostKm).toLocaleString('es-ES')} km`;
    document.getElementById('insp-vel-host').textContent = `${body.relSpeedKmS.toFixed(3)} km/s`;
  } else {
    hostBlock.classList.add('hidden');
  }

  const distSunKm = body.distSunAu * AU_KM;
  document.getElementById('insp-dist-sun-au').textContent = `${body.distSunAu.toFixed(5)} AU`;
  document.getElementById('insp-dist-sun-km').textContent = `${Math.round(distSunKm).toLocaleString('es-ES')} km`;

  const distEarthAu = body.id === 'earth'
    ? 0
    : Math.hypot(body.pos.x - earth.pos.x, body.pos.y - earth.pos.y, body.pos.z - earth.pos.z);
  const distEarthKm = distEarthAu * AU_KM;
  document.getElementById('insp-dist-earth-au').textContent = `${distEarthAu.toFixed(5)} AU`;
  document.getElementById('insp-dist-earth-km').textContent = `${Math.round(distEarthKm).toLocaleString('es-ES')} km`;

  document.getElementById('insp-velocity').textContent = `${body.speedKmS.toFixed(2)} km/s`;
  document.getElementById('insp-period').textContent = body.periodDays > 0
    ? (body.periodDays >= 10 ? `${body.periodDays.toFixed(2)} d` : `${(body.periodDays * 24).toFixed(2)} h`)
    : 'Baricentro';

  document.getElementById('insp-coords').innerHTML = `
    <span>X:${body.pos.x.toFixed(3)}</span>
    <span>Y:${body.pos.y.toFixed(3)}</span>
    <span>Z:${body.pos.z.toFixed(3)}</span>
  `;
}
