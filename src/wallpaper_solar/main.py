"""Punto de entrada: DPI, instancia única y arranque de la aplicación."""

from wallpaper_solar.win32.dpi import enable_per_monitor_dpi_awareness


def main():
    # Debe ir antes de crear cualquier ventana.
    enable_per_monitor_dpi_awareness()

    import sys

    from wallpaper_solar import __version__, paths
    from wallpaper_solar.log import logger, setup_logging

    setup_logging()
    logger.info(
        "Wallpaper Solar %s (%s) · Python %s · HTML: %s",
        __version__, "instalado" if paths.is_frozen() else "desarrollo",
        sys.version.split()[0], paths.html_file(),
    )

    from wallpaper_solar import config
    from wallpaper_solar.win32.single_instance import (
        acquire_single_instance_lock,
        show_already_running_message,
    )

    if config.SINGLE_INSTANCE and acquire_single_instance_lock() is None:
        logger.info("Ya hay otra instancia en marcha: se cancela este arranque")
        show_already_running_message()
        raise SystemExit(0)

    from wallpaper_solar.app import SolarWallpaperApp

    SolarWallpaperApp().run()


if __name__ == "__main__":
    main()
