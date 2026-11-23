"""Icono y menú de la bandeja del sistema."""

import pystray
from PIL import Image, ImageDraw

from wallpaper_solar import __version__, config


def build_tray_image():
    img = Image.new("RGBA", (64, 64), config.BG_COLOR)
    draw = ImageDraw.Draw(img)
    draw.rectangle([2, 2, 61, 61], outline=config.ACCENT_COLOR, width=3)
    draw.ellipse([22, 22, 42, 42], fill="#FDB813")
    draw.ellipse([10, 10, 54, 54], outline="#8A99AD", width=2)
    return img


def run_tray(app):
    """Crea el icono de la bandeja y bloquea el hilo actual hasta que se cierre."""
    menu = pystray.Menu(
        pystray.MenuItem(
            "Modo Interactivo",
            app.toggle_interactive_switch,
            checked=lambda item: app.interactive_mode,
        ),
        pystray.MenuItem("Mostrar / Ocultar HUD", app.toggle_hud),
        pystray.MenuItem("Centrar Sistema Solar", app.reset_center),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(
            "Iniciar con Windows",
            app.toggle_autostart,
            checked=app.is_autostart_enabled,
        ),
        pystray.MenuItem("Abrir carpeta de registros", app.open_logs_folder),
        pystray.MenuItem(
            "Desinstalar Wallpaper Solar…",
            app.uninstall,
            visible=lambda item: app.uninstaller_path() is not None,  # sólo en la versión instalada
        ),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Cerrar Wallpaper", app.quit_app),
    )
    title = f"{config.TRAY_TITLE} {__version__}"
    tray = pystray.Icon("SolarWallpaper", build_tray_image(), title, menu)
    tray.run()
