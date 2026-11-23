# -*- mode: python ; coding: utf-8 -*-
#
# Receta de PyInstaller para WallpaperSolar.exe
#   Uso normal: build\build.ps1   (o la tarea de VS Code "Compilar instalador")
#   A mano:     .venv\Scripts\python.exe -m PyInstaller build\wallpaper.spec --noconfirm
#
# Modo carpeta (no "un solo archivo"): arranca más rápido y los antivirus lo marcan menos.
# Resultado: build\output\dist\WallpaperSolar\WallpaperSolar.exe (+ _internal\)

from pathlib import Path

ROOT = Path(SPECPATH).parent  # noqa: F821 - SPECPATH lo define PyInstaller
HTML = ROOT / "web" / "dist" / "index.html"
if not HTML.exists():
    raise SystemExit("Falta web/dist/index.html: compila la web antes (npm --prefix web run build)")

a = Analysis(  # noqa: F821
    [str(ROOT / "run.py")],
    pathex=[str(ROOT / "src")],
    # Lo único que necesita el programa además del código: la simulación compilada.
    # paths.py la busca en <_MEIPASS>/web/dist/index.html
    datas=[(str(HTML), "web/dist")],
    hiddenimports=[
        "pystray._win32",                    # pystray elige su motor en tiempo de ejecución
        "webview.platforms.edgechromium",    # WebView2
        "webview.platforms.winforms",
    ],
    excludes=["tkinter", "pytest", "ruff", "unittest", "pydoc"],
    noarchive=False,
)

pyz = PYZ(a.pure)  # noqa: F821

exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="WallpaperSolar",
    icon=str(ROOT / "build" / "icon.ico"),
    console=False,        # sin ventana de consola (los errores van a %APPDATA%\WallpaperSolar\logs)
    upx=False,            # UPX dispara falsos positivos en los antivirus
    disable_windowed_traceback=False,
)

coll = COLLECT(  # noqa: F821
    exe,
    a.binaries,
    a.datas,
    name="WallpaperSolar",
    upx=False,
)
