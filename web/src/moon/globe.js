// Expansión lunar · Fase 3: globo 3D de la Luna (three.js).
//
// - El globo no rota solo: sólo se mueve cuando el usuario lo gira o hace zoom.
// - Luz: 'real' = el Sol ilumina la Luna como en el instante simulado (fase y terminador
//   reales, ver moon/sunlight.js); 'uniforme' = luz fija desde la cámara para ver todo.
// - Se dibuja únicamente cuando algo cambia (ahorra GPU como fondo de escritorio).
// - Textura: mapa de color LROC de NASA (CGI Moon Kit) en web/src/assets/moon/; si no está,
//   se usa una provisional generada aquí.
//
// Convención de coordenadas: latitud norte +, longitud este + (igual que el catálogo).

import {
  AmbientLight, CanvasTexture, Color, DirectionalLight, LinearFilter, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Scene, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3, WebGLRenderer
} from 'three';

const D2R = Math.PI / 180;

// Texturas opcionales (si no existen, el objeto queda vacío y se usa la provisional).
const TEXTURES = import.meta.glob('../assets/moon/*.jpg', { eager: true, query: '?url', import: 'default' });
const COLOR_URL = Object.entries(TEXTURES).find(([k]) => k.endsWith('lroc_color_2k.jpg'))?.[1] ?? null;
const BUMP_URL = Object.entries(TEXTURES).find(([k]) => k.endsWith('ldem_3_8bit.jpg'))?.[1] ?? null;
export const HAS_REAL_TEXTURE = Boolean(COLOR_URL);

const DEFAULT_VIEW = { lat: 0, lon: 0, dist: 5.0 }; // cara visible, centrada en 0°, 0° (el globo ocupa ~75 % del alto)
const DIST_MIN = 1.35;
const DIST_MAX = 9;

let renderer, scene, camera, moon, overlay, octx, container;
let ambient, keyLight, sunLight;
let lightMode = 'real';
let sunDir = { lat: 0, lon: 0 };
let view = { ...DEFAULT_VIEW };
let tween = null;
let pendingFrame = false;
let markerSource = () => ({ missions: [], selectedId: null, showMarkers: true, showLabels: false });
let lastMarkers = []; // posiciones en pantalla del último dibujo (para hacer clic)
let ready = false;

// ------------------------------------------------------------------ montaje
export function initGlobe(containerEl, getMarkers) {
  if (ready) return;
  container = containerEl;
  if (getMarkers) markerSource = getMarkers;

  renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'absolute inset-0 w-full h-full';
  container.appendChild(renderer.domElement);

  // Capa 2D encima: marcadores y nombres (más nítidos y fáciles de pulsar que en 3D).
  overlay = document.createElement('canvas');
  overlay.id = 'globe-overlay';
  overlay.className = 'absolute inset-0 w-full h-full cursor-grab';
  container.appendChild(overlay);
  octx = overlay.getContext('2d');

  scene = new Scene();
  camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, view.dist);
  scene.add(camera);

  // Luz uniforme: fija respecto a la cámara (arriba a la izquierda), toda la cara visible iluminada.
  ambient = new AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  keyLight = new DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(-1.2, 1.0, 2.2);
  camera.add(keyLight);

  const material = new MeshStandardMaterial({ color: new Color(0xffffff), roughness: 1, metalness: 0 });
  moon = new Mesh(new SphereGeometry(1, 160, 80), material);
  moon.rotation.order = 'XYZ';
  scene.add(moon);

  // Luz real: el Sol, colgado de la propia Luna para que gire con ella (la noche sigue siendo noche).
  sunLight = new DirectionalLight(0xfff6ea, 3.2);
  sunLight.target = moon;
  moon.add(sunLight);
  applyLighting();
  loadTextures(material);

  new ResizeObserver(resize).observe(container);
  bindPointer();
  resize();
  ready = true;
}

function loadTextures(material) {
  if (COLOR_URL) {
    new TextureLoader().load(COLOR_URL, (t) => {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      material.map = t;
      material.needsUpdate = true;
      requestRender();
    });
  } else {
    material.map = provisionalTexture();
  }
  if (BUMP_URL) {
    new TextureLoader().load(BUMP_URL, (t) => {
      t.minFilter = LinearFilter;
      material.bumpMap = t;
      material.bumpScale = 2.2;
      material.needsUpdate = true;
      requestRender();
    });
  }
}

