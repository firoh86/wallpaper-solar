"""
Registro de la aplicación.

- Siempre: archivo rotativo en %APPDATA%\\WallpaperSolar\\logs\\wallpaper.log (3 × 1 MB),
  con el arranque, los avisos y cualquier excepción no capturada (también de los hilos).
  Imprescindible con el .exe, que no tiene consola.
- Con DEBUG_LOGS / WALLPAPER_DEBUG=1: además los mensajes de depuración, también en consola.
"""

import logging
import sys
import threading
from logging.handlers import RotatingFileHandler

from wallpaper_solar import config

logger = logging.getLogger("wallpaper_solar")
_configured = False


def setup_logging() -> None:
    global _configured
    if _configured:
        return
    _configured = True

    from wallpaper_solar.settings import logs_dir  # import tardío: evita crear carpetas al importar

    logger.setLevel(logging.DEBUG if config.DEBUG_LOGS else logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)-7s [%(threadName)s] %(message)s")

    try:
        fh = RotatingFileHandler(logs_dir() / "wallpaper.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
        fh.setFormatter(fmt)
        logger.addHandler(fh)
    except OSError:
        pass  # sin permisos de escritura: seguimos sin archivo

    if config.DEBUG_LOGS and sys.stdout is not None:
        ch = logging.StreamHandler(sys.stdout)
        ch.setFormatter(fmt)
        logger.addHandler(ch)

    def _excepthook(exc_type, exc, tb):
        logger.critical("Excepción no capturada", exc_info=(exc_type, exc, tb))

    def _thread_excepthook(args):
        if args.exc_type is SystemExit:
            return
        logger.error(
            "Excepción no capturada en el hilo %s",
            getattr(args.thread, "name", "?"),
            exc_info=(args.exc_type, args.exc_value, args.exc_traceback),
        )

    sys.excepthook = _excepthook
    threading.excepthook = _thread_excepthook


def close_log_files() -> None:
    r"""Cierra el archivo de registro (Windows no deja borrar un archivo abierto: el
    desinstalador no podría eliminar logs\). A partir de aquí los mensajes se descartan."""
    for h in list(logger.handlers):
        try:
            h.close()
        finally:
            logger.removeHandler(h)
    logger.addHandler(logging.NullHandler())


def log_dbg(msg: str):
    """Mensajes de depuración (hooks, incrustación…). Sólo con DEBUG_LOGS."""
    if config.DEBUG_LOGS:
        if logger.handlers:
            logger.debug(msg)
        else:
            print(msg, flush=True)
