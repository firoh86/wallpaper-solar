"""
Hooks globales de ratón y teclado (WH_MOUSE_LL / WH_KEYBOARD_LL).

Como el WebView está detrás de los iconos, Windows nunca le entrega el ratón.
Estos hooks observan la entrada de todo el sistema y, cuando ocurre sobre el
escritorio, la reenvían al HTML a través del puente. Nunca bloquean la entrada:
siempre se llama a CallNextHookEx.
"""

import ctypes
import time

from wallpaper_solar import config
from wallpaper_solar.log import log_dbg
from wallpaper_solar.win32.api import (
    HOOKPROC,
    KBDLLHOOKSTRUCT,
    MSG,
    MSLLHOOKSTRUCT,
    WH_KEYBOARD_LL,
    WH_MOUSE_LL,
    WM_KEYDOWN,
    WM_LBUTTONDOWN,
    WM_LBUTTONUP,
    WM_MOUSEMOVE,
    WM_MOUSEWHEEL,
    WM_QUIT,
    WM_RBUTTONDOWN,
    WM_RBUTTONUP,
    kernel32,
    user32,
)
from wallpaper_solar.win32.desktop import is_desktop_foreground, is_point_on_desktop

# Teclas reenviadas al HTML: F, Espacio, Esc y L (vista lunar)
SHORTCUT_KEYS = {0x46: "KeyF", 0x20: "Space", 0x1B: "Escape", 0x4C: "KeyL"}


