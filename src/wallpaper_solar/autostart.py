"""
Inicio con Windows.

Se usa la entrada por usuario  HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run
(no necesita administrador y aparece en «Administrador de tareas → Aplicaciones de inicio»).

Windows guarda aparte si el usuario la DESACTIVÓ desde el Administrador de tareas:
    HKCU\\...\\Explorer\\StartupApproved\\Run   (valor binario; primer byte par = activada)
Por eso «activado» = existe la entrada Run Y StartupApproved no la marca como desactivada.
Al activar desde la bandeja se borra esa marca; al desactivar se borran las dos.
"""

import sys
from pathlib import Path

from wallpaper_solar.log import logger

VALUE_NAME = "WallpaperSolar"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
APPROVED_KEY = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"

try:
    import winreg  # sólo existe en Windows
except ImportError:  # pragma: no cover - permite importar/testear en otros sistemas
    winreg = None


def launch_command() -> str:
    """Comando que Windows ejecutará al iniciar sesión."""
    if getattr(sys, "frozen", False):
        # Instalado: el propio WallpaperSolar.exe
        return f'"{sys.executable}"'
    # Desarrollo: pythonw.exe (sin consola) + run.py del proyecto
    exe = Path(sys.executable)
    pythonw = exe.with_name("pythonw.exe") if exe.name.lower() == "python.exe" else exe
    run_py = Path(__file__).resolve().parents[2] / "run.py"
    return f'"{pythonw}" "{run_py}"'


def _read(key_path: str, name: str):
    if winreg is None:
        return None
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path) as k:
            return winreg.QueryValueEx(k, name)[0]
    except OSError:
        return None


def _delete(key_path: str, name: str) -> None:
    if winreg is None:
        return
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as k:
            winreg.DeleteValue(k, name)
    except OSError:
        pass  # no existía


def is_disabled_in_task_manager(approved_value) -> bool:
    """StartupApproved: bytes cuyo primer byte es impar (0x03, 0x07…) = desactivada por el usuario."""
    return isinstance(approved_value, (bytes, bytearray)) and len(approved_value) > 0 and approved_value[0] % 2 == 1


def is_enabled() -> bool:
    if _read(RUN_KEY, VALUE_NAME) is None:
        return False
    return not is_disabled_in_task_manager(_read(APPROVED_KEY, VALUE_NAME))


def enable() -> bool:
    if winreg is None:
        return False
    try:
        with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
            winreg.SetValueEx(k, VALUE_NAME, 0, winreg.REG_SZ, launch_command())
        _delete(APPROVED_KEY, VALUE_NAME)  # quita una posible desactivación del Administrador de tareas
        logger.info("Inicio con Windows activado: %s", launch_command())
        return True
    except OSError:
        logger.exception("No se pudo activar el inicio con Windows")
        return False


def disable() -> None:
    _delete(RUN_KEY, VALUE_NAME)
    _delete(APPROVED_KEY, VALUE_NAME)
    logger.info("Inicio con Windows desactivado")


def refresh_command_if_enabled() -> None:
    """Versión instalada: si el programa se ha movido o actualizado, la entrada apunta a la ruta actual.
    (En desarrollo no se toca, para no pisar la entrada de una versión instalada.)"""
    if not getattr(sys, "frozen", False):
        return
    current = _read(RUN_KEY, VALUE_NAME)
    if current is not None and current != launch_command() and is_enabled():
        enable()
