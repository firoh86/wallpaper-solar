// Tamaño del lienzo y colocación del HUD dentro del monitor principal (multimonitor).

import { S } from '../state.js';
import { canvas, container, ctx, inspectorCard, toastBox } from './dom.js';

export function getAnchorBounds() {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  if (S.primaryViewport && S.primaryViewport.width > 100 && S.primaryViewport.height > 100) {
    return {
      left: Math.max(0, S.primaryViewport.left),
      top: Math.max(0, S.primaryViewport.top),
      width: Math.min(w, S.primaryViewport.width),
      height: Math.min(h, S.primaryViewport.height)
    };
  }
  return { left: 0, top: 0, width: w, height: h };
}

export function applyPrimaryLayout() {
  const totalW = container.clientWidth || window.innerWidth;
  const totalH = container.clientHeight || window.innerHeight;
  const b = getAnchorBounds();

  const rightInset = Math.max(12, totalW - (b.left + b.width) + 16);
  const bottomInset = Math.max(12, totalH - (b.top + b.height) + 16);
  const leftInset = Math.max(12, b.left + 16);
  const topInset = Math.max(12, b.top + 16);

  const header = document.getElementById('hud-header');
  if (header) {
    header.style.left = `${leftInset}px`;
    header.style.right = `${rightInset}px`;
    header.style.top = `${topInset}px`;
  }

  const footer = document.getElementById('hud-footer');
  if (footer) {
    footer.style.left = `${leftInset}px`;
    footer.style.right = `${rightInset}px`;
    footer.style.bottom = `${bottomInset}px`;
  }

  if (inspectorCard) {
    inspectorCard.style.right = `${rightInset}px`;
    inspectorCard.style.top = `${topInset + 54}px`;
    inspectorCard.style.maxHeight = `${Math.max(240, b.height - 130)}px`;
  }

  if (toastBox) {
    toastBox.style.left = `${b.left + b.width * 0.5}px`;
    toastBox.style.bottom = `${bottomInset + 52}px`;
  }
}

export function resizeCanvas() {
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  applyPrimaryLayout();
}
