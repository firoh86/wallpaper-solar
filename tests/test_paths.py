import pytest

from wallpaper_solar import config, paths

SOURCE_HTML = paths.web_dir() / "index.html"
BUILT = paths.html_file().exists()
needs_build = pytest.mark.skipif(not BUILT, reason="Falta compilar la web: npm --prefix web run build")


def test_source_title_matches_window_title():
    # La app localiza su ventana por este título: si cambia en el HTML, hay que cambiarlo en config.py
    assert f"<title>{config.WINDOW_TITLE}</title>" in SOURCE_HTML.read_text(encoding="utf-8")


def test_logo_source_exists():
    assert (paths.web_dir() / "src" / "assets" / "rubikeys.png").exists()


@needs_build
def test_built_html_is_self_contained():
    html = paths.html_file().read_text(encoding="utf-8")
    assert f"<title>{config.WINDOW_TITLE}</title>" in html
    assert paths.html_url().startswith("file:///")
    assert paths.html_url().endswith("/web/dist/index.html")
    # Nada debe cargarse desde fuera: WebView2 bloquea módulos desde file:// y queremos funcionar sin red
    assert '<script type="module" src=' not in html
    assert "https://fonts.googleapis.com" not in html
    assert "data:image/png" in html  # logo incrustado
    assert "window.__wallpaperBridge" in html


def test_frozen_exe_finds_html_inside_bundle(monkeypatch, tmp_path):
    # Simula WallpaperSolar.exe de PyInstaller: los recursos están en sys._MEIPASS (_internal\)
    import sys

    (tmp_path / "web" / "dist").mkdir(parents=True)
    (tmp_path / "web" / "dist" / "index.html").write_text("<title>x</title>", encoding="utf-8")
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)
    assert paths.html_file() == tmp_path / "web" / "dist" / "index.html"
    assert paths.html_url().startswith("file://") and paths.html_url().endswith("/web/dist/index.html")


def test_tray_uninstall_launches_uninstaller_directly(monkeypatch, tmp_path):
    """Regresión: antes se lanzaba vía 'cmd /c ... start "" "ruta"' y Windows intentaba abrir "\\\\"."""
    import subprocess
    import sys
    import types

    # La app importa módulos de Windows y pywebview: se sustituyen por dobles mínimos.
    if sys.platform != "win32":
        import ctypes
        from unittest import mock

        monkeypatch.setattr(ctypes, "WinDLL", lambda *a, **k: mock.MagicMock(), raising=False)
        monkeypatch.setattr(ctypes, "windll", mock.MagicMock(), raising=False)
        monkeypatch.setattr(ctypes, "WINFUNCTYPE", ctypes.CFUNCTYPE, raising=False)
        monkeypatch.setitem(sys.modules, "webview", types.ModuleType("webview"))
        pystray = types.ModuleType("pystray")
        pystray.Menu = mock.MagicMock()
        pystray.MenuItem = mock.MagicMock()
        pystray.Icon = mock.MagicMock()
        monkeypatch.setitem(sys.modules, "pystray", pystray)
        for name in [m for m in sys.modules if m.startswith("wallpaper_solar.") and m not in ("wallpaper_solar.paths",
                     "wallpaper_solar.config", "wallpaper_solar.settings", "wallpaper_solar.bridge",
                     "wallpaper_solar.autostart", "wallpaper_solar.log")]:
            monkeypatch.delitem(sys.modules, name)

    from wallpaper_solar import app as app_mod

    unins = tmp_path / "Mi Carpeta" / "unins000.exe"
    unins.parent.mkdir()
    unins.write_bytes(b"")
    calls = []
    monkeypatch.setattr(app_mod.SolarWallpaperApp, "uninstaller_path", staticmethod(lambda: unins))
    order = []
    released = []
    monkeypatch.setattr(app_mod, "release_single_instance_lock", lambda: released.append(True))
    monkeypatch.setattr(app_mod, "close_log_files", lambda: order.append("log cerrado"))
    monkeypatch.setattr(subprocess, "Popen", lambda *a, **k: (order.append("desinstalador"), calls.append((a, k))))
    quit_calls = []
    monkeypatch.setattr(app_mod.SolarWallpaperApp, "quit_app", lambda self, *a: quit_calls.append(True))

    app_mod.SolarWallpaperApp.uninstall(object.__new__(app_mod.SolarWallpaperApp))

    assert released and quit_calls
    assert order == ["log cerrado", "desinstalador"]  # el log se cierra ANTES de abrir el desinstalador
    (args, kwargs), = calls
    assert args[0] == [str(unins)]          # el .exe directamente, sin cmd ni comillas manuales
    assert kwargs["cwd"] == str(unins.parent)
