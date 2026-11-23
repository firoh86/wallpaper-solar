// Constantes físicas y de tiempo.

export const DEG2RAD = Math.PI / 180.0;

export const TWO_PI = Math.PI * 2.0;

export const AU_KM = 149597870.7;

export const AU_M = 1.495978707e11;

export const G_SI = 6.67430e-11;

export const DAY_SECONDS = 86400.0;

export const MU_SUN_AU_DAY = 0.01720209895 * 0.01720209895;

// Elementos osculantes de JPL Horizons (eclíptica J2000, centrados en el planeta) en la
// época 2026-11-23 00:00 TDB, propagados con el movimiento medio sidéreo real de cada luna.
// Contrastados con Horizons: error < 0,4° (Fobos < 3°) entre 2026 y 2030.
// La Luna usa la teoría lunar de Meeus (cap. 47), error ~0,02°.
export const MOON_ELEMENTS_EPOCH_JD = 2461367.5;

export const TT_MINUS_UTC_DAYS = 69.184 / 86400.0;
