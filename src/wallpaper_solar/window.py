"""
La ventana del WebView incrustada en el escritorio.

Localiza los HWND de pywebview/WebView2, la cuelga del WorkerW (detrás de los
iconos), la extiende a todo el escritorio virtual multimonitor y convierte
coordenadas de pantalla a píxeles CSS del HTML.
"""

import ctypes
import os
from ctypes import wintypes

from wallpaper_solar import config
from wallpaper_solar.log import log_dbg
from wallpaper_solar.win32.api import (
    GWL_EXSTYLE,
    GWL_STYLE,
    HWND_BOTTOM,
    HWND_NOTOPMOST,
    POINT,
    RDW_ALLCHILDREN,
    RDW_INVALIDATE,
    RDW_UPDATENOW,
    SW_RESTORE,
    SW_SHOWNOACTIVATE,
    SWP_FRAMECHANGED,
    SWP_NOACTIVATE,
    SWP_NOMOVE,
    SWP_NOSIZE,
    WS_CAPTION,
    WS_CHILD,
    WS_EX_TOOLWINDOW,
    WS_EX_TOPMOST,
    WS_POPUP,
    WS_THICKFRAME,
    user32,
)
from wallpaper_solar.win32.desktop import find_shell_defview, get_desktop_parent_hwnd
from wallpaper_solar.win32.monitors import get_display_topology


def topology_signature(topo):
    return [(m["left"], m["top"], m["width"], m["height"], m["dpi"]) for m in topo["monitors"]]


