"""Topología de pantallas: posición, tamaño, DPI y monitor principal."""

import ctypes
from ctypes import wintypes

from wallpaper_solar.win32.api import (
    MDT_EFFECTIVE_DPI,
    MONITORENUMPROC,
    MONITORINFO,
    MONITORINFOF_PRIMARY,
    shcore,
    user32,
)


def get_display_topology():
    """
    Detecta todos los monitores activos, sus resoluciones físicas/lógicas,
    coordenadas en el escritorio virtual, cuál es el principal y el bounding box global.
    """
    monitors = []

    def mon_proc(hmon, hdc, lprc, lparam):
        mi = MONITORINFO()
        mi.cbSize = ctypes.sizeof(MONITORINFO)
        if user32.GetMonitorInfoW(hmon, ctypes.byref(mi)):
            r = mi.rcMonitor
            w = r.right - r.left
            h = r.bottom - r.top
            dpi_x = 96
            if shcore is not None:
                dx = wintypes.UINT()
                dy = wintypes.UINT()
                if shcore.GetDpiForMonitor(hmon, MDT_EFFECTIVE_DPI, ctypes.byref(dx), ctypes.byref(dy)) == 0:
                    dpi_x = int(dx.value)
            monitors.append({
                "left": int(r.left),
                "top": int(r.top),
                "right": int(r.right),
                "bottom": int(r.bottom),
                "width": int(w),
                "height": int(h),
                "is_primary": bool(mi.dwFlags & MONITORINFOF_PRIMARY),
                "orientation": "vertical" if h > w else "horizontal",
                "dpi": dpi_x,
                "scale": round(dpi_x / 96.0, 2),
            })
        return True

    user32.EnumDisplayMonitors(0, 0, MONITORENUMPROC(mon_proc), 0)

    if not monitors:
        w = int(user32.GetSystemMetrics(0))
        h = int(user32.GetSystemMetrics(1))
        monitors.append({
            "left": 0, "top": 0, "right": w, "bottom": h,
            "width": w, "height": h, "is_primary": True,
            "orientation": "vertical" if h > w else "horizontal",
            "dpi": 96, "scale": 1.0,
        })

    min_x = min(m["left"] for m in monitors)
    min_y = min(m["top"] for m in monitors)
    max_x = max(m["right"] for m in monitors)
    max_y = max(m["bottom"] for m in monitors)

    primary = next((m for m in monitors if m["is_primary"]), monitors[0])

    return {
        "monitors": monitors,
        "primary": primary,
        "virtual_left": min_x,
        "virtual_top": min_y,
        "virtual_width": max_x - min_x,
        "virtual_height": max_y - min_y,
    }

