// Referencias a los elementos del HTML (se buscan una sola vez).

export const canvas = document.getElementById('solarCanvas');

export const ctx = canvas.getContext('2d');

export const container = document.getElementById('canvas-container');

export const clockUtcEl = document.getElementById('clock-utc');

export const clockLocalEl = document.getElementById('clock-local');

export const liveDotEl = document.getElementById('live-dot');

export const liveLabelEl = document.getElementById('live-label');

export const engineBadgeEl = document.getElementById('engine-badge');

export const jdBadgeEl = document.getElementById('jd-badge');

export const inspectorCard = document.getElementById('inspector-card');

export const btnFollowBody = document.getElementById('btn-follow-body');

export const toastBox = document.getElementById('toast-box');

export const toastMessage = document.getElementById('toast-message');

export const btnPause = document.getElementById('btn-pause');

export const rateButtons = document.querySelectorAll('.rate-btn');

export const btnToggle3D = document.getElementById('btn-toggle-3d');

export const btnScaleMode = document.getElementById('btn-scale-mode');

export const btnToggleMoons = document.getElementById('btn-toggle-moons');

export const btnToggleGuides = document.getElementById('btn-toggle-guides');

export const btnToggleEngine = document.getElementById('btn-toggle-engine');
