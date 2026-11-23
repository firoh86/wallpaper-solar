"""
Rutas de recursos.

En desarrollo los recursos están en <proyecto>/web/.
Empaquetado con PyInstaller están dentro del ejecutable (sys._MEIPASS/web/).
Todo el código debe pedir las rutas aquí en vez de construirlas a mano.
"""

import sys
from pathlib import Path


def is_frozen() -> bool:
    """True si se ejecuta como .exe generado por PyInstaller."""
    return bool(getattr(sys, "frozen", False))


def project_root() -> Path:
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    # src/wallpaper_solar/paths.py -> parents[2] es la raíz del proyecto
    return Path(__file__).resolve().parents[2]


def web_dir() -> Path:
    return project_root() / "web"


def html_file() -> Path:
    # web/index.html es el código fuente para Vite; lo que se carga es la versión
    # compilada (un único HTML autocontenido). Se genera con:  npm --prefix web run build
    return web_dir() / "dist" / "index.html"


def html_url() -> str:
    # file:///E:/ruta/index.html, con espacios y acentos codificados (p. ej. C:/Users/José Pérez/…)
    return html_file().resolve().as_uri()