class InputHooks:
    def __init__(self, app):
        """app: SolarWallpaperApp (se leen interactive_mode, paused_by_fullscreen, desktop y bridge)."""
        self.app = app

        self._left_down = False
        self._right_down = False
        self._last_pt = None
        self._drag_moved = 0.0
        self._last_click_time = 0.0
        self._last_click_pt = (0, 0)

        self.mouse_hook = None
        self.kb_hook = None
        self._mouse_proc_ref = None
        self._kb_proc_ref = None
        self._hook_thread_id = None

    # ------------------------------------------------------------- acciones
    def _handle_canvas_click(self, screen_x: int, screen_y: int):
        coords = self.app.desktop.screen_to_client(screen_x, screen_y)
        if not coords:
            return
        cx, cy = coords
        now = time.monotonic()
        is_dbl = (
            (now - self._last_click_time) < 0.38
            and abs(screen_x - self._last_click_pt[0]) <= 6
            and abs(screen_y - self._last_click_pt[1]) <= 6
        )
        self._last_click_time = now
        self._last_click_pt = (screen_x, screen_y)

        method = "dblClickAtClient" if is_dbl else "clickAtClient"
        log_dbg(f"[HOOK] {method} screen=({screen_x},{screen_y}) client=({cx},{cy})")
        self.app.bridge.call(method, cx, cy)

    def _handle_canvas_drag(self, dx: int, dy: int, right_button: bool):
        scale = self.app.desktop.dpi_scale()
        self.app.bridge.add_drag(dx / scale, dy / scale, rotate=right_button)

    def _handle_canvas_wheel(self, screen_x: int, screen_y: int, delta: int):
        log_dbg(f"[HOOK] wheel delta={delta}")
        self.app.bridge.add_wheel(delta, self.app.desktop.screen_to_client(screen_x, screen_y))

    def _trigger_js_shortcut(self, vk_code: int):
        code = SHORTCUT_KEYS.get(vk_code)
        if not code:
            return
        log_dbg(f"[HOOK] key vk={hex(vk_code)} -> {code}")
        self.app.bridge.call("shortcut", f"'{code}'")

    # --------------------------------------------------------------- hooks
    def _active(self) -> bool:
        app = self.app
        return app.interactive_mode and not app.paused_by_fullscreen and bool(app.desktop.webview_hwnd)

    def _mouse_callback(self, nCode, wParam, lParam):
        app = self.app
        if config.DEBUG_LOGS and wParam in (WM_LBUTTONDOWN, WM_MOUSEWHEEL):
            print(
                f"[RAW_MOUSE] nCode={nCode} wParam={wParam} "
                f"paused={app.paused_by_fullscreen} inter={app.interactive_mode} "
                f"hwnd={app.desktop.webview_hwnd}",
                flush=True,
            )

        if nCode >= 0 and self._active():
            info = ctypes.cast(lParam, ctypes.POINTER(MSLLHOOKSTRUCT)).contents
            x, y = int(info.pt.x), int(info.pt.y)
            ignored = app.desktop.ignored_hwnds()

            if wParam == WM_LBUTTONDOWN:
                if is_point_on_desktop(x, y, ignored):
                    self._left_down = True
                    self._last_pt = (x, y)
                    self._drag_moved = 0.0
            elif wParam == WM_LBUTTONUP:
                was_down = self._left_down
                self._left_down = False
                if was_down and self._drag_moved < 6.0 and is_point_on_desktop(x, y, ignored):
                    self._handle_canvas_click(x, y)
                self._last_pt = None
            elif wParam == WM_RBUTTONDOWN:
                if is_point_on_desktop(x, y, ignored):
                    self._right_down = True
                    self._last_pt = (x, y)
                    self._drag_moved = 0.0
            elif wParam == WM_RBUTTONUP:
                self._right_down = False
                self._last_pt = None
            elif wParam == WM_MOUSEMOVE:
                if (self._left_down or self._right_down) and self._last_pt is not None:
                    dx = x - self._last_pt[0]
                    dy = y - self._last_pt[1]
                    self._drag_moved += (dx * dx + dy * dy) ** 0.5
                    self._last_pt = (x, y)
                    if dx != 0 or dy != 0:
                        self._handle_canvas_drag(dx, dy, self._right_down and not self._left_down)
            elif wParam == WM_MOUSEWHEEL:
                if is_point_on_desktop(x, y, ignored):
                    signed_delta = ctypes.c_short((info.mouseData >> 16) & 0xFFFF).value
                    if signed_delta != 0:
                        self._handle_canvas_wheel(x, y, signed_delta)

        return user32.CallNextHookEx(self.mouse_hook, nCode, wParam, lParam)

    def _kb_callback(self, nCode, wParam, lParam):
        if (
            nCode >= 0
            and wParam == WM_KEYDOWN
            and self._active()
            and is_desktop_foreground()
        ):
            kb = ctypes.cast(lParam, ctypes.POINTER(KBDLLHOOKSTRUCT)).contents
            if kb.vkCode in SHORTCUT_KEYS:
                self._trigger_js_shortcut(kb.vkCode)
        return user32.CallNextHookEx(self.kb_hook, nCode, wParam, lParam)

    def run_message_loop(self):
        """Instala los hooks y bombea mensajes. Se ejecuta en su propio hilo."""
        self._hook_thread_id = kernel32.GetCurrentThreadId()

        # Las referencias se guardan en self para que el recolector no libere los callbacks.
        self._mouse_proc_ref = HOOKPROC(self._mouse_callback)
        self._kb_proc_ref = HOOKPROC(self._kb_callback)
        self.mouse_hook = user32.SetWindowsHookExW(WH_MOUSE_LL, self._mouse_proc_ref, None, 0)
        self.kb_hook = user32.SetWindowsHookExW(WH_KEYBOARD_LL, self._kb_proc_ref, None, 0)
        log_dbg(
            f"[HOOK_INIT] mouse_hook={self.mouse_hook} kb_hook={self.kb_hook} "
            f"err={ctypes.get_last_error()}"
        )

        msg = MSG()
        while self.app.running and user32.GetMessageW(ctypes.byref(msg), 0, 0, 0) > 0:
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))

        if self.mouse_hook:
            user32.UnhookWindowsHookEx(self.mouse_hook)
            self.mouse_hook = None
        if self.kb_hook:
            user32.UnhookWindowsHookEx(self.kb_hook)
            self.kb_hook = None

    def stop(self):
        """Despierta el bucle de mensajes para que libere los hooks."""
        if self._hook_thread_id:
            user32.PostThreadMessageW(self._hook_thread_id, WM_QUIT, 0, 0)
