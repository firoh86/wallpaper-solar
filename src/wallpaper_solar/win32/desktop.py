"""
Localización del escritorio de Windows (Progman / WorkerW / SHELLDLL_DefView)
y prueba de "¿el cursor está sobre el escritorio o sobre una aplicación?".
"""

import ctypes
import os
from ctypes import wintypes

from wallpaper_solar import config
from wallpaper_solar.log import log_dbg
from wallpaper_solar.win32.api import POINT, user32


def find_shell_defview():
    """Busca SHELLDLL_DefView en Progman o cualquier WorkerW."""
    progman = user32.FindWindowW("Progman", None)
    if progman:
        result = ctypes.c_ulong(0)
        user32.SendMessageTimeoutW(
            progman, 0x052C, 0x00000D, 0x000001, 0x0000, 1000, ctypes.byref(result)
        )
        sv = user32.FindWindowExW(progman, 0, "SHELLDLL_DefView", None)
        if sv:
            return progman, sv

    found_owner = wintypes.HWND(0)
    found_sv = wintypes.HWND(0)

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def enum_proc(hwnd, lparam):
        nonlocal found_owner, found_sv
        sv = user32.FindWindowExW(hwnd, 0, "SHELLDLL_DefView", None)
        if sv:
            found_owner = hwnd
            found_sv = sv
            return False
        return True

    user32.EnumWindows(enum_proc, 0)
    return found_owner, found_sv


def get_desktop_parent_hwnd():
    """Localiza el WorkerW (o Progman) adecuado detrás de SHELLDLL_DefView."""
    progman = user32.FindWindowW("Progman", None)
    if progman:
        result = ctypes.c_ulong(0)
        user32.SendMessageTimeoutW(
            progman, 0x052C, 0x00000D, 0x000001, 0x0000, 1000, ctypes.byref(result)
        )

    workerw_after_shell = wintypes.HWND(0)
    any_workerw = wintypes.HWND(0)

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def enum_windows_proc(hwnd, lparam):
        nonlocal workerw_after_shell, any_workerw
        cls_buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls_buf, 256)
        if cls_buf.value == "WorkerW" and not any_workerw:
            any_workerw = hwnd

        shell_view = user32.FindWindowExW(hwnd, 0, "SHELLDLL_DefView", None)
        if shell_view:
            nxt = user32.FindWindowExW(0, hwnd, "WorkerW", None)
            if nxt:
                workerw_after_shell = nxt
        return True

    user32.EnumWindows(enum_windows_proc, 0)
    return workerw_after_shell or any_workerw or progman


def is_point_on_desktop(screen_x: int, screen_y: int, ignored_hwnds=()) -> bool:
    """Devuelve True si el cursor está sobre el escritorio (y no sobre una app abierta)."""
    pt = POINT(int(screen_x), int(screen_y))
    hwnd_under = user32.WindowFromPoint(pt)
    if not hwnd_under:
        return True

    ignored_set = {int(h) for h in ignored_hwnds if h}
    if int(hwnd_under) in ignored_set:
        return True

    root = user32.GetAncestor(hwnd_under, 2) or hwnd_under  # GA_ROOT = 2
    if int(root) in ignored_set:
        return True

    cls_buf = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(root, cls_buf, 256)
    root_cls = cls_buf.value

    user32.GetClassNameW(hwnd_under, cls_buf, 256)
    under_cls = cls_buf.value

    if config.STRICT_DESKTOP_HIT_TEST:
        return _strict_desktop_test(root, root_cls, under_cls)

    desktop_classes = {
        "Progman",
        "WorkerW",
        "SysListView32",
        "SHELLDLL_DefView",
        "DesktopWindowXamlSource",
        "Windows.UI.Core.CoreWindow",
        "Chrome_WidgetWin_0",
        "Chrome_WidgetWin_1",
        "Intermediate D3D Window",
    }
    if root_cls in desktop_classes or under_cls in desktop_classes:
        return True

    title_len = user32.GetWindowTextLengthW(root)
    if title_len == 0:
        return True

    log_dbg(f"[BLOCKED_BY_WIN] root_cls={root_cls} under_cls={under_cls}")
    return False


_MY_PID = os.getpid()

# Ventanas raíz que forman el escritorio (iconos, SHELLDLL_DefView y nuestro
# propio WebView incrustado cuelgan de una de estas dos).
_DESKTOP_ROOT_CLASSES = {"Progman", "WorkerW"}

# Clases que usan las capas internas de WebView2. Una ventana de Chrome, Edge,
# VS Code o Discord usa la misma clase pero SIEMPRE tiene título, así que sólo
# se aceptan cuando no tienen título (capas auxiliares, no aplicaciones).
_WEBVIEW_HELPER_CLASSES = {"Chrome_WidgetWin_0", "Chrome_WidgetWin_1", "Intermediate D3D Window"}


def _strict_desktop_test(root, root_cls: str, under_cls: str) -> bool:
    if root_cls in _DESKTOP_ROOT_CLASSES:
        return True

    pid = wintypes.DWORD(0)
    user32.GetWindowThreadProcessId(root, ctypes.byref(pid))
    if int(pid.value) == _MY_PID:
        # Nuestra propia ventana (p. ej. con USE_WORKERW_PARENT = False).
        # Ojo: el menú de la bandeja también es nuestro, pero es de clase #32768.
        return root_cls != "#32768"

    if root_cls in _WEBVIEW_HELPER_CLASSES and user32.GetWindowTextLengthW(root) == 0:
        return True

    log_dbg(f"[BLOCKED_STRICT] root_cls={root_cls} under_cls={under_cls}")
    return False


def is_desktop_foreground() -> bool:
    """Comprueba si el foco activo está en el escritorio (para atajos de teclado)."""
    fg = user32.GetForegroundWindow()
    if not fg:
        return True
    cls_buf = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(fg, cls_buf, 256)
    return cls_buf.value in ("Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd")

