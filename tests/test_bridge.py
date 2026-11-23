"""Pruebas del puente Python -> JS (no necesitan Windows ni pywebview)."""

from wallpaper_solar.bridge import JsBridge


class FakeWindow:
    def __init__(self):
        self.scripts = []

    def evaluate_js(self, script):
        self.scripts.append(script)


def make_bridge():
    window = FakeWindow()
    return JsBridge(get_window=lambda: window, is_running=lambda: True), window


def test_drags_are_accumulated_into_one_script():
    bridge, _ = make_bridge()
    for _ in range(10):
        bridge.add_drag(1.5, -2.0, rotate=False)
    bridge.add_drag(3, 4, rotate=True)
    bridge.add_wheel(120)
    bridge.add_wheel(120)
    bridge.add_wheel(-120)

    js = bridge._take_pending_motion_js()
    assert "b.panBy(15.0, -20.0);" in js
    assert "b.rotate3DBy(3.0, 4.0);" in js
    assert "i < 1; i++) b.zoomByDelta(1);" in js
    # Tras vaciarlo no queda nada pendiente
    assert bridge._take_pending_motion_js() is None


def test_call_builds_guarded_bridge_call():
    bridge, _ = make_bridge()
    bridge.call("clickAtClient", 10.5, 20)
    assert bridge._js_queue.get_nowait() == (
        "if (window.__wallpaperBridge) window.__wallpaperBridge.clickAtClient(10.5, 20);"
    )


def test_enqueue_is_ignored_without_window():
    bridge = JsBridge(get_window=lambda: None, is_running=lambda: True)
    bridge.enqueue("x")
    assert bridge._js_queue.empty()


def test_wheel_with_position_uses_wheelAt_with_zoom_fallback():
    bridge, _ = make_bridge()
    bridge.add_wheel(120, (300.5, 200))
    bridge.add_wheel(120, (301, 202))
    js = bridge._take_pending_motion_js()
    assert "if (b.wheelAt) b.wheelAt(301, 202, 2);" in js
    assert "b.zoomByDelta(1);" in js  # compatible con un HTML antiguo sin wheelAt
    assert bridge._take_pending_motion_js() is None