class DesktopWindow:
    def __init__(self, bridge):
        self.bridge = bridge
        self.webview_hwnd = 0
        self.child_render_hwnd = 0
        self.workerw_hwnd = 0
        self.last_topo_sig = None

    def ignored_hwnds(self):
        """Ventanas propias que no deben contar como 'otra aplicación'."""
        return (self.webview_hwnd, self.child_render_hwnd, self.workerw_hwnd)

    def find_webview_hwnds(self):
        target_title = config.WINDOW_TITLE
        found = int(user32.FindWindowW(None, target_title) or 0)

        if not found:
            pid = wintypes.DWORD(0)
            my_pid = os.getpid()

            @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
            def enum_top(w, lp):
                nonlocal found
                user32.GetWindowThreadProcessId(w, ctypes.byref(pid))
                if int(pid.value) == my_pid and user32.IsWindowVisible(w):
                    found = int(w or 0)
                    return False
                return True

            user32.EnumWindows(enum_top, 0)

        if found:
            self.webview_hwnd = found

        best_child = self.webview_hwnd

        @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        def enum_child(child, lparam):
            nonlocal best_child
            buf = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(child, buf, 256)
            if "Chrome_WidgetWin_1" in buf.value:
                best_child = int(child or 0)
                return False
            if "Chrome_WidgetWin" in buf.value or "Intermediate" in buf.value:
                best_child = int(child or 0)
            return True

        if self.webview_hwnd:
            user32.EnumChildWindows(self.webview_hwnd, enum_child, 0)
        self.child_render_hwnd = int(best_child or 0)
        return self.webview_hwnd

    def dpi_scale(self) -> float:
        """Escala DPI de la ventana de render (1.0 = 96 dpi)."""
        hwnd = self.child_render_hwnd or self.webview_hwnd
        try:
            return (user32.GetDpiForWindow(hwnd) or 96) / 96.0 if hwnd else 1.0
        except Exception:
            return 1.0

    def screen_to_client(self, screen_x: int, screen_y: int):
        """
        Convierte coordenadas globales de ratón (incluyendo valores negativos o pantallas verticales)
        a píxeles CSS exactos dentro del WebView2.
        """
        hwnd = self.child_render_hwnd or self.webview_hwnd or self.find_webview_hwnds()
        if not hwnd:
            return None
        pt = POINT(int(screen_x), int(screen_y))
        if not user32.ScreenToClient(hwnd, ctypes.byref(pt)):
            return None
        try:
            dpi = user32.GetDpiForWindow(hwnd) or 96
            scale = dpi / 96.0
        except Exception:
            scale = 1.0
        return round(pt.x / scale, 2), round(pt.y / scale, 2)

    def sync_primary_viewport_to_js(self, topo=None):
        """Informa al HTML dónde queda exactamente el Monitor Principal dentro del lienzo multimonitor."""
        topo = topo or get_display_topology()
        primary = topo["primary"]
        tl = self.screen_to_client(primary["left"], primary["top"])
        br = self.screen_to_client(primary["right"], primary["bottom"])
        if not tl or not br:
            return
        p_left, p_top = tl
        p_width = max(100.0, br[0] - tl[0])
        p_height = max(100.0, br[1] - tl[1])
        self.bridge.call("setPrimaryViewport", p_left, p_top, p_width, p_height)

    def ensure_visible_and_behind_icons(self):
        """Evita que Win+D la deje minimizada y mantiene los iconos/carpetas visibles."""
        hwnd = self.webview_hwnd or self.find_webview_hwnds()
        if not hwnd:
            return

        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, SW_RESTORE)
            user32.ShowWindow(hwnd, SW_SHOWNOACTIVATE)

        user32.SetWindowPos(
            hwnd,
            HWND_NOTOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        )
        user32.SetWindowPos(
            hwnd,
            HWND_BOTTOM,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        )

        _, shell_view = find_shell_defview()
        if shell_view:
            user32.RedrawWindow(
                shell_view,
                None,
                None,
                RDW_INVALIDATE | RDW_ALLCHILDREN | RDW_UPDATENOW,
            )

    def apply_desktop_embedding(self):
        hwnd = self.find_webview_hwnds()
        if not hwnd:
            return False

        topo = get_display_topology()
        vx = topo["virtual_left"]
        vy = topo["virtual_top"]
        vw = topo["virtual_width"]
        vh = topo["virtual_height"]

        if config.USE_WORKERW_PARENT:
            parent = get_desktop_parent_hwnd()
            self.workerw_hwnd = int(parent or 0)
            if not parent:
                return False

            style = user32.GetWindowLongW(hwnd, GWL_STYLE)
            style = (style & ~WS_POPUP & ~WS_CAPTION & ~WS_THICKFRAME) | WS_CHILD
            user32.SetWindowLongW(hwnd, GWL_STYLE, style)

            ex_style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            ex_style = (ex_style & ~WS_EX_TOPMOST) | WS_EX_TOOLWINDOW
            user32.SetWindowLongW(hwnd, GWL_EXSTYLE, ex_style)

            user32.SetParent(hwnd, parent)

            # Traducir esquina superior izquierda del escritorio virtual al espacio local del contenedor
            parent_origin = POINT(vx, vy)
            user32.ScreenToClient(parent, ctypes.byref(parent_origin))

            user32.SetWindowPos(
                hwnd,
                HWND_BOTTOM,
                int(parent_origin.x),
                int(parent_origin.y),
                int(vw),
                int(vh),
                SWP_NOACTIVATE | SWP_FRAMECHANGED,
            )
            log_dbg(
                f"[EMBED] pantallas={len(topo['monitors'])} virtual=({vx},{vy},{vw}x{vh}) "
                f"local=({parent_origin.x},{parent_origin.y}) hwnd={hwnd} child={self.child_render_hwnd}"
            )
        else:
            style = user32.GetWindowLongW(hwnd, GWL_STYLE)
            style = (style & ~WS_CHILD & ~WS_CAPTION & ~WS_THICKFRAME) | WS_POPUP
            user32.SetWindowLongW(hwnd, GWL_STYLE, style)

            ex_style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            ex_style = (ex_style & ~WS_EX_TOPMOST) | WS_EX_TOOLWINDOW
            user32.SetWindowLongW(hwnd, GWL_EXSTYLE, ex_style)

            user32.SetWindowPos(
                hwnd,
                HWND_BOTTOM,
                int(vx),
                int(vy),
                int(vw),
                int(vh),
                SWP_NOACTIVATE | SWP_FRAMECHANGED,
            )

        self.ensure_visible_and_behind_icons()
        self.sync_primary_viewport_to_js(topo)
        self.last_topo_sig = topology_signature(topo)
        return True
