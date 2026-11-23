// Lunas principales. Elementos osculantes de JPL Horizons (eclíptica J2000, centrados en el planeta)
// en MOON_ELEMENTS_EPOCH_JD, propagados con el movimiento medio sidéreo real.
// Contrastados con Horizons: error < 0,4° (Fobos < 3°) entre 2026 y 2030. La Luna usa physics/lunar.js.

export const MOONS = [
  {
    id: 'moon', name: 'Luna', hostId: 'earth', category: 'Satélite natural · Tierra',
    massKg: 7.342e22, radiusPx: 2.1, color: '#CBD5E1', model: 'meeus',
    periodDays: 27.321661, visualRingPx: 14
  },
  {
    id: 'phobos', name: 'Fobos', hostId: 'mars', category: 'Satélite natural · Marte',
    massKg: 1.0659e16, radiusPx: 1.6, color: '#A8A29E',
    aKm: 9378.664, e: 0.01528713, incDeg: 25.65653518, Omega0Deg: 83.36460978,
    omega0Deg: 298.05956526, M0Deg: 314.37912956, meanMotionDegDay: 1128.8445,
    periodDays: 0.31891023, visualRingPx: 10
  },
  {
    id: 'deimos', name: 'Deimos', hostId: 'mars', category: 'Satélite natural · Marte',
    massKg: 1.4762e15, radiusPx: 1.5, color: '#D6D3D1',
    aKm: 23458.660, e: 0.00035093, incDeg: 24.10829630, Omega0Deg: 81.61961692,
    omega0Deg: 46.86476553, M0Deg: 14.68915756, meanMotionDegDay: 285.16189,
    periodDays: 1.26244, visualRingPx: 15
  },
  {
    id: 'io', name: 'Ío', hostId: 'jupiter', category: 'Satélite galileano · Júpiter',
    massKg: 8.9319e22, radiusPx: 2.0, color: '#FDE047',
    aKm: 422028.510, e: 0.00431305, incDeg: 2.23086934, Omega0Deg: 338.37163677,
    omega0Deg: 13.53292474, M0Deg: 76.56601689, meanMotionDegDay: 203.4889538,
    periodDays: 1.769138, visualRingPx: 14
  },
  {
    id: 'europa', name: 'Europa', hostId: 'jupiter', category: 'Satélite galileano · Júpiter',
    massKg: 4.7998e22, radiusPx: 1.9, color: '#E2E8F0',
    aKm: 671214.185, e: 0.00943434, incDeg: 2.06552051, Omega0Deg: 326.23636110,
    omega0Deg: 197.65282591, M0Deg: 42.03562572, meanMotionDegDay: 101.3747235,
    periodDays: 3.551181, visualRingPx: 19
  },
  {
    id: 'ganymede', name: 'Ganímedes', hostId: 'jupiter', category: 'Satélite galileano · Júpiter',
    massKg: 1.4819e23, radiusPx: 2.3, color: '#CBD5E1',
    aKm: 1070588.822, e: 0.00263919, incDeg: 2.34413296, Omega0Deg: 339.04628420,
    omega0Deg: 3.65023059, M0Deg: 202.00557254, meanMotionDegDay: 50.3176081,
    periodDays: 7.154553, visualRingPx: 24
  },
  {
    id: 'callisto', name: 'Calisto', hostId: 'jupiter', category: 'Satélite galileano · Júpiter',
    massKg: 1.0759e23, radiusPx: 2.2, color: '#94A3B8',
    aKm: 1882839.074, e: 0.00715030, incDeg: 1.95240549, Omega0Deg: 336.75942032,
    omega0Deg: 32.89459407, M0Deg: 271.37417584, meanMotionDegDay: 21.5710715,
    periodDays: 16.689018, visualRingPx: 30
  },
  {
    id: 'titan', name: 'Titán', hostId: 'saturn', category: 'Satélite mayor · Saturno',
    massKg: 1.3452e23, radiusPx: 2.3, color: '#F59E0B',
    aKm: 1221916.740, e: 0.02868898, incDeg: 27.70494023, Omega0Deg: 169.08109281,
    omega0Deg: 178.49977022, M0Deg: 151.84255567, meanMotionDegDay: 22.5769768,
    periodDays: 15.945, visualRingPx: 22
  },
  {
    id: 'enceladus', name: 'Encélado', hostId: 'saturn', category: 'Satélite helado · Saturno',
    massKg: 1.08022e20, radiusPx: 1.6, color: '#F8FAFC',
    aKm: 238409.410, e: 0.00369146, incDeg: 28.04421156, Omega0Deg: 169.53588206,
    omega0Deg: 227.34017676, M0Deg: 118.64099220, meanMotionDegDay: 262.7318996,
    periodDays: 1.370218, visualRingPx: 15
  }
];
