import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Dos salidas:
//  · npm run build      → dist/index.html autocontenido (JS, CSS, fuentes e imágenes dentro).
//    Es la del wallpaper: tiene que ser un único archivo porque WebView2 bloquea los
//    módulos JS cargados desde file://, que es como lo abre wallpaper_solar.
//  · npm run build:web  → dist-web/ con archivos separados, para publicarla en una web
//    (las texturas lunares sólo se descargan al entrar en la vista lunar).
export default defineConfig(({ mode }) => {
  const web = mode === 'web';
  return {
    base: './',
    plugins: web ? [] : [viteSingleFile()],
    build: {
      outDir: web ? 'dist-web' : 'dist',
      emptyOutDir: true,
      assetsInlineLimit: web ? 4096 : 100_000_000,
      // WebView2 es Chromium actual. Con un objetivo genérico el minificador de CSS
      // eliminaba 'backdrop-filter' (el desenfoque de los paneles) dejando sólo la
      // versión -webkit-, que Chromium no usa. En la web, navegadores de 2020 en adelante.
      target: web ? 'es2020' : 'chrome110',
      cssTarget: web ? ['chrome100', 'safari15', 'firefox100'] : 'chrome110',
      chunkSizeWarningLimit: 800
    },
    server: {
      open: true
    }
  };
});
