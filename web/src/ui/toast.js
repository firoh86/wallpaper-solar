// Notificación breve tipo consola.

import { S } from '../state.js';
import { toastBox, toastMessage } from './dom.js';

export function showToast(text) {
  toastMessage.textContent = text;
  toastBox.classList.remove('opacity-0');
  toastBox.classList.add('opacity-100');
  if (S.toastTimeout) clearTimeout(S.toastTimeout);
  S.toastTimeout = setTimeout(() => {
    toastBox.classList.remove('opacity-100');
    toastBox.classList.add('opacity-0');
  }, 2400);
}
