"""
Ajustes del usuario y carpeta de datos.

Todo lo que la aplicación escribe en disco vive en UNA carpeta, para que la
desinstalación pueda borrarla entera:

    %APPDATA%\\WallpaperSolar\\
        settings.json   ajustes (modo interactivo, HUD…)
        logs\\           registro de errores
        webview\\        caché de WebView2

(WALLPAPER_DATA_DIR permite cambiarla, p. ej. en los tests.)
"""

import json
import os
import tempfile
import threading
from dataclasses import asdict, dataclass, fields
from pathlib import Path

APP_DIR_NAME = "WallpaperSolar"


def data_dir() -> Path:
    override = os.environ.get("WALLPAPER_DATA_DIR")
    if override:
        base = Path(override)
    else:
        appdata = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        base = Path(appdata) / APP_DIR_NAME
    base.mkdir(parents=True, exist_ok=True)
    return base


def logs_dir() -> Path:
    d = data_dir() / "logs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def webview_storage_dir() -> Path:
    d = data_dir() / "webview"
    d.mkdir(parents=True, exist_ok=True)
    return d


def settings_file() -> Path:
    return data_dir() / "settings.json"


@dataclass
class Settings:
    interactive_mode: bool = True
    hud_visible: bool = True
    # El inicio con Windows NO se guarda aquí: la fuente de verdad es el registro
    # (Windows también deja activarlo/desactivarlo desde el Administrador de tareas).

    @classmethod
    def load(cls) -> "Settings":
        try:
            raw = json.loads(settings_file().read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return cls()
        known = {f.name for f in fields(cls)}
        # Se ignoran claves desconocidas y tipos incorrectos (archivo editado a mano, versión antigua…)
        values = {k: v for k, v in raw.items() if k in known and isinstance(v, type(getattr(cls(), k)))}
        return cls(**values)


_save_lock = threading.Lock()


def save_settings(settings: Settings) -> None:
    """Escritura atómica: nunca deja un settings.json a medias si se apaga el equipo."""
    target = settings_file()
    data = json.dumps(asdict(settings), indent=2, ensure_ascii=False)
    with _save_lock:
        fd, tmp = tempfile.mkstemp(dir=target.parent, prefix=".settings-", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(data)
            os.replace(tmp, target)
        except OSError:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise
