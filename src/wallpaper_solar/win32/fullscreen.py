"""Detección de ventanas a pantalla completa (para pausar la simulación)."""

import ctypes
from ctypes import wintypes

from wallpaper_solar.win32.api import RECT, user32
from wallpaper_solar.win32.monitors import get_display_topology


def has_fullscreen_window_on_screen(ignored_hwnds):
    """Detecta si alguna ventana visible ocupa por completo alguna pantalla."""
    topo = get_display_topology()
    monitors = [(m["left"], m["top"], m["right"], m["bottom"]) for m in topo["monitors"]]
    ignored_set = {int(h) for h in ignored_hwnds if h}
    fullscreen_found = False
    ignored_classes = {
        "Progman",
        "WorkerW",
        "Shell_TrayWnd",
        "Shell_SecondaryTrayWnd",
        "Windows.UI.Core.CoreWindow",
        "ApplicationFrameWindow",
    }

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def enum_proc(hwnd, lparam):
        nonlocal fullscreen_found
        if fullscreen_found or int(hwnd) in ignored_set:
            return True
        if not user32.IsWindowVisible(hwnd) or user32.IsIconic(hwnd):
            return True

        cls_buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls_buf, 256)
        if cls_buf.value in ignored_classes:
            return True

        rect = RECT()
        if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            return True

        w = rect.right - rect.left
        h = rect.bottom - rect.top
        if w <= 0 or h <= 0:
            return True

        tol = 2
        for m_left, m_top, m_right, m_bottom in monitors:
            mw = m_right - m_left
            mh = m_bottom - m_top
            if (
                abs(rect.left - m_left) <= tol
                and abs(rect.top - m_top) <= tol
                and abs(rect.right - m_right) <= tol
                and abs(rect.bottom - m_bottom) <= tol
                and w >= mw - tol
                and h >= mh - tol
            ):
                fullscreen_found = True
                return False
        return True

    user32.EnumWindows(enum_proc, 0)
    return fullscreen_found

