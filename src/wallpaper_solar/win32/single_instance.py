"""Instancia única: evita dos wallpapers superpuestos."""

import ctypes

from wallpaper_solar import config
from wallpaper_solar.win32.api import ERROR_ALREADY_EXISTS, MB_ICONINFORMATION, kernel32, user32

# Se guarda aquí para que el handle viva mientras viva el proceso.
_instance_handle = None


def acquire_single_instance_lock():
    """Devuelve el handle del mutex, o None si ya hay otro wallpaper en marcha."""
    global _instance_handle
    handle = kernel32.CreateMutexW(None, False, config.SINGLE_INSTANCE_MUTEX)
    if handle and ctypes.get_last_error() == ERROR_ALREADY_EXISTS:
        return None
    _instance_handle = handle
    return handle


def release_single_instance_lock():
    """Suelta el mutex antes de terminar (p. ej. para que el desinstalador no crea que seguimos abiertos)."""
    global _instance_handle
    if _instance_handle:
        kernel32.CloseHandle(_instance_handle)
        _instance_handle = None


def show_already_running_message():
    # Con pythonw / el .exe no hay consola donde avisar.
    user32.MessageBoxW(
        None,
        "El wallpaper del Sistema Solar ya está en marcha.\n"
        "Ciérralo desde el icono de la bandeja antes de abrirlo otra vez.",
        config.TRAY_TITLE,
        MB_ICONINFORMATION,
    )
