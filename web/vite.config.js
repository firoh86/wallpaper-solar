import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Salida: dist/index.html autocontenido (JS, CSS, fuentes y logo incrustados).
// Tiene que ser un único archivo porque WebView2 bloquea los módulos JS
// cargados desde file://, que es como lo abre wallpaper_solar.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    // WebView2 es Chromium actual. Con un objetivo genérico el minificador de CSS
    // eliminaba 'backdrop-filter' (el desenfoque de los paneles) dejando sólo la
    // versión -webkit-, que Chromium no usa.
    target: 'chrome110',
    cssTarget: 'chrome110'
  },
  server: {
    open: true
  }
});
