"""
Configuración fija de la aplicación.

Son los mismos valores que había al principio de wallpaper_solar.py.
(Los ajustes que el usuario cambie desde la bandeja se guardarán más
adelante en un archivo propio; esto son constantes del programa.)
"""

import os

ACCENT_COLOR = "#1C67E3"         # Azul NASA
BG_COLOR = "#030508"             # Negro espacial
FULLSCREEN_CHECK_INTERVAL = 0.5  # Segundos entre comprobaciones de estado

# True = incrustada en el escritorio detrás de iconos (WorkerW / Progman)
USE_WORKERW_PARENT = True
# Se activa también con la variable de entorno WALLPAPER_DEBUG=1
# (la configuración "Ejecutar con logs" de VS Code la pone).
DEBUG_LOGS = os.environ.get("WALLPAPER_DEBUG") == "1"

# True = sólo se consideran "escritorio" las zonas libres del escritorio de verdad.
# Evita que los clics / rueda / arrastres dentro de Chrome, Edge, VS Code, Discord,
# la barra de tareas, el menú Inicio o los menús contextuales muevan el fondo.
# Si en tu equipo dejara de responder la interacción, ponlo a False para volver
# al comportamiento anterior.
STRICT_DESKTOP_HIT_TEST = True

# Impide abrir dos wallpapers a la vez (doble clic accidental, inicio automático + manual).
SINGLE_INSTANCE = True
# Nombre del mutex de instancia única. El instalador lo usará también para
# saber si la aplicación está abierta antes de actualizar o desinstalar.
SINGLE_INSTANCE_MUTEX = "Local\\SolarWallpaperJPL_SingleInstance"

# Frecuencia máxima de envío de arrastres/zoom al HTML (se agrupan los movimientos).
INPUT_FLUSH_HZ = 60

# Debe coincidir con el <title> de web/index.html: se usa para localizar la ventana.
WINDOW_TITLE = "SISTEMA SOLAR // TELEMETRÍA JPL EN VIVO"
TRAY_TITLE = "Sistema Solar JPL // Wallpaper"