/** Textura provisional: gris con manchas, sólo para que el globo se vea mientras falta la real. */
function provisionalTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a98';
  g.fillRect(0, 0, c.width, c.height);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * c.width, y = rnd() * c.height, r = 2 + rnd() * rnd() * 40;
    g.fillStyle = `rgba(${rnd() < 0.15 ? '70,70,72' : '120,120,118'}, ${0.15 + rnd() * 0.3})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function resize() {
  if (!container) return;
  const w = container.clientWidth || 1;
  const h = container.clientHeight || 1;
  renderer.setSize(w, h, false);
  const dpr = window.devicePixelRatio || 1;
  overlay.width = Math.round(w * dpr);
  overlay.height = Math.round(h * dpr);
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Cambiar el tamaño borra el lienzo: se redibuja ya para que no parpadee en negro.
  if (ready) renderFrame();
  else requestRender();
}

// ------------------------------------------------------------------- luz
function applyLighting() {
  if (!sunLight) return;
  const real = lightMode === 'real';
  sunLight.visible = real;
  keyLight.visible = !real;
  ambient.intensity = real ? 0.04 : 0.55; // en modo real la cara nocturna apenas se intuye (luz cenicienta)
  const cl = Math.cos(sunDir.lat * D2R);
  sunLight.position.set(
    10 * cl * Math.cos(sunDir.lon * D2R),
    10 * Math.sin(sunDir.lat * D2R),
    -10 * cl * Math.sin(sunDir.lon * D2R)
  );
}

/** 'real' | 'uniforme' */
export function setLightMode(mode) {
  if (mode === lightMode) return;
  lightMode = mode;
  applyLighting();
  requestRender();
}

/** Punto subsolar (selenográfico, grados). Sólo redibuja si se ha movido de forma apreciable. */
export function setSunDirection(lat, lon) {
  const moved = Math.abs(lat - sunDir.lat) + Math.abs(((lon - sunDir.lon + 540) % 360) - 180);
  if (moved < 0.02) return;
  sunDir = { lat, lon };
  applyLighting();
  if (lightMode === 'real') requestRender();
}

// ------------------------------------------------------------------- vista
function applyView() {
  // Gira la Luna para que (lat, lon) quede frente a la cámara con el norte arriba.
  // La esfera de three.js pone lon 0 en +X y el este hacia -Z.
  moon.rotation.set(view.lat * D2R, -(view.lon * D2R + Math.PI / 2), 0);
  camera.position.set(0, 0, view.dist);
  camera.lookAt(0, 0, 0);
}

const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
const clampLat = (lat) => Math.max(-89, Math.min(89, lat));

export function getGlobeView() {
  return { ...view };
}

/** Gira el globo como si arrastraras su superficie (dx, dy en píxeles CSS). */
export function rotateGlobeBy(dx, dy) {
  tween = null;
  const k = 0.22 * (view.dist - 1) / (DEFAULT_VIEW.dist - 1); // más lento al acercarse
  view.lon = wrapLon(view.lon - dx * k);
  view.lat = clampLat(view.lat + dy * k);
  requestRender();
}

/** steps > 0 acerca; steps < 0 aleja. */
export function zoomGlobeBy(steps) {
  tween = null;
  view.dist = Math.max(DIST_MIN, Math.min(DIST_MAX, 1 + (view.dist - 1) * Math.pow(0.86, steps)));
  requestRender();
}

/** Lleva la vista a (lat, lon[, dist]) con una animación suave (la usará la fase 4). */
export function animateGlobeTo(lat, lon, dist = view.dist, ms = 700) {
  const from = { ...view };
  let dLon = wrapLon(lon - from.lon); // camino corto
  tween = { t0: performance.now(), ms, from, to: { lat: clampLat(lat), lon: from.lon + dLon, dist } };
  requestRender();
}

export function resetGlobeView() {
  animateGlobeTo(DEFAULT_VIEW.lat, DEFAULT_VIEW.lon, DEFAULT_VIEW.dist, 600);
}

function stepTween() {
  if (!tween) return false;
  const p = Math.min(1, (performance.now() - tween.t0) / tween.ms);
  const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  view.lat = tween.from.lat + (tween.to.lat - tween.from.lat) * e;
  view.lon = wrapLon(tween.from.lon + (tween.to.lon - tween.from.lon) * e);
  view.dist = tween.from.dist + (tween.to.dist - tween.from.dist) * e;
  if (p >= 1) tween = null;
  return Boolean(tween);
}

// ----------------------------------------------------------------- dibujo
export function requestRender() {
  if (!ready && !renderer) return;
  if (pendingFrame) return;
  pendingFrame = true;
  requestAnimationFrame(renderFrame);
}

function renderFrame() {
  pendingFrame = false;
  if (!renderer || !container || container.offsetParent === null) return; // vista oculta
  const animating = stepTween();
  applyView();
  renderer.render(scene, camera);
  drawMarkers();
  if (animating) requestRender();
}

const _v = new Vector3();
const _n = new Vector3();

/** Proyecta (lat, lon) a pantalla; visible = en la cara que mira a la cámara. */
function project(lat, lon) {
  const cl = Math.cos(lat * D2R);
  _n.set(cl * Math.cos(lon * D2R), Math.sin(lat * D2R), -cl * Math.sin(lon * D2R));
  _v.copy(_n).multiplyScalar(1.003).applyMatrix4(moon.matrixWorld);
  _n.applyQuaternion(moon.quaternion);
  const toCam = camera.position.clone().sub(_v).normalize();
  const facing = _n.dot(toCam);
  _v.project(camera);
  const w = container.clientWidth, h = container.clientHeight;
  return { x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h, facing };
}

function drawMarkers() {
  const w = container.clientWidth, h = container.clientHeight;
  octx.clearRect(0, 0, w, h);
  lastMarkers = [];
  const { missions, selectedId, showMarkers, showLabels, cardRect } = markerSource();
  if (!showMarkers && !selectedId) return;

  moon.updateMatrixWorld();
  const placed = [];
  for (const m of missions) {
    if (m.lat == null) continue;
    const sel = m.id === selectedId;
    if (!showMarkers && !sel) continue;
    const p = project(m.lat, m.lon);
    if (p.facing < 0.04) continue; // detrás del globo o rozando el borde
    placed.push({ m, ...p, sel });
  }
  placed.sort((a, b) => a.sel - b.sel); // la seleccionada encima

  octx.lineJoin = 'round';
  octx.miterLimit = 2;

  // Fase 4: línea que une la ficha de la misión con su punto en el globo.
  const selP = placed.find((p) => p.sel);
  if (selP && cardRect) drawLeader(selP, cardRect);
  for (const p of placed) {
    const size = p.sel ? 8 : 5;
    const alpha = Math.min(1, 0.35 + p.facing * 1.4); // se apagan hacia el borde
    octx.globalAlpha = alpha;
    if (p.sel) {
      octx.strokeStyle = '#FC3D21';
      octx.lineWidth = 1.25;
      octx.strokeRect(p.x - size - 4, p.y - size - 4, (size + 4) * 2, (size + 4) * 2);
    }
    octx.fillStyle = p.sel ? '#FC3D21' : (p.m.outcome === 'fallo' ? 'rgba(252, 61, 33, 0.9)' : '#1C67E3');
    octx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    octx.strokeStyle = 'rgba(248, 250, 252, 0.95)';
    octx.lineWidth = 1;
    octx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
    lastMarkers.push({ id: p.m.id, x: p.x, y: p.y });
  }

  // Nombres sin superponerse; la seleccionada reserva sitio primero.
  const boxes = [];
  for (const p of [...placed].sort((a, b) => b.sel - a.sel)) {
    if (!(showLabels || p.sel)) continue;
    const size = p.sel ? 8 : 5;
    octx.font = p.sel ? '600 12px Inter, sans-serif' : '400 10.5px "JetBrains Mono", monospace';
    const tw = octx.measureText(p.m.name).width;
    const box = { x: p.x + size + 4, y: p.y - 8, w: tw + 4, h: 15 };
    if (!p.sel && boxes.some((b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y)) continue;
    boxes.push(box);
    octx.globalAlpha = Math.min(1, 0.35 + p.facing * 1.4);
    octx.lineWidth = 3;
    octx.strokeStyle = 'rgba(3, 5, 8, 0.85)';
    octx.strokeText(p.m.name, p.x + size + 5, p.y + 4);
    octx.fillStyle = '#F8FAFC';
    octx.fillText(p.m.name, p.x + size + 5, p.y + 4);
  }
  octx.globalAlpha = 1;
}

/** Línea en codo desde el marcador seleccionado hasta el borde más cercano de la ficha. */
function drawLeader(p, cardRect) {
  const cr = container.getBoundingClientRect();
  const card = { l: cardRect.left - cr.left, r: cardRect.right - cr.left, t: cardRect.top - cr.top, b: cardRect.bottom - cr.top };
  const leftSide = p.x < card.l;
  const ex = leftSide ? card.l : (p.x > card.r ? card.r : null);
  if (ex == null) return; // el punto queda debajo de la ficha: sin línea
  const ey = Math.max(card.t + 14, Math.min(card.b - 14, p.y));
  const midX = ex + (leftSide ? -18 : 18);
  const start = { x: p.x + (leftSide ? 12 : -12), y: p.y };

  const path = () => {
    octx.beginPath();
    octx.moveTo(start.x, start.y);
    octx.lineTo(midX, ey);
    octx.lineTo(ex, ey);
  };
  octx.save();
  octx.globalAlpha = Math.min(1, 0.35 + p.facing * 1.4);
  // Halo oscuro debajo para que la línea se lea sobre zonas claras y oscuras
  octx.strokeStyle = 'rgba(3, 5, 8, 0.7)';
  octx.lineWidth = 3.5;
  path();
  octx.stroke();
  octx.strokeStyle = '#FC3D21';
  octx.lineWidth = 1.25;
  path();
  octx.stroke();
  octx.fillStyle = '#FC3D21';
  octx.fillRect(ex - 3, ey - 3, 6, 6);
  octx.restore();
}

/** Misión cuyo marcador está bajo (x, y) del contenedor del globo, o null. */
export function pickMissionAt(clientX, clientY) {
  const r = container.getBoundingClientRect();
  const x = clientX - r.left, y = clientY - r.top;
  let best = null, bestD = 12;
  for (const m of lastMarkers) {
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < bestD) { bestD = d; best = m.id; }
  }
  return best;
}

// --------------------------------------------- ratón directo (no wallpaper)
let onPick = () => {};
export function onGlobePick(fn) {
  onPick = fn;
}

function bindPointer() {
  let drag = null;
  // Dedos o ratón apoyados ahora mismo: con dos, pellizco para acercar/alejar (versión web en el móvil).
  const pts = new Map();
  let pinch = null;
  const ptsDist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  overlay.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    overlay.setPointerCapture(e.pointerId);
    if (pts.size === 2) {
      drag = null;
      pinch = { d0: ptsDist(), dist0: view.dist };
      return;
    }
    if (pts.size > 2) return;
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    overlay.classList.replace('cursor-grab', 'cursor-grabbing');
  });
  overlay.addEventListener('pointermove', (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) {
      tween = null;
      view.dist = Math.max(DIST_MIN, Math.min(DIST_MAX, 1 + (pinch.dist0 - 1) * (pinch.d0 / ptsDist())));
      requestRender();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.hypot(dx, dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
    rotateGlobeBy(dx, dy);
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pinch) {
      if (pts.size < 2) pinch = null;
      drag = null;
      return;
    }
    if (drag && drag.moved < 5) {
      const id = pickMissionAt(e.clientX, e.clientY);
      if (id) onPick(id);
    }
    drag = null;
    overlay.classList.replace('cursor-grabbing', 'cursor-grab');
  };
  overlay.addEventListener('pointerup', end);
  overlay.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch = null; drag = null; });
  overlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomGlobeBy(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  overlay.addEventListener('dblclick', resetGlobeView);
}

export function isGlobeElement(el) {
  return Boolean(el && overlay && (el === overlay || el === renderer.domElement));
}
