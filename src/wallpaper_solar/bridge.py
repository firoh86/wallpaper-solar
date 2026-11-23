"""
Puente Python -> JavaScript.

Todo lo que se envía al HTML pasa por aquí: una cola de scripts que un hilo
despacha con window.evaluate_js, y un acumulador de movimiento (pan, rotación 3D
y rueda) que se vacía como un único script hasta INPUT_FLUSH_HZ veces por segundo.
"""

import queue
import threading

from wallpaper_solar import config
from wallpaper_solar.log import log_dbg


class JsBridge:
    def __init__(self, get_window, is_running):
        """
        get_window: función que devuelve la ventana de pywebview (o None).
        is_running: función que devuelve False cuando la app se está cerrando.
        """
        self._get_window = get_window
        self._is_running = is_running
        self._js_queue = queue.Queue(maxsize=250)

        # Movimiento acumulado entre envíos (pan, rotación 3D y pasos de rueda).
        # Antes cada WM_MOUSEMOVE era un evaluate_js; con ratones de 1000 Hz la
        # cola se llenaba y se perdían movimientos (y clics).
        self._motion_lock = threading.Lock()
        self._pending_pan = [0.0, 0.0]
        self._pending_rot = [0.0, 0.0]
        self._pending_zoom_steps = 0
        self._pending_wheel_pos = None  # posición (CSS) de la última rueda, si se conoce

    # ------------------------------------------------------------------ envío
    def enqueue(self, script: str):
        if not self._get_window() or not self._is_running():
            return
        try:
            self._js_queue.put_nowait(script)
        except queue.Full:
            pass

    def call(self, method: str, *args):
        """Encola window.__wallpaperBridge.<method>(args) si el puente existe en el HTML."""
        arg_list = ", ".join(str(a) for a in args)
        self.enqueue(
            f"if (window.__wallpaperBridge) window.__wallpaperBridge.{method}({arg_list});"
        )

    # ------------------------------------------------------------- movimiento
    def add_drag(self, dx: float, dy: float, rotate: bool):
        with self._motion_lock:
            target = self._pending_rot if rotate else self._pending_pan
            target[0] += dx
            target[1] += dy

    def add_wheel(self, delta: int, client_pos=None):
        """client_pos: (x, y) en píxeles CSS del HTML, para que la rueda actúe donde está el ratón."""
        with self._motion_lock:
            self._pending_zoom_steps += 1 if delta > 0 else -1
            if client_pos:
                self._pending_wheel_pos = client_pos

    def _take_pending_motion_js(self):
        """Devuelve (y vacía) el movimiento acumulado como un único script JS."""
        with self._motion_lock:
            pdx, pdy = self._pending_pan
            rdx, rdy = self._pending_rot
            steps = self._pending_zoom_steps
            wheel_pos = self._pending_wheel_pos
            self._pending_pan = [0.0, 0.0]
            self._pending_rot = [0.0, 0.0]
            self._pending_zoom_steps = 0
            self._pending_wheel_pos = None

        parts = []
        if pdx or pdy:
            parts.append(f"b.panBy({round(pdx, 2)}, {round(pdy, 2)});")
        if rdx or rdy:
            parts.append(f"b.rotate3DBy({round(rdx, 2)}, {round(rdy, 2)});")
        if steps:
            sign = 1 if steps > 0 else -1
            zoom_loop = f"for (let i = 0; i < {abs(steps)}; i++) b.zoomByDelta({sign});"
            if wheel_pos:
                # wheelAt decide según la vista: zoom en el Sistema Solar, scroll en la lista de misiones…
                x, y = wheel_pos
                parts.append(f"if (b.wheelAt) b.wheelAt({x}, {y}, {steps}); else {{ {zoom_loop} }}")
            else:
                parts.append(zoom_loop)
        if not parts:
            return None
        return "(function(){ const b = window.__wallpaperBridge; if (!b) return; " + " ".join(parts) + " })();"

    # ------------------------------------------------------------ despachador
    def run_dispatcher(self):
        """Bucle del hilo despachador. Termina cuando is_running() devuelve False."""
        flush_interval = 1.0 / max(10, config.INPUT_FLUSH_HZ)
        while self._is_running():
            try:
                script = self._js_queue.get(timeout=flush_interval)
            except queue.Empty:
                script = None

            # El movimiento acumulado va antes del script en cola, para que un clic
            # que llega tras un arrastre se aplique sobre la vista ya desplazada.
            batch = [s for s in (self._take_pending_motion_js(), script) if s]
            window = self._get_window()
            if not batch or not window:
                continue
            for s in batch:
                try:
                    window.evaluate_js(s)
                except Exception as exc:
                    log_dbg(f"[JS ERROR] {exc}")
