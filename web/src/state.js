// Estado compartido de la simulación (antes eran variables globales sueltas).
// Todos los módulos leen y escriben aquí: S.zoom, S.selectedBodyId, etc.
export const S = {
  simEpochMs: Date.now(),
  lastPerfMs: performance.now(),
  timeRate: 1,
  isPaused: false,
  externalPaused: false,
  rafId: null,
  physicsEngine: 'kepler',
  scaleMode: 'visual',
  is3DMode: false,
  showMoons: true,
  showGuides: true,
  selectedBodyId: null,
  followSelected: false,
  zoom: 1.0,
  panOffset: { x: 0, y: 0 },
  camYaw: 0.55,
  camPitch: 0.92,
  primaryViewport: null,
  currentAllStates: [],
  bodyHitTargets: [],
  orbitCache: new Map(),
  verletBodies: [],
  verletEpochMs: 0,
  toastTimeout: null,

  // Vista activa: 'solar' | 'to-moon' (viajando) | 'moon' | 'to-solar' (volviendo)
  view: 'solar',
  // Animación de cámara en curso hacia la Luna (ver moon/transition.js)
  moonTransition: null,
  // Cámara guardada al entrar en la vista lunar, para restaurarla al salir
  cameraSnapshot: null,
};
