"""
SolarWallpaperApp: une las piezas y arranca los hilos.

  - DesktopWindow  (window.py)  -> incrustar el WebView detrás de los iconos
  - JsBridge       (bridge.py)  -> enviar órdenes al HTML
  - InputHooks     (hooks.py)   -> reenviar ratón/teclado del escritorio
  - run_tray       (tray.py)    -> menú de la bandeja
"""

import os
import subprocess
import sys
import threading
import time
from pathlib import Path

import webview

from wallpaper_solar import autostart, config, paths
from wallpaper_solar.bridge import JsBridge
from wallpaper_solar.hooks import InputHooks
from wallpaper_solar.log import close_log_files, logger
from wallpaper_solar.settings import Settings, logs_dir, save_settings, webview_storage_dir
from wallpaper_solar.tray import run_tray
from wallpaper_solar.win32.api import user32
from wallpaper_solar.win32.fullscreen import has_fullscreen_window_on_screen
from wallpaper_solar.win32.monitors import get_display_topology
from wallpaper_solar.win32.single_instance import release_single_instance_lock
from wallpaper_solar.window import DesktopWindow, topology_signature


class SolarWallpaperApp:
    def __init__(self):
        self.window = None

        # Ajustes guardados en %APPDATA%\WallpaperSolar\settings.json
        self.settings = Settings.load()
        self.interactive_mode = self.settings.interactive_mode
        self.hud_visible = self.settings.hud_visible
        self.paused_by_fullscreen = False
        self.running = True

        self.bridge = JsBridge(get_window=lambda: self.window, is_running=lambda: self.running)
        self.desktop = DesktopWindow(self.bridge)
        self.hooks = InputHooks(self)

    # ------------------------------------------------------------ arranque
    def attach_to_desktop(self):
        """Lo llama pywebview cuando la ventana ya existe."""
        def delayed_embed():
            for _ in range(16):
                time.sleep(0.25)
                if not self.running:
                    return
                self.desktop.apply_desktop_embedding()

        threading.Thread(target=delayed_embed, daemon=True, name="embed").start()
        if not self.hud_visible:
            self._apply_hud()  # HUD oculto la última vez: se restaura igual
        threading.Thread(target=self.bridge.run_dispatcher, daemon=True, name="js-bridge").start()
        threading.Thread(target=self.hooks.run_message_loop, daemon=True, name="hooks").start()
        threading.Thread(target=self.fullscreen_monitor_loop, daemon=True, name="monitor").start()

    def run(self):
        html_file = paths.html_file()
        if not html_file.exists():
            raise FileNotFoundError(
                f"No se encontró el archivo HTML en: {html_file}\n"
                "Compila la simulación con:  npm --prefix web run build"
            )

        topo = get_display_topology()
        self.window = webview.create_window(
            title=config.WINDOW_TITLE,
            url=paths.html_url(),
            x=topo["virtual_left"],
            y=topo["virtual_top"],
            width=topo["virtual_width"],
            height=topo["virtual_height"],
            frameless=True,
            easy_drag=False,
            background_color=config.BG_COLOR,
        )

        autostart.refresh_command_if_enabled()
        threading.Thread(target=run_tray, args=(self,), daemon=True, name="tray").start()
        # storage_path: la caché de WebView2 va a %APPDATA%\WallpaperSolar\webview (si no, pywebview
        # la deja en una carpeta temporal que nadie borra) y el desinstalador puede eliminarla.
        webview.start(
            self.attach_to_desktop,
            gui="edgechromium",
            storage_path=str(webview_storage_dir()),
        )

    # ------------------------------------------------- vigilancia periódica
    def set_external_pause(self, paused: bool):
        if self.paused_by_fullscreen == paused:
            return
        self.paused_by_fullscreen = paused
        if not paused:
            self.desktop.ensure_visible_and_behind_icons()
        self.bridge.enqueue(
            f"if (window.__setExternalPause) window.__setExternalPause({'true' if paused else 'false'});"
        )

    def fullscreen_monitor_loop(self):
        """Pausa en pantalla completa, evita minimización con Win+D y reajusta si cambian los monitores."""
        while self.running:
            time.sleep(config.FULLSCREEN_CHECK_INTERVAL)
            if not self.running:
                break

            topo = get_display_topology()
            sig = topology_signature(topo)
            hwnd = self.desktop.webview_hwnd
            if (hwnd and user32.IsIconic(hwnd)) or sig != self.desktop.last_topo_sig:
                self.desktop.apply_desktop_embedding()

            fs = has_fullscreen_window_on_screen(list(self.desktop.ignored_hwnds()))
            self.set_external_pause(fs)

    # -------------------------------------------------- acciones de bandeja
    def toggle_interactive_switch(self, icon=None, item=None):
        """Switch de bandeja: alterna entre modo interactivo y fondo animado."""
        self.interactive_mode = not self.interactive_mode
        self._save()
        if icon:
            icon.update_menu()

    def toggle_hud(self, icon=None, item=None):
        if not self.window:
            return
        self.hud_visible = not self.hud_visible
        self._save()
        self._apply_hud()

    def _apply_hud(self):
        display_val = "" if self.hud_visible else "none"
        js = f"""
        document.querySelector('header').style.display = '{display_val}';
        document.querySelector('footer').style.display = '{display_val}';
        const logo = document.getElementById('brand-logo');
        if (logo) logo.style.display = '{display_val}';
        """
        self.bridge.enqueue(js)

    def _save(self):
        self.settings.interactive_mode = self.interactive_mode
        self.settings.hud_visible = self.hud_visible
        try:
            save_settings(self.settings)
        except OSError:
            logger.exception("No se pudieron guardar los ajustes")

    # ---------------------------------------------------- inicio con Windows
    def is_autostart_enabled(self, item=None) -> bool:
        return autostart.is_enabled()

    def toggle_autostart(self, icon=None, item=None):
        if autostart.is_enabled():
            autostart.disable()
        else:
            autostart.enable()
        if icon:
            icon.update_menu()

    # --------------------------------------------------------- utilidades
    def open_logs_folder(self, icon=None, item=None):
        try:
            os.startfile(str(logs_dir()))  # noqa: S606 - sólo abre el Explorador en nuestra carpeta
        except OSError:
            logger.exception("No se pudo abrir la carpeta de registros")

    @staticmethod
    def uninstaller_path():
        """unins000.exe junto al .exe instalado (sólo existe en la versión instalada)."""
        if not getattr(sys, "frozen", False):
            return None
        p = Path(sys.executable).with_name("unins000.exe")
        return p if p.exists() else None

    def uninstall(self, icon=None, item=None):
        """
        Abre el desinstalador de Inno Setup y cierra la aplicación para que pueda borrarla.

        1. Se suelta el mutex de instancia única: así el desinstalador (AppMutex) no avisa de que
           el programa sigue abierto mientras éste termina de cerrarse. Y se cierra el archivo de
           registro, que si siguiera abierto impediría borrar %APPDATA%\\WallpaperSolar\\logs.
        2. Se lanza unins000.exe directamente (sin cmd: las comillas de la ruta se rompían al
           pasar por cmd /c y Windows intentaba abrir "\\").
        3. Se cierra la aplicación. El desinstalador primero pregunta "¿Está seguro…?", y para
           cuando el usuario responde este proceso ya ha terminado y sus archivos se pueden borrar.
        """
        unins = self.uninstaller_path()
        if not unins:
            return
        logger.info("Desinstalación solicitada desde la bandeja: %s", unins)
        release_single_instance_lock()
        close_log_files()  # si quedara abierto, el desinstalador no podría borrar logs\
        try:
            subprocess.Popen([str(unins)], cwd=str(unins.parent), close_fds=True)  # noqa: S603 - ruta propia
        except OSError:
            logger.exception("No se pudo abrir el desinstalador")
            return
        self.quit_app(icon, item)

    def reset_center(self, icon=None, item=None):
        self.bridge.enqueue("if (typeof focusSelectedOrReset === 'function') focusSelectedOrReset();")

    def quit_app(self, icon=None, item=None):
        logger.info("Cerrando")
        self.running = False
        self.hooks.stop()
        if icon:
            icon.stop()
        if self.window:
            self.window.destroy()
        # SPI_SETDESKWALLPAPER con NULL: Windows vuelve a pintar el fondo estático.
        user32.SystemParametersInfoW(0x0014, 0, None, 0x02)
        os._exit(0)
